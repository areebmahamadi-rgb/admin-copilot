import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Eye,
  Reply,
  Briefcase,
  MapPin,
  Users,
  Link,
} from "lucide-react";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";
import type { TriageItem, CalendarEvent, Priority, Column } from "@shared/types";
import { toast } from "sonner";

// Session-level draft cache — avoids repeat AI calls when reopening cards
const sessionDraftCache = new Map<string, string>();

// ─── Platform Icons (SVG, no extra package) ─────────────────────────────────
function GmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" fill="#fff" stroke="#EA4335" strokeWidth="1.5"/>
      <path d="M2 6l10 7 10-7" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#4A154B"/>
      <path d="M8.5 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 1.5a3 3 0 01-3-3H4a4.5 4.5 0 004.5 4.5V15zm0-6V7.5a1.5 1.5 0 013 0V9h1.5V7.5a3 3 0 00-6 0V9H8.5zm7 3a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 1.5V15a4.5 4.5 0 004.5-4.5H18.5a3 3 0 01-3 3zm0-6V7.5a3 3 0 00-6 0V9H11v-.5a1.5 1.5 0 013 0V9h1.5z" fill="#fff"/>
    </svg>
  );
}
function AsanaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="4" fill="#F06A6A"/>
      <circle cx="6" cy="16" r="4" fill="#F06A6A"/>
      <circle cx="18" cy="16" r="4" fill="#F06A6A"/>
    </svg>
  );
}
function CalendarIcon2({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="18" rx="3" fill="#4285F4"/>
      <path d="M3 9h18" stroke="#fff" strokeWidth="1.5"/>
      <rect x="8" y="2" width="2" height="4" rx="1" fill="#4285F4" stroke="#4285F4" strokeWidth="0.5"/>
      <rect x="14" y="2" width="2" height="4" rx="1" fill="#4285F4" stroke="#4285F4" strokeWidth="0.5"/>
      <circle cx="8" cy="14" r="1.5" fill="#fff"/>
      <circle cx="12" cy="14" r="1.5" fill="#fff"/>
      <circle cx="16" cy="14" r="1.5" fill="#fff"/>
    </svg>
  );
}
const PlatformIcon: Record<string, React.FC<{ className?: string }>> = {
  gmail: GmailIcon,
  slack: SlackIcon,
  asana: AsanaIcon,
  calendar: CalendarIcon2,
};

