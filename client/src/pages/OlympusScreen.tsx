import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  WifiOff,
  Copy,
} from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
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

const priorityConfig: Record<
  Priority,
  { label: string; color: string; icon: React.ElementType }
> = {
  urgent: {
    label: "Urgent",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: AlertTriangle,
  },
  action: {
    label: "Action",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: ArrowRight,
  },
  info: {
    label: "FYI",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Info,
  },
  noise: {
    label: "Noise",
    color: "bg-gray-50 text-gray-400 border-gray-200",
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

// ─── Feed Item ──────────────────────────────────────────────────────────────

function FeedItem({
  item,
  isSelected,
  onSelect,
}: {
  item: TriageItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = priorityConfig[item.priority];
  const PlatformIcon = platformIcon[item.platform] ?? Mail;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3.5 transition-all border-b border-border/40 hover:bg-accent/40 ${
        isSelected
          ? "bg-primary/5 border-l-2 border-l-primary"
          : "border-l-2 border-l-transparent"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <PlatformIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge
              variant="outline"
              className={`text-[10px] px-1 py-0 h-4 shrink-0 ${config.color}`}
            >
              {config.label}
            </Badge>
            <span className="text-[11px] text-muted-foreground font-body truncate">
              {item.sender
                ? item.sender.split("<")[0].trim()
                : platformLabel[item.platform]}
            </span>
            <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0 font-body">
              {new Date(item.timestamp).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground font-body truncate leading-snug">
            {getDisplayTitle(item)}
          </p>
          <p className="text-xs text-muted-foreground font-body truncate mt-0.5 leading-relaxed">
            {item.snippet.slice(0, 100)}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Calendar Mini ──────────────────────────────────────────────────────────

function CalendarMini({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;

  const timedEvents = events.filter((e) => !e.isAllDay);
  if (timedEvents.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary font-headline tracking-wide uppercase">
          Today's Schedule
        </span>
      </div>
      <div className="space-y-1">
        {timedEvents.slice(0, 5).map((event) => {
          const now = new Date();
          const start = new Date(event.startTime);
          const end = new Date(event.endTime);
          const isNow = now >= start && now <= end;
          const isPast = now > end;

          return (
            <div
              key={event.id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-body transition-colors ${
                isNow
                  ? "bg-primary/8 text-primary font-medium"
                  : isPast
                  ? "text-muted-foreground/50"
                  : "text-foreground"
              }`}
            >
              <span className="w-20 shrink-0 tabular-nums">
                {start.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="truncate">{event.title}</span>
              {isNow ? (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium shrink-0">
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

// ─── Action Panel ───────────────────────────────────────────────────────────

function ActionPanel({
  item: rawItem,
}: {
  item: TriageItem | null;
}) {
  const item = rawItem as TriageItem | null;
  const draftReply = trpc.actions.draftReply.useMutation();
  const [dismissed, setDismissed] = useState(false);

  // Auto-draft for action/urgent items on email/slack
  useEffect(() => {
    if (
      item &&
      (item.priority === "action" || item.priority === "urgent") &&
      (item.platform === "gmail" || item.platform === "slack") &&
      !draftReply.data?.draft &&
      !draftReply.isPending
    ) {
      draftReply.mutate({
        id: item.id,
        platform: item.platform,
        title: item.title,
        snippet: item.snippet,
        sender: item.sender,
      });
    }
    // Reset dismissed state when item changes
    setDismissed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Zap className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground font-body">
          Select an item from the feed to see suggested actions
        </p>
      </div>
    );
  }

  if (dismissed) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Check className="h-8 w-8 text-primary mb-3" />
        <p className="text-sm text-muted-foreground font-body">
          Done. Select another item.
        </p>
      </div>
    );
  }

  const config = priorityConfig[item.priority];
  const PlatformIcon = platformIcon[item.platform] ?? Mail;
  const meta = item.meta as Record<string, unknown> | undefined;
  const senderStr = String(item.sender ?? "");

  const handleDraft = () => {
    draftReply.mutate({
      id: item.id,
      platform: item.platform,
      title: item.title,
      snippet: item.snippet,
      sender: item.sender,
    });
  };

  const handleMarkDone = () => {
    toast.info("Read-only mode — no changes made to your accounts");
    setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    toast("Dismissed");
  };

  const handleCopyDraft = () => {
    if (draftReply.data?.draft) {
      navigator.clipboard.writeText(draftReply.data.draft);
      toast.success("Draft copied to clipboard");
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <PlatformIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-body">
          {platformLabel[item.platform]}
        </span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${config.color}`}
        >
          {config.label}
        </Badge>
      </div>

      <h2 className="font-headline text-lg font-semibold text-foreground leading-snug mb-1">
        {getDisplayTitle(item)}
      </h2>

      {senderStr.length > 0 ? (
        <p className="text-xs text-muted-foreground font-body mb-3">
          From: {senderStr}
        </p>
      ) : null}

      {/* Asana metadata */}
      {item.platform === "asana" && meta?.dueDate ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 font-body">
          <Clock className="h-3 w-3" />
          Due: {String(meta.dueDate)}
          {meta?.permalink ? (
            <>
              <span className="mx-1">&middot;</span>
              <a
                href={String(meta.permalink)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      <Separator className="my-3" />

      {/* Content */}
      <p className="text-sm text-foreground/80 font-body leading-relaxed mb-4">
        {item.snippet}
      </p>

      {/* AI Draft — auto-generates for action/urgent emails */}
      {(item.platform === "gmail" || item.platform === "slack") ? (
        <div className="mb-4">
          {draftReply.isPending ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body">Drafting reply...</span>
            </div>
          ) : null}

          {draftReply.data?.draft ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
              <p className="text-[10px] text-primary font-medium mb-2 uppercase tracking-wider font-body">
                Recommended Reply
              </p>
              <p className="text-sm text-foreground font-body leading-relaxed">
                {draftReply.data.draft}
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={handleCopyDraft}
                >
                  <Copy className="h-3 w-3" />
                  Copy to Clipboard
                </Button>
                <Button variant="outline" size="sm" onClick={handleDraft}>
                  Regenerate
                </Button>
              </div>
            </div>
          ) : null}

          {!draftReply.data?.draft &&
          !draftReply.isPending &&
          item.priority !== "action" &&
          item.priority !== "urgent" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDraft}
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 mb-4">
          <p className="text-[10px] text-amber-700 font-medium mb-2 uppercase tracking-wider font-body">
            Recommended Action
          </p>
          <p className="text-sm text-foreground font-body leading-relaxed">
            {meta?.dueDate
              ? `This task is due ${String(meta.dueDate)}. Open in Asana to review and update status.`
              : "Review this task in Asana and update its status."}
          </p>
          {meta?.permalink ? (
            <a
              href={String(meta.permalink)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline font-body"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Asana
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={handleMarkDone}
        >
          <Check className="h-3.5 w-3.5" />
          Done
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={handleDismiss}
        >
          <X className="h-3.5 w-3.5" />
          Skip
        </Button>
      </div>
    </div>
  );
}

// ─── AI Summary Banner ──────────────────────────────────────────────────────

function SummaryBanner({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="px-4 py-3 bg-primary/5 border-b border-primary/10 cursor-pointer hover:bg-primary/8 transition-colors shrink-0"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary font-headline tracking-wide uppercase">
          AI Brief
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto font-body">
          {expanded ? "click to collapse" : "click to expand"}
        </span>
      </div>
      {expanded ? (
        <div className="text-sm text-foreground/80 font-body leading-relaxed mt-2 prose prose-sm max-w-none">
          <Streamdown>{summary}</Streamdown>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground font-body truncate">
          {summary.split("\n")[0]?.slice(0, 120)}...
        </p>
      )}
    </div>
  );
}

// ─── Slack Notice ───────────────────────────────────────────────────────────

function SlackNotice() {
  return (
    <div className="mx-3 mb-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-2">
      <WifiOff className="h-3.5 w-3.5 text-amber-600 shrink-0" />
      <span className="text-[11px] text-amber-700 font-body">
        Slack not connected — re-authorize to include Slack messages
      </span>
    </div>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function OlympusScreen() {
  const { user, logout } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNoise, setShowNoise] = useState(false);

  const brief = trpc.brief.generate.useQuery(
    { includeSummary: true },
    {
      enabled: !!user,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  );

  const items = brief.data?.items ?? [];
  const calendarEvents = brief.data?.calendarEvents ?? [];
  const stats = brief.data?.stats;
  const aiSummary = items.find((i) => i.aiSummary)?.aiSummary;

  // Check if Slack data is present
  const hasSlackItems = items.some((i) => i.platform === "slack");

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

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;
  const noiseCount = stats?.noise ?? 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Loading state
  if (brief.isLoading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            <Skeleton className="h-7 w-32 mb-1" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>
        <div className="flex-1 flex">
          <div className="w-1/2 border-r border-border/50 p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
          <div className="w-1/2 p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border/50 shrink-0">
        <div>
          <h1 className="font-headline text-xl font-semibold text-foreground tracking-tight">
            Olympus
          </h1>
          <p className="text-[11px] text-muted-foreground font-body">
            {dateStr}
          </p>
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30 mt-0.5"
          >
            Read-Only
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {stats ? (
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-body text-muted-foreground">
              {stats.urgent > 0 ? (
                <span className="text-red-600 font-medium">
                  {stats.urgent} urgent
                </span>
              ) : null}
              {stats.action > 0 ? (
                <span className="text-amber-600">
                  {stats.action} action
                </span>
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
      </header>

      {/* AI Summary Banner */}
      {aiSummary ? <SummaryBanner summary={aiSummary} /> : null}

      {/* Two-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT: Feed — uses native overflow-y-auto instead of ScrollArea */}
        <div className="w-full md:w-1/2 lg:w-[45%] border-r border-border/50 flex flex-col min-h-0">
          {/* Calendar mini */}
          <div className="px-3 pt-3 shrink-0">
            <CalendarMini events={calendarEvents} />
          </div>

          {/* Slack reconnect notice */}
          {!hasSlackItems ? (
            <div className="shrink-0">
              <SlackNotice />
            </div>
          ) : null}

          {/* Feed controls */}
          <div className="flex items-center justify-between px-3 py-2 shrink-0">
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

          {/* Feed list — native scroll */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <Check className="h-10 w-10 text-primary/30 mb-3" />
                <p className="text-sm text-muted-foreground font-body">
                  All clear. Nothing needs your attention.
                </p>
              </div>
            ) : (
              visibleItems.map((item) => (
                <FeedItem
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Action Panel */}
        <div className="hidden md:flex md:w-1/2 lg:w-[55%] flex-col min-h-0">
          <ActionPanel item={selectedItem} />
        </div>
      </div>
    </div>
  );
}
