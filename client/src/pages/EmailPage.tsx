import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  RefreshCw,
  Loader2,
  CheckCheck,
  Reply,
  AlertTriangle,
  ArrowRight,
  Info,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import type { TriageItem, Priority } from "@shared/types";

const priorityConfig: Record<
  Priority,
  { label: string; color: string; icon: React.ElementType }
> = {
  urgent: { label: "Urgent", color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle },
  action: { label: "Action", color: "bg-amber-100 text-amber-800 border-amber-200", icon: ArrowRight },
  info: { label: "FYI", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Info },
  noise: { label: "Noise", color: "bg-gray-100 text-gray-500 border-gray-200", icon: VolumeX },
};

function EmailRow({ item }: { item: TriageItem }) {
  const [showDraft, setShowDraft] = useState(false);
  const config = priorityConfig[item.priority];
  const PriorityIcon = config.icon;
  const markRead = trpc.actions.markRead.useMutation();
  const draftReply = trpc.actions.draftReply.useMutation();

  const handleDraft = () => {
    if (draftReply.data?.draft) { setShowDraft(!showDraft); return; }
    draftReply.mutate({ id: item.id, platform: "gmail", title: item.title, snippet: item.snippet, sender: item.sender });
    setShowDraft(true);
  };

  return (
    <div className="group p-4 border-b border-border/50 hover:bg-accent/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
              <PriorityIcon className="h-3 w-3 mr-1" />{config.label}
            </Badge>
            <span className="text-xs text-muted-foreground truncate font-body max-w-[200px]">{item.sender}</span>
            <span className="text-xs text-muted-foreground ml-auto font-body">
              {new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <h3 className="text-sm font-medium text-foreground font-body">{item.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1 font-body">{item.snippet}</p>
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markRead.mutate({ itemId: item.id, platform: "gmail" })} disabled={markRead.isPending}>
              <CheckCheck className="h-3 w-3 mr-1" />{markRead.isSuccess ? "Done" : "Mark Read"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDraft} disabled={draftReply.isPending}>
              {draftReply.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Reply className="h-3 w-3 mr-1" />}
              Draft Reply
            </Button>
          </div>
          {showDraft && draftReply.data?.draft && (
            <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1 font-body">Suggested reply:</p>
              <p className="text-sm text-foreground font-body">{draftReply.data.draft}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmailPage() {
  const { user } = useAuth();
  const [showNoise, setShowNoise] = useState(false);
  const brief = trpc.brief.generate.useQuery({ includeSummary: false }, { enabled: !!user, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const emailItems = (brief.data?.items ?? []).filter((i) => i.platform === "gmail");
  const visible = showNoise ? emailItems : emailItems.filter((i) => i.priority !== "noise");
  const noiseCount = emailItems.length - emailItems.filter((i) => i.priority !== "noise").length;

  if (brief.isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full mb-2 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="font-headline text-2xl font-semibold text-foreground">Email Triage</h1>
        </div>
        <div className="flex items-center gap-2">
          {noiseCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowNoise(!showNoise)}>
              {showNoise ? "Hide" : "Show"} {noiseCount} noise
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => brief.refetch()} disabled={brief.isFetching}>
            {brief.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 font-body">No emails to show.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {visible.map((item) => <EmailRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
