import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail,
  MessageSquare,
  CheckSquare,
  Calendar,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Info,
  VolumeX,
  Check,
  X,
  Send,
  Clock,
  ExternalLink,
  Zap,
  Mic,
  MicOff,
  Copy,
  ChevronDown,
  ChevronUp,
  MessageCircle,
} from "lucide-react";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";
import type { TriageItem, CalendarEvent, Priority } from "@shared/types";
import { toast } from "sonner";

// ─── Config ─────────────────────────────────────────────────────────────────

const platformIcon: Record<string, React.ElementType> = {
  gmail: Mail,
  slack: MessageSquare,
  asana: CheckSquare,
  calendar: Calendar,
};

const platformLabel: Record<string, string> = {
  gmail: "Email",
  slack: "Slack",
  asana: "Asana",
  calendar: "Calendar",
};

const platformColor: Record<string, string> = {
  gmail: "bg-red-500",
  slack: "bg-purple-500",
  asana: "bg-orange-500",
  calendar: "bg-blue-500",
};

const platformBadgeColor: Record<string, string> = {
  gmail: "bg-red-100 text-red-700",
  slack: "bg-purple-100 text-purple-700",
  asana: "bg-orange-100 text-orange-700",
  calendar: "bg-blue-100 text-blue-700",
};

const priorityConfig: Record<
  Priority,
  { label: string; color: string; borderColor: string; icon: React.ElementType }
> = {
  urgent: {
    label: "Urgent",
    color: "bg-red-50 text-red-700 border-red-200",
    borderColor: "border-l-red-500",
    icon: AlertTriangle,
  },
  action: {
    label: "Action",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    borderColor: "border-l-amber-500",
    icon: ArrowRight,
  },
  info: {
    label: "FYI",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    borderColor: "border-l-blue-500",
    icon: Info,
  },
  noise: {
    label: "Noise",
    color: "bg-gray-50 text-gray-400 border-gray-200",
    borderColor: "border-l-gray-300",
    icon: VolumeX,
  },
};

function getDisplayTitle(item: TriageItem): string {
  const meta = item.meta as Record<string, unknown> | undefined;
  if (meta?.cleanTitle && typeof meta.cleanTitle === "string") {
    return meta.cleanTitle;
  }
  return item.title.replace(/^(Re:\s*|Fw:\s*|Fwd:\s*)+/i, "").trim() || item.title;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Voice Recorder Hook ───────────────────────────────────────────────────

function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        resolve("");
        return;
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1] ?? "";
          setIsRecording(false);
          recorder.stream.getTracks().forEach((t) => t.stop());
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
}

// ─── Thread Context ────────────────────────────────────────────────────────