// ─── Config ──────────────────────────────────────────────────────────────────
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
const priorityConfig: Record<Priority, { label: string; color: string; borderColor: string }> = {
  urgent: { label: "Urgent", color: "bg-red-50 text-red-700 border-red-200", borderColor: "border-l-red-500" },
  action: { label: "Action", color: "bg-amber-50 text-amber-700 border-amber-200", borderColor: "border-l-amber-500" },
  info:   { label: "FYI",    color: "bg-blue-50 text-blue-700 border-blue-200",   borderColor: "border-l-blue-400" },
  noise:  { label: "Noise",  color: "bg-gray-50 text-gray-400 border-gray-200",   borderColor: "border-l-gray-300" },
};
const columnConfig: Record<Column, { label: string; icon: React.ElementType; description: string; headerClass: string }> = {
  fyi:     { label: "FYI",       icon: Eye,      description: "Awareness only",           headerClass: "text-blue-600 border-blue-200 bg-blue-50/60" },
  respond: { label: "Respond",   icon: Reply,    description: "Needs reply or decision",  headerClass: "text-amber-600 border-amber-200 bg-amber-50/60" },
  work:    { label: "Deep Work", icon: Briefcase,description: "Requires focused attention",headerClass: "text-teal-600 border-teal-200 bg-teal-50/60" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDisplayTitle(item: TriageItem): string {
  const meta = item.meta as Record<string, unknown> | undefined;
  if (meta?.cleanTitle && typeof meta.cleanTitle === "string") return meta.cleanTitle;
  return item.title.replace(/^(Re:\s*|Fw:\s*|Fwd:\s*)+/i, "").trim() || item.title;
}
function formatDate(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Context Chips (zero LLM cost) ────────────────────────────────────────────
function ContextChip({ item }: { item: TriageItem }) {
  const meta = item.meta as Record<string, unknown> | undefined;

  if (item.platform === "asana") {
    const dueDate = meta?.dueDate ? String(meta.dueDate) : null;
    const permalink = meta?.permalink ? String(meta.permalink) : null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {dueDate && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-body">
            <Clock className="h-2.5 w-2.5" />Due {dueDate}
          </span>
        )}
        {permalink && (
          <a href={permalink} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-body">
            <Link className="h-2.5 w-2.5" />Open in Asana
          </a>
        )}
      </div>
    );
  }

  if (item.platform === "slack") {
    const channelName = meta?.channelName ? String(meta.channelName) : null;
    const isDM = meta?.isDM === true;
    const threadMessages = meta?.threadMessages as Array<{ sender: string; text: string }> | undefined;
    const msgCount = threadMessages?.length ?? 0;
    const permalink = meta?.permalink ? String(meta.permalink) : null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {isDM ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 font-body">
            <MessageSquare className="h-2.5 w-2.5" />DM
          </span>
        ) : channelName ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 font-body">
            <MessageSquare className="h-2.5 w-2.5" />#{channelName}
          </span>
        ) : null}
        {msgCount > 1 && (
          <span className="text-[10px] text-muted-foreground font-body">{msgCount} messages</span>
        )}
        {permalink && (
          <a href={permalink} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-body">
            <ExternalLink className="h-2.5 w-2.5" />Slack
          </a>
        )}
      </div>
    );
  }

  if (item.platform === "gmail") {
    const hasAttachments = meta?.hasAttachments === true;
    const isReply = meta?.isReply === true;
    const to = meta?.to ? String(meta.to) : null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {isReply && (
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-body">
            <Reply className="h-2.5 w-2.5" />Thread
          </span>
        )}
        {hasAttachments && (
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-body">
            📎 Attachment
          </span>
        )}
        {to && (
          <span className="text-[10px] text-muted-foreground font-body truncate max-w-[160px]">
            To: {to.split("<")[0].trim()}
          </span>
        )}
      </div>
    );
  }
  return null;
}

// ─── Conversation Preview (collapsed Slack threads, zero LLM) ─────────────────
function ConversationPreview({ item }: { item: TriageItem }) {
  const meta = item.meta as Record<string, unknown> | undefined;
  const msgs = meta?.threadMessages as Array<{ sender: string; text: string }> | undefined;
  if (!msgs || msgs.length <= 1) return null;
  const preview = msgs.slice(-3, -1);
  if (!preview.length) return null;
  return (
    <div className="mt-2 space-y-1 border-l-2 border-muted pl-2">
      {preview.map((msg, i) => (
        <p key={i} className="text-[10px] text-muted-foreground font-body leading-relaxed line-clamp-1">
          <span className="font-medium text-foreground/60">{msg.sender.split(" ")[0]}:</span>{" "}
          {msg.text.slice(0, 80)}{msg.text.length > 80 ? "…" : ""}
        </p>
      ))}
    </div>
  );
}

// ─── Voice Recorder Hook ──────────────────────────────────────────────────────
function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch { toast.error("Microphone access denied"); }
  }, []);
  const stopRecording = useCallback((): Promise<string> => {
    return new Promise(resolve => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") { setIsRecording(false); resolve(""); return; }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1] ?? "";
          setIsRecording(false);
          recorder.stream.getTracks().forEach(t => t.stop());
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      };
      recorder.stop();
    });
  }, []);
  return { isRecording, startRecording, stopRecording };
}

