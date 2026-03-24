import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Mail,
  MessageSquare,
  CheckSquare,
  Calendar,
  ChevronDown,
  AlertTriangle,
  ArrowRight,
  Info,
  VolumeX,
  RefreshCw,
  Sparkles,
  CheckCheck,
  Reply,
  Loader2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Streamdown } from "streamdown";
import type { TriageItem, CalendarEvent, Priority } from "@shared/types";

const HERO_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663423565535/NT3x8MXBWwc5MqpUfjHM7d/morning-brief-hero_01ea6942.png";
const EMPTY_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663423565535/NT3x8MXBWwc5MqpUfjHM7d/empty-state-illustration_8c4673a9.png";

const platformIcon = {
  gmail: Mail,
  slack: MessageSquare,
  asana: CheckSquare,
  calendar: Calendar,
};

const priorityConfig: Record<
  Priority,
  { label: string; color: string; icon: React.ElementType }
> = {
  urgent: {
    label: "Urgent",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: AlertTriangle,
  },
  action: {
    label: "Action Needed",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: ArrowRight,
  },
  info: {
    label: "FYI",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Info,
  },
  noise: {
    label: "Noise",
    color: "bg-gray-100 text-gray-500 border-gray-200",
    icon: VolumeX,
  },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function EditionHeader() {
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  return (
    <div className="relative overflow-hidden rounded-xl mb-8">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      />
      <div className="relative px-6 py-8 lg:px-8 lg:py-10">
        <p className="text-sm text-muted-foreground font-body uppercase tracking-widest mb-1">
          {greeting} Brief
        </p>
        <h1 className="font-headline text-3xl lg:text-4xl font-semibold text-foreground tracking-tight">
          {formatDate(now.toISOString())}
        </h1>
      </div>
    </div>
  );
}

function StatsBar({
  stats,
}: {
  stats: { total: number; urgent: number; action: number; noise: number; autoTriaged: number };
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {[
        { label: "Total Items", value: stats.total, color: "text-foreground" },
        { label: "Urgent", value: stats.urgent, color: "text-red-600" },
        { label: "Action Needed", value: stats.action, color: "text-amber-600" },
        { label: "Auto-Triaged", value: stats.autoTriaged, color: "text-muted-foreground" },
      ].map((s) => (
        <Card key={s.label} className="bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">
              {s.label}
            </p>
            <p className={`text-2xl font-semibold font-headline ${s.color}`}>
              {s.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CalendarSection({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="font-headline text-xl font-semibold text-foreground">
          Today's Schedule
        </h2>
      </div>
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-4 p-3 rounded-lg bg-card border border-border/50 hover:border-border transition-colors"
          >
            <div className="text-sm font-medium text-primary font-body w-28 shrink-0">
              {event.isAllDay
                ? "All day"
                : `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground font-body">
                {event.title}
              </p>
              {event.location && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.location}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <Separator className="mt-6" />
    </section>
  );
}

function TriageItemCard({ item }: { item: TriageItem }) {
  const [showDraft, setShowDraft] = useState(false);
  const PlatformIcon = platformIcon[item.platform];
  const config = priorityConfig[item.priority];
  const PriorityIcon = config.icon;

  const markRead = trpc.actions.markRead.useMutation();
  const draftReply = trpc.actions.draftReply.useMutation();

  const handleMarkRead = () => {
    markRead.mutate({ itemId: item.id, platform: item.platform });
  };

  const handleDraftReply = () => {
    if (draftReply.data?.draft) {
      setShowDraft(!showDraft);
      return;
    }
    draftReply.mutate({
      id: item.id,
      platform: item.platform,
      title: item.title,
      snippet: item.snippet,
      sender: item.sender,
    });
    setShowDraft(true);
  };

  return (
    <div className="group p-4 rounded-lg border border-border/50 bg-card hover:border-border hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <PlatformIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${config.color}`}
            >
              <PriorityIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {item.sender && (
              <span className="text-xs text-muted-foreground truncate font-body">
                {item.sender}
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto font-body">
              {formatTime(item.timestamp)}
            </span>
          </div>
          <h3 className="text-sm font-medium text-foreground font-body leading-snug">
            {item.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-body">
            {item.snippet}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkRead}
              disabled={markRead.isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              {markRead.isSuccess ? "Done" : "Mark Read"}
            </Button>
            {(item.platform === "gmail" || item.platform === "slack") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleDraftReply}
                disabled={draftReply.isPending}
              >
                {draftReply.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Reply className="h-3 w-3 mr-1" />
                )}
                Draft Reply
              </Button>
            )}
          </div>

          {/* Draft reply */}
          {showDraft && draftReply.data?.draft && (
            <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1 font-body">
                Suggested reply:
              </p>
              <p className="text-sm text-foreground font-body">
                {draftReply.data.draft}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlatformSection({
  platform,
  items,
  label,
}: {
  platform: string;
  items: TriageItem[];
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const Icon = platformIcon[platform as keyof typeof platformIcon];
  const urgentCount = items.filter((i) => i.priority === "urgent").length;
  const actionCount = items.filter((i) => i.priority === "action").length;

  if (items.length === 0) return null;

  // Filter out noise by default
  const visibleItems = items.filter((i) => i.priority !== "noise");
  const noiseCount = items.length - visibleItems.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 group cursor-pointer">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="font-headline text-xl font-semibold text-foreground">
          {label}
        </h2>
        <div className="flex items-center gap-1.5 ml-2">
          {urgentCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {urgentCount} urgent
            </Badge>
          )}
          {actionCount > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-200"
            >
              {actionCount} action
            </Badge>
          )}
        </div>
        {noiseCount > 0 && (
          <span className="text-xs text-muted-foreground ml-auto mr-2 font-body">
            {noiseCount} filtered
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 pb-4">
          {visibleItems.map((item) => (
            <TriageItemCard key={item.id} item={item} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function BriefSkeleton() {
  return (
    <div className="max-w-3xl mx-auto">
      <Skeleton className="h-32 w-full rounded-xl mb-8" />
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-6">
          <Skeleton className="h-6 w-40 mb-3" />
          <Skeleton className="h-20 w-full rounded-lg mb-2" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const brief = trpc.brief.generate.useQuery(
    { includeSummary: true },
    {
      enabled: !!user,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 min cache
    }
  );

  // Group items by platform
  const grouped = useMemo(() => {
    if (!brief.data) return {};
    const map: Record<string, TriageItem[]> = {};
    for (const item of brief.data.items) {
      if (!map[item.platform]) map[item.platform] = [];
      map[item.platform].push(item);
    }
    return map;
  }, [brief.data]);

  // Extract AI summary from first item
  const aiSummary = brief.data?.items?.[0]?.aiSummary;

  if (brief.isLoading) {
    return <BriefSkeleton />;
  }

  if (brief.isError) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-muted-foreground font-body">
          Failed to load your morning brief.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => brief.refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const data = brief.data;
  if (!data || data.items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <EditionHeader />
        <div className="text-center py-16">
          <img
            src={EMPTY_IMAGE}
            alt="All caught up"
            className="w-48 h-48 mx-auto mb-6 opacity-80"
          />
          <h2 className="font-headline text-2xl font-semibold text-foreground mb-2">
            All caught up
          </h2>
          <p className="text-muted-foreground font-body">
            No new items to triage. Enjoy your day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <EditionHeader />

      {/* Stats */}
      <StatsBar stats={data.stats} />

      {/* AI Summary */}
      {aiSummary && (
        <Card className="mb-8 bg-primary/5 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-headline text-lg font-semibold text-foreground">
                AI Summary
              </h2>
            </div>
            <div className="text-sm text-foreground font-body prose prose-sm max-w-none">
              <Streamdown>{aiSummary}</Streamdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <CalendarSection events={data.calendarEvents} />

      {/* Platform sections */}
      <PlatformSection
        platform="gmail"
        items={grouped.gmail ?? []}
        label="Email"
      />
      <Separator className="my-2" />
      <PlatformSection
        platform="slack"
        items={grouped.slack ?? []}
        label="Slack"
      />
      <Separator className="my-2" />
      <PlatformSection
        platform="asana"
        items={grouped.asana ?? []}
        label="Asana Tasks"
      />

      {/* Refresh */}
      <div className="flex justify-center py-8">
        <Button
          variant="outline"
          onClick={() => brief.refetch()}
          disabled={brief.isFetching}
        >
          {brief.isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Brief
        </Button>
      </div>
    </div>
  );
}