function ThreadContext({
  platform,
  threadId,
  channelId,
}: {
  platform: string;
  threadId?: string;
  channelId?: string;
}) {
  const thread = trpc.thread.messages.useQuery(
    { platform: platform as "gmail" | "slack" | "asana" | "calendar", threadId, channelId },
    { enabled: !!(threadId || channelId) }
  );

  if (!thread.data?.messages?.length) return null;

  return (
    <div className="mt-3 mb-2">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageCircle className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-body uppercase tracking-wider font-medium">
          Conversation
        </span>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg bg-muted/30 p-3">
        {thread.data.messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs font-body ${msg.isUser ? "text-primary" : "text-foreground/70"}`}
          >
            <span className="font-medium">{msg.sender}:</span>{" "}
            <span className="leading-relaxed">{msg.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Expanded Card (Action Panel) ──────────────────────────────────────────

function ExpandedCard({ item }: { item: TriageItem }) {
  const draftReply = trpc.actions.draftReply.useMutation();
  const saveDraftEdit = trpc.actions.saveDraftEdit.useMutation();
  const transcribe = trpc.voice.transcribe.useMutation();
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const [editedDraft, setEditedDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const originalDraftRef = useRef("");

  const meta = item.meta as Record<string, unknown> | undefined;
  const needsDraft =
    (item.priority === "action" || item.priority === "urgent") &&
    (item.platform === "gmail" || item.platform === "slack");

  // Auto-draft for action/urgent items
  useEffect(() => {
    if (needsDraft && !draftReply.data?.draft && !draftReply.isPending) {
      draftReply.mutate({
        id: item.id,
        platform: item.platform,
        title: item.title,
        snippet: item.snippet,
        sender: item.sender,
        channelId: meta?.channelId ? String(meta.channelId) : undefined,
      });
    }
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync draft to edit state
  useEffect(() => {
    if (draftReply.data?.draft) {
      setEditedDraft(draftReply.data.draft);
      originalDraftRef.current = draftReply.data.draft;
      setIsEditing(false);
    }
  }, [draftReply.data?.draft]);

  const handleMicToggle = async () => {
    if (isRecording) {
      const base64 = await stopRecording();
      if (base64) {
        transcribe.mutate(
          { audioBase64: base64, mimeType: "audio/webm" },
          {
            onSuccess: (data) => {
              if (data.text) {
                setEditedDraft((prev) => (prev ? prev + " " + data.text : data.text));
                setIsEditing(true);
              }
            },
          }
        );
      }
    } else {
      await startRecording();
    }
  };

  const handleSendDraft = () => {
    // Save edit for learning if user modified the draft
    if (isEditing && editedDraft !== originalDraftRef.current) {
      saveDraftEdit.mutate({
        platform: item.platform,
        sender: item.sender,
        originalDraft: originalDraftRef.current,
        editedDraft,
        itemTitle: item.title,
      });
    }
    toast.info("Read-only mode — draft copied to clipboard instead");
    navigator.clipboard.writeText(editedDraft);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedDraft || draftReply.data?.draft || "");
    toast.success("Copied to clipboard");
  };

  const handleRegenerate = () => {
    draftReply.mutate({
      id: item.id,
      platform: item.platform,
      title: item.title,
      snippet: item.snippet,
      sender: item.sender,
      channelId: meta?.channelId ? String(meta.channelId) : undefined,
    });
  };

  return (
    <div className="px-4 pb-4 pt-1 border-t border-border/30 bg-card/50">
      {/* Full message content */}
      <p className="text-sm text-foreground/80 font-body leading-relaxed mb-3">
        {item.snippet}
      </p>

      {/* Asana metadata */}
      {item.platform === "asana" && meta?.dueDate ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 font-body">
          <Clock className="h-3 w-3" />
          Due: {String(meta.dueDate)}
          {meta?.permalink ? (
            <>
              <span className="mx-1">·</span>
              <a
                href={String(meta.permalink)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Asana
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Conversation thread context */}
      <ThreadContext
        platform={item.platform}
        threadId={item.threadId}
        channelId={meta?.channelId ? String(meta.channelId) : undefined}
      />

      {/* Draft reply section */}
      {(item.platform === "gmail" || item.platform === "slack") ? (
        <div className="mt-3">
          {draftReply.isPending ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body">Drafting reply...</span>
            </div>
          ) : null}

          {(editedDraft || draftReply.data?.draft) ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-primary font-medium uppercase tracking-wider font-body">
                  Recommended Reply
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleMicToggle}
                    className={`p-1.5 rounded-md transition-colors ${
                      isRecording
                        ? "bg-red-100 text-red-600 animate-pulse"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                    title={isRecording ? "Stop recording" : "Dictate edits"}
                  >
                    {isRecording ? (
                      <MicOff className="h-3.5 w-3.5" />
                    ) : (
                      <Mic className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {transcribe.isPending ? (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="font-body">Transcribing...</span>
                </div>
              ) : null}

              {isEditing ? (
                <Textarea
                  value={editedDraft}
                  onChange={(e) => setEditedDraft(e.target.value)}
                  className="text-sm font-body leading-relaxed min-h-[60px] bg-transparent border-0 p-0 resize-none focus-visible:ring-0 shadow-none"
                  placeholder="Edit your reply..."
                />
              ) : (
                <p
                  className="text-sm text-foreground font-body leading-relaxed cursor-text"
                  onClick={() => setIsEditing(true)}
                >
                  {editedDraft || draftReply.data?.draft}
                </p>
              )}

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={handleSendDraft}
                >
                  <Send className="h-3 w-3" />
                  {isEditing && editedDraft !== originalDraftRef.current
                    ? "Save & Copy"
                    : "Approve & Copy"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleRegenerate}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : null}

          {!draftReply.data?.draft &&
          !draftReply.isPending &&
          !needsDraft ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              className="w-full justify-center gap-2"
            >
              <Zap className="h-3.5 w-3.5" />
              Generate Draft Reply
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Asana recommended action */}
      {item.platform === "asana" &&
      (item.priority === "action" || item.priority === "urgent") ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mt-3">
          <p className="text-[10px] text-amber-700 font-medium mb-1.5 uppercase tracking-wider font-body">
            Recommended Action
          </p>
          <p className="text-sm text-foreground font-body leading-relaxed">
            {meta?.dueDate
              ? `This task is due ${String(meta.dueDate)}. Open in Asana to review and update status.`
              : "Review this task in Asana and update its status."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Feed Card ─────────────────────────────────────────────────────────────

function FeedCard({
  item,
  isExpanded,
  onToggle,
}: {
  item: TriageItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = priorityConfig[item.priority];
  const PlatformIcon = platformIcon[item.platform] ?? Mail;
  const senderDisplay = item.sender
    ? item.sender.split("<")[0].trim()
    : "";

  return (
    <div
      className={`bg-card rounded-lg border border-border/50 overflow-hidden transition-all shadow-sm hover:shadow-md ${
        isExpanded ? "ring-1 ring-primary/20" : ""
      } border-l-[3px] ${config.borderColor}`}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Platform dot */}
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${platformColor[item.platform]}`} />

          <div className="flex-1 min-w-0">
            {/* Top row: badges + time */}
            <div className="flex items-center gap-1.5 mb-1">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${config.color}`}
              >
                {config.label}
              </Badge>
              <span
                className={`text-[9px] px-1.5 py-0 h-4 rounded font-medium shrink-0 inline-flex items-center ${platformBadgeColor[item.platform] ?? "bg-gray-100 text-gray-600"}`}
              >
                {platformLabel[item.platform]}
              </span>
              {senderDisplay ? (
                <span className="text-[11px] text-muted-foreground font-body truncate">
                  {senderDisplay}
                </span>
              ) : null}
              <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0 font-body tabular-nums">
                {formatTime(item.timestamp)}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
            </div>

            {/* Title */}
            <p className="text-sm font-medium text-foreground font-body leading-snug">
              {getDisplayTitle(item)}
            </p>

            {/* Snippet preview — only when collapsed */}
            {!isExpanded ? (
              <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed line-clamp-2">
                {item.snippet}
              </p>
            ) : null}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded ? <ExpandedCard item={item} /> : null}
    </div>
  );
}

// ─── Calendar Strip ────────────────────────────────────────────────────────

function CalendarStrip({ events }: { events: CalendarEvent[] }) {
  const timedEvents = events.filter((e) => !e.isAllDay);
  if (timedEvents.length === 0) return null;

  const now = new Date();

  return (
    <div className="bg-card rounded-lg border border-border/50 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary font-headline tracking-wide uppercase">
          Today's Schedule
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {timedEvents.slice(0, 6).map((event) => {
          const start = new Date(event.startTime);
          const end = new Date(event.endTime);
          const isNow = now >= start && now <= end;
          const isPast = now > end;

          return (
            <div
              key={event.id}
              className={`shrink-0 px-3 py-2 rounded-md text-xs font-body transition-colors border ${
                isNow
                  ? "bg-primary/10 border-primary/30 text-primary font-medium"
                  : isPast
                  ? "bg-muted/30 border-transparent text-muted-foreground/50"
                  : "bg-muted/50 border-transparent text-foreground"
              }`}
            >
              <div className="font-medium tabular-nums">
                {start.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <div className="truncate max-w-[140px]">{event.title}</div>
              {isNow ? (
                <span className="text-[8px] px-1 py-0.5 rounded-full bg-primary text-primary-foreground font-medium mt-1 inline-block">
                  NOW
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Summary ────────────────────────────────────────────────────────────

function AISummary({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-card rounded-lg border border-primary/20 p-4 shadow-sm cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary font-headline tracking-wide uppercase">
          Morning Brief
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto font-body">
          {expanded ? "collapse" : "expand"}
        </span>
      </div>
      {expanded ? (
        <div className="text-sm text-foreground/80 font-body leading-relaxed mt-2 prose prose-sm max-w-none">
          <Streamdown>{summary}</Streamdown>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground font-body truncate">
          {summary.split("\n")[0]?.slice(0, 140)}...
        </p>
      )}
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function OlympusScreen() {
  const { user, logout } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNoise, setShowNoise] = useState(false);

  // Auto-refresh every 60 seconds
  const brief = trpc.brief.generate.useQuery(
    { includeSummary: true },
    {
      enabled: !!user,
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
      staleTime: 30_000,
    }
  );

  const items = brief.data?.items ?? [];
  const calendarEvents = brief.data?.calendarEvents ?? [];
  const stats = brief.data?.stats;
  const aiSummary = items.find((i) => i.aiSummary)?.aiSummary;

  // Filter and sort: urgent first, then action, then info, noise hidden by default
  const visibleItems = useMemo(() => {
    const filtered = showNoise
      ? items
      : items.filter((i) => i.priority !== "noise");
    const order: Record<Priority, number> = {
      urgent: 0,
      action: 1,
      info: 2,
      noise: 3,
    };
    return [...filtered].sort(
      (a, b) => order[a.priority] - order[b.priority]
    );
  }, [items, showNoise]);

  const noiseCount = stats?.noise ?? 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Loading state
  if (brief.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <Skeleton className="h-7 w-28 mb-1" />
              <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-xl font-semibold text-foreground tracking-tight">
                Olympus
              </h1>
              <Badge
                variant="outline"
                className="text-[8px] px-1 py-0 h-3.5 text-muted-foreground border-muted-foreground/30"
              >
                Read-Only
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-body">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            {stats ? (
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-body text-muted-foreground">
                {stats.urgent > 0 ? (
                  <span className="text-red-600 font-medium">
                    {stats.urgent} urgent
                  </span>
                ) : null}
                {stats.action > 0 ? (
                  <span className="text-amber-600">{stats.action} action</span>
                ) : null}
                <span>{stats.total} total</span>
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => brief.refetch()}
              disabled={brief.isFetching}
            >
              {brief.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <button
              onClick={() => logout()}
              className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-headline font-semibold hover:bg-primary/20 transition-colors"
              title="Sign out"
            >
              {user?.name?.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      {/* Feed */}
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* AI Summary */}
        {aiSummary ? <AISummary summary={aiSummary} /> : null}

        {/* Calendar strip */}
        <CalendarStrip events={calendarEvents} />

        {/* Feed controls */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground font-body uppercase tracking-wider">
            Inbox ({visibleItems.length})
          </span>
          {noiseCount > 0 ? (
            <button
              onClick={() => setShowNoise(!showNoise)}
              className="text-[10px] text-muted-foreground hover:text-foreground font-body transition-colors"
            >
              {showNoise ? "Hide" : "Show"} {noiseCount} noise
            </button>
          ) : null}
        </div>

        {/* Feed items */}
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Check className="h-10 w-10 text-primary/30 mb-3" />
            <p className="text-sm text-muted-foreground font-body">
              All clear. Nothing needs your attention.
            </p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              onToggle={() => handleToggle(item.id)}
            />
          ))
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </main>
    </div>
  );
}