// ─── Thread Context (expanded) ────────────────────────────────────────────────
function ThreadContext({ platform, threadId, channelId }: { platform: string; threadId?: string; channelId?: string }) {
  const thread = trpc.thread.messages.useQuery(
    { platform: platform as "gmail" | "slack" | "asana" | "calendar", threadId, channelId },
    { enabled: !!(threadId || channelId) }
  );
  if (!thread.data?.messages?.length) return null;
  return (
    <div className="mt-3 mb-2">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageCircle className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-body uppercase tracking-wider font-medium">Conversation</span>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg bg-muted/30 p-3">
        {thread.data.messages.map((msg, i) => (
          <div key={i} className={`text-xs font-body ${msg.isUser ? "text-primary" : "text-foreground/70"}`}>
            <span className="font-medium">{msg.sender}:</span>{" "}
            <span className="leading-relaxed">{typeof msg.text === 'string' ? msg.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : String(msg.text)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Expanded Card ────────────────────────────────────────────────────────────
function ExpandedCard({ item }: { item: TriageItem }) {
  const draftReply = trpc.actions.draftReply.useMutation();
  const saveDraftEdit = trpc.actions.saveDraftEdit.useMutation();
  const transcribe = trpc.voice.transcribe.useMutation();
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const [editedDraft, setEditedDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const originalDraftRef = useRef("");
  const meta = item.meta as Record<string, unknown> | undefined;
  const needsDraft = (item.priority === "action" || item.priority === "urgent") &&
    (item.platform === "gmail" || item.platform === "slack");

  useEffect(() => {
    if (needsDraft && !draftReply.data?.draft && !draftReply.isPending) {
      draftReply.mutate({ id: item.id, platform: item.platform, title: item.title, snippet: item.snippet, sender: item.sender, channelId: meta?.channelId ? String(meta.channelId) : undefined });
    }
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draftReply.data?.draft) { setEditedDraft(draftReply.data.draft); originalDraftRef.current = draftReply.data.draft; setIsEditing(false); }
  }, [draftReply.data?.draft]);

  const handleMicToggle = async () => {
    if (isRecording) {
      const base64 = await stopRecording();
      if (base64) transcribe.mutate({ audioBase64: base64, mimeType: "audio/webm" }, { onSuccess: d => { if (d.text) { setEditedDraft(p => p ? p + " " + d.text : d.text); setIsEditing(true); } } });
    } else await startRecording();
  };
  const handleSendDraft = () => {
    if (isEditing && editedDraft !== originalDraftRef.current)
      saveDraftEdit.mutate({ platform: item.platform, sender: item.sender, originalDraft: originalDraftRef.current, editedDraft, itemTitle: item.title });
    toast.info("Read-only mode — draft copied to clipboard instead");
    navigator.clipboard.writeText(editedDraft);
  };
  const handleCopy = () => { navigator.clipboard.writeText(editedDraft || draftReply.data?.draft || ""); toast.success("Copied to clipboard"); };
  const handleRegenerate = () => draftReply.mutate({ id: item.id, platform: item.platform, title: item.title, snippet: item.snippet, sender: item.sender, channelId: meta?.channelId ? String(meta.channelId) : undefined });

  return (
    <div className="px-4 pb-4 pt-1 border-t border-border/30 bg-card/50">
      <p className="text-sm text-foreground/80 font-body leading-relaxed mb-3 whitespace-pre-wrap">{item.snippet}</p>
      {item.platform === "asana" && meta?.dueDate ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 font-body">
          <Clock className="h-3 w-3" />Due: {String(meta.dueDate)}
          {meta?.permalink != null && <><span className="mx-1">·</span><a href={String(meta.permalink)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5"><ExternalLink className="h-3 w-3" />Open in Asana</a></>}
        </div>
      ) : null}
      <ThreadContext platform={item.platform} threadId={item.threadId} channelId={meta?.channelId ? String(meta.channelId) : undefined} />
      {(item.platform === "gmail" || item.platform === "slack") ? (
        <div className="mt-3">
          {draftReply.isPending && <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span className="font-body">Drafting reply...</span></div>}
          {(editedDraft || draftReply.data?.draft) ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-primary font-medium uppercase tracking-wider font-body">Recommended Reply</p>
                <button onClick={handleMicToggle} className={`p-1.5 rounded-md transition-colors ${isRecording ? "bg-red-100 text-red-600 animate-pulse" : "hover:bg-muted text-muted-foreground"}`} title={isRecording ? "Stop" : "Dictate"}>
                  {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </button>
              </div>
              {transcribe.isPending && <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /><span className="font-body">Transcribing...</span></div>}
              {isEditing ? (
                <Textarea value={editedDraft} onChange={e => setEditedDraft(e.target.value)} className="text-sm font-body leading-relaxed min-h-[60px] bg-transparent border-0 p-0 resize-none focus-visible:ring-0 shadow-none" placeholder="Edit your reply..." />
              ) : (
                <p className="text-sm text-foreground font-body leading-relaxed cursor-text" onClick={() => setIsEditing(true)}>{editedDraft || draftReply.data?.draft}</p>
              )}
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="flex-1 gap-1.5" onClick={handleSendDraft}><Send className="h-3 w-3" />{isEditing && editedDraft !== originalDraftRef.current ? "Save & Copy" : "Approve & Copy"}</Button>
                <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" onClick={handleRegenerate}><RefreshCw className="h-3 w-3" /></Button>
              </div>
            </div>
          ) : null}
          {!draftReply.data?.draft && !draftReply.isPending && !needsDraft && (
            <Button variant="outline" size="sm" onClick={handleRegenerate} className="w-full justify-center gap-2"><Zap className="h-3.5 w-3.5" />Generate Draft Reply</Button>
          )}
        </div>
      ) : null}
      {item.platform === "asana" && (item.priority === "action" || item.priority === "urgent") ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mt-3">
          <p className="text-[10px] text-amber-700 font-medium mb-1.5 uppercase tracking-wider font-body">Recommended Action</p>
          <p className="text-sm text-foreground font-body leading-relaxed">{meta?.dueDate ? `This task is due ${String(meta.dueDate)}. Open in Asana to review and update status.` : "Review this task in Asana and update its status."}</p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Inline Draft (Respond column — zero-expand UX) ────────────────────────────────────────────────────
function InlineDraft({ item }: { item: TriageItem }) {
  const draftReply = trpc.actions.draftReply.useMutation();
  const saveDraftEdit = trpc.actions.saveDraftEdit.useMutation();
  // Use session cache to avoid re-generating on every render
  const cached = sessionDraftCache.get(item.id);
  const [editedDraft, setEditedDraft] = useState(cached ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const originalDraftRef = useRef(cached ?? "");
  const meta = item.meta as Record<string, unknown> | undefined;

  useEffect(() => {
    // Only call AI if not already cached
    if (!cached && !draftReply.data?.draft && !draftReply.isPending) {
      draftReply.mutate({ id: item.id, platform: item.platform, title: item.title, snippet: item.snippet, sender: item.sender, channelId: meta?.channelId ? String(meta.channelId) : undefined });
    }
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draftReply.data?.draft) {
      setEditedDraft(draftReply.data.draft);
      originalDraftRef.current = draftReply.data.draft;
      sessionDraftCache.set(item.id, draftReply.data.draft); // Cache for session
    }
  }, [draftReply.data?.draft, item.id]);

  if (isDismissed) return null;

  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing && editedDraft !== originalDraftRef.current)
      saveDraftEdit.mutate({ platform: item.platform, sender: item.sender, originalDraft: originalDraftRef.current, editedDraft, itemTitle: item.title });
    toast.info("Read-only mode — draft copied to clipboard");
    navigator.clipboard.writeText(editedDraft || draftReply.data?.draft || "");
  };
  const handleDismiss = (e: React.MouseEvent) => { e.stopPropagation(); setIsDismissed(true); };

  return (
    <div className="mx-3 mb-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5" onClick={e => e.stopPropagation()}>
      {draftReply.isPending && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" /><span className="font-body">Drafting reply…</span>
        </div>
      )}
      {(editedDraft || draftReply.data?.draft) && (
        <>
          <p className="text-[10px] text-primary font-medium uppercase tracking-wider font-body mb-1.5">Recommended Reply</p>
          {isEditing ? (
            <Textarea value={editedDraft} onChange={e => setEditedDraft(e.target.value)}
              className="text-xs font-body leading-relaxed min-h-[48px] bg-transparent border-0 p-0 resize-none focus-visible:ring-0 shadow-none mb-2"
              placeholder="Edit reply…" onClick={e => e.stopPropagation()} />
          ) : (
            <p className="text-xs text-foreground font-body leading-relaxed mb-2 cursor-text line-clamp-2" onClick={() => setIsEditing(true)}>
              {editedDraft || draftReply.data?.draft}
            </p>
          )}
          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={handleApprove}>
              <Check className="h-3 w-3" />{isEditing && editedDraft !== originalDraftRef.current ? "Save & Copy" : "Approve & Copy"}
            </Button>
            {!isEditing && (
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={handleDismiss} title="Dismiss">
              ×
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Feed Card ────────────────────────────────────────────────────────────────
function FeedCard({ item, isExpanded, onToggle, showInlineDraft, col }: { item: TriageItem; isExpanded: boolean; onToggle: () => void; showInlineDraft?: boolean; col?: Column }) {
  const config = priorityConfig[item.priority];
  const senderDisplay = item.sender ? item.sender.split("<")[0].trim() : "";
  return (
    <div className={`bg-card rounded-lg border border-border/50 overflow-hidden transition-all shadow-sm hover:shadow-md border-l-[3px] ${config.borderColor} ${isExpanded ? "ring-1 ring-primary/20" : ""}`}>
      <button onClick={onToggle} className="w-full text-left px-3 py-3 hover:bg-accent/30 transition-colors">
        <div className="flex items-start gap-2.5">
          {/* Platform icon — prominent top-left */}
          {(() => { const Icon = PlatformIcon[item.platform]; return Icon ? <Icon className="w-5 h-5 shrink-0 mt-0.5" /> : <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${platformColor[item.platform]}`} />; })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${config.color}`}>{config.label}</Badge>
              {senderDisplay && <span className="text-[11px] text-muted-foreground font-body truncate">{senderDisplay}</span>}
              <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0 font-body tabular-nums">{formatDate(item.timestamp)}</span>
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            </div>
            <p className="text-sm font-medium text-foreground font-body leading-snug">{getDisplayTitle(item)}</p>
            {/* Snippet always visible — 2 lines */}
            <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed line-clamp-2">{item.snippet}</p>
            {/* Context chips — zero LLM cost */}
            <ContextChip item={item} />
            {/* Slack thread preview when collapsed */}
            {!isExpanded && item.platform === "slack" && <ConversationPreview item={item} />}
          </div>
        </div>
      </button>
      {isExpanded && <ExpandedCard item={item} />}
      {/* Inline draft visible on Respond cards without expanding */}
      {!isExpanded && showInlineDraft && (item.priority === "action" || item.priority === "urgent") &&
        (item.platform === "gmail" || item.platform === "slack") && (
        <InlineDraft item={item} />
      )}
      {/* FYI quick actions — visible on FYI column cards */}
      {!isExpanded && col === "fyi" && (
        <div className="flex gap-1.5 px-3 pb-2.5" onClick={e => e.stopPropagation()}>
          <button onClick={e => { e.stopPropagation(); toast.success("Marked as read"); }} className="text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground font-body transition-colors flex items-center gap-1"><Check className="h-2.5 w-2.5" />Mark read</button>
          <button onClick={e => { e.stopPropagation(); toast.info("Moved to Respond"); }} className="text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground font-body transition-colors flex items-center gap-1"><ArrowRight className="h-2.5 w-2.5" />Respond</button>
          <button onClick={e => { e.stopPropagation(); toast.info("Moved to Deep Work"); }} className="text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground font-body transition-colors flex items-center gap-1"><Briefcase className="h-2.5 w-2.5" />Deep Work</button>
        </div>
      )}
    </div>
  );
}

// ─── Column Component ─────────────────────────────────────────────────────────
function ColumnPanel({ col, items, expandedId, onToggle }: { col: Column; items: TriageItem[]; expandedId: string | null; onToggle: (id: string) => void }) {
  const cfg = columnConfig[col];
  const ColIcon = cfg.icon;
  const urgentCount = items.filter(i => i.priority === "urgent").length;
  const actionCount = items.filter(i => i.priority === "action").length;
  return (
    <div className="flex flex-col min-w-0 flex-1">
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border mb-3 sticky top-[57px] z-10 backdrop-blur-sm ${cfg.headerClass}`}>
        <ColIcon className="h-3.5 w-3.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold font-headline tracking-wide uppercase">{cfg.label}</span>
          <span className="text-[10px] font-body opacity-60 ml-2 hidden sm:inline">{cfg.description}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {urgentCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium font-body">{urgentCount} urgent</span>}
          {actionCount > 0 && col !== "fyi" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium font-body">{actionCount}</span>}
          <span className="text-[10px] opacity-60 font-body font-medium">{items.length}</span>
        </div>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Check className="h-7 w-7 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground/50 font-body">All clear</p>
          </div>
        ) : items.map(item => (
          <FeedCard key={item.id} item={item} isExpanded={expandedId === item.id} onToggle={() => onToggle(item.id)} showInlineDraft={col === "respond"} col={col} />
        ))}
      </div>
    </div>
  );
}

// ─── Calendar Strip ───────────────────────────────────────────────────────────
function CalendarStrip({ events }: { events: CalendarEvent[] }) {
  const timedEvents = events.filter(e => !e.isAllDay);
  if (!timedEvents.length) return null;
  const now = new Date();
  return (
    <div className="bg-card rounded-lg border border-border/50 p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary font-headline tracking-wide uppercase">Today's Schedule</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {timedEvents.slice(0, 6).map(event => {
          const start = new Date(event.startTime);
          const end = new Date(event.endTime);
          const isNow = now >= start && now <= end;
          const isPast = now > end;
          return (
            <div key={event.id} className={`shrink-0 px-3 py-2 rounded-md text-xs font-body border ${isNow ? "bg-primary/10 border-primary/30 text-primary font-medium" : isPast ? "bg-muted/30 border-transparent text-muted-foreground/50" : "bg-muted/50 border-transparent text-foreground"}`}>
              <div className="font-medium tabular-nums">{start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
              <div className="truncate max-w-[140px]">{event.title}</div>
              {event.location && <div className="flex items-center gap-0.5 text-[9px] opacity-60 mt-0.5"><MapPin className="h-2 w-2" /><span className="truncate max-w-[120px]">{event.location}</span></div>}
              {event.attendees && event.attendees.length > 1 && <div className="flex items-center gap-0.5 text-[9px] opacity-60 mt-0.5"><Users className="h-2 w-2" /><span>{event.attendees.length} attendees</span></div>}
              {isNow && <span className="text-[8px] px-1 py-0.5 rounded-full bg-primary text-primary-foreground font-medium mt-1 inline-block">NOW</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Summary ───────────────────────────────────────────────────────────────
function AISummary({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false);
  // Parse bullet lines from the summary for clean default display
  const allLines = summary.split("\n").filter(l => l.trim().length > 0);
  const bulletLines = allLines.filter(l => /^[-•*]|^\d+\./.test(l.trim()));
  const previewItems = (bulletLines.length >= 2 ? bulletLines : allLines).slice(0, 4);
  const hasMore = allLines.length > 4;
  return (
    <div className="bg-card rounded-lg border border-primary/20 p-3 shadow-sm cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary font-headline tracking-wide uppercase">Morning Brief</span>
        {hasMore && <span className="text-[10px] text-muted-foreground ml-auto font-body">{expanded ? "show less" : "read more"}</span>}
      </div>
      {expanded ? (
        <div className="text-sm text-foreground/80 font-body leading-relaxed mt-1 prose prose-sm max-w-none"><Streamdown>{summary}</Streamdown></div>
      ) : (
        <ul className="space-y-1">
          {previewItems.map((line, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/75 font-body leading-relaxed">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{line.replace(/^[-•*]\s*|^\d+\.\s*/, "")}</span>
            </li>
          ))}
          {hasMore && <li className="text-[10px] text-muted-foreground font-body pl-3">…tap to read more</li>}
        </ul>
      )}
    </div>
  );
}

// ─── Mobile Tab Bar ───────────────────────────────────────────────────────────
function MobileTabBar({ activeCol, onChange, counts }: { activeCol: Column; onChange: (c: Column) => void; counts: Record<Column, number> }) {
  const cols: Column[] = ["fyi", "respond", "work"];
  return (
    <div className="flex border-b border-border/50 bg-background/95 backdrop-blur sticky top-[57px] z-10 lg:hidden">
      {cols.map(col => {
        const cfg = columnConfig[col];
        const ColIcon = cfg.icon;
        const isActive = activeCol === col;
        return (
          <button key={col} onClick={() => onChange(col)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-body font-medium transition-colors border-b-2 ${isActive ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}>
            <ColIcon className="h-4 w-4" />
            <span className="uppercase tracking-wide">{cfg.label}</span>
            {counts[col] > 0 && <span className={`text-[9px] px-1 rounded-full ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{String(counts[col])}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OlympusScreen() {
  const { user, logout } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCol, setActiveCol] = useState<Column>("respond");

  const brief = trpc.brief.generate.useQuery(
    { includeSummary: true },
    { enabled: !!user, refetchOnWindowFocus: true, refetchInterval: 60_000, staleTime: 30_000 }
  );

  const items = brief.data?.items ?? [];
  const calendarEvents = brief.data?.calendarEvents ?? [];
  const stats = brief.data?.stats;
  const aiSummary = items.find(i => i.aiSummary)?.aiSummary;

  const sortedItems = useMemo(() => {
    const order: Record<Priority, number> = { urgent: 0, action: 1, info: 2, noise: 3 };
    return [...items].sort((a, b) => order[a.priority] - order[b.priority]);
  }, [items]);

  const fyiItems     = useMemo(() => sortedItems.filter(i => i.column === "fyi"),     [sortedItems]);
  const respondItems = useMemo(() => sortedItems.filter(i => i.column === "respond"), [sortedItems]);
  const workItems    = useMemo(() => sortedItems.filter(i => i.column === "work"),    [sortedItems]);

  const columnCounts: Record<Column, number> = { fyi: fyiItems.length, respond: respondItems.length, work: workItems.length };

  // Fallback summary — zero AI cost, always visible even if AI summary unavailable
  const fallbackSummary = stats ? [
    stats.urgent > 0 ? `• ${stats.urgent} urgent item${stats.urgent > 1 ? 's' : ''} need your attention` : null,
    stats.action > 0 ? `• ${stats.action} item${stats.action > 1 ? 's' : ''} waiting for your response` : null,
    respondItems.length > 0 ? `• Top respond: ${respondItems[0]?.title ?? ''}` : null,
    workItems.length > 0 ? `• Deep work: ${workItems[0]?.title ?? ''}` : null,
    fyiItems.length > 0 ? `• ${fyiItems.length} FYI items to review` : null,
  ].filter(Boolean).join('\n') : null;

  const handleToggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  if (brief.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div><Skeleton className="h-7 w-28 mb-1" /><Skeleton className="h-4 w-44" /></div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(col => (
              <div key={col} className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-xl font-semibold text-foreground tracking-tight">Olympus</h1>
              {/* Read-Only badge removed — write actions enabled */}
            </div>
            <p className="text-[11px] text-muted-foreground font-body">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-body text-muted-foreground">
                {stats.urgent > 0 && <span className="text-red-600 font-medium">{stats.urgent} urgent</span>}
                {stats.action > 0 && <span className="text-amber-600">{stats.action} action</span>}
                <span>{stats.total} total</span>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => brief.refetch()} disabled={brief.isFetching}>
              {brief.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <button onClick={() => logout()} className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-headline font-semibold hover:bg-primary/20 transition-colors" title="Sign out">
              {user?.name?.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile tab bar */}
      <MobileTabBar activeCol={activeCol} onChange={setActiveCol} counts={columnCounts} />

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Top strip: AI brief + calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
          {(aiSummary || fallbackSummary) && <AISummary summary={aiSummary ?? fallbackSummary ?? ""} />}
          <CalendarStrip events={calendarEvents} />
        </div>

        {/* Three-column (desktop) */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4">
          <ColumnPanel col="fyi"     items={fyiItems}     expandedId={expandedId} onToggle={handleToggle} />
          <ColumnPanel col="respond" items={respondItems} expandedId={expandedId} onToggle={handleToggle} />
          <ColumnPanel col="work"    items={workItems}    expandedId={expandedId} onToggle={handleToggle} />
        </div>

        {/* Single column with tabs (mobile) */}
        <div className="lg:hidden">
          {activeCol === "fyi"     && <ColumnPanel col="fyi"     items={fyiItems}     expandedId={expandedId} onToggle={handleToggle} />}
          {activeCol === "respond" && <ColumnPanel col="respond" items={respondItems} expandedId={expandedId} onToggle={handleToggle} />}
          {activeCol === "work"    && <ColumnPanel col="work"    items={workItems}    expandedId={expandedId} onToggle={handleToggle} />}
        </div>

        <div className="h-8" />
      </main>
    </div>
  );
}
