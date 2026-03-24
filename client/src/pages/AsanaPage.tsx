import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckSquare,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Info,
  VolumeX,
  ExternalLink,
  Clock,
} from "lucide-react";
import type { TriageItem, Priority } from "@shared/types";

const priorityConfig: Record<Priority, { label: string; color: string; icon: React.ElementType }> = {
  urgent: { label: "Urgent", color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle },
  action: { label: "Action", color: "bg-amber-100 text-amber-800 border-amber-200", icon: ArrowRight },
  info: { label: "FYI", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Info },
  noise: { label: "Noise", color: "bg-gray-100 text-gray-500 border-gray-200", icon: VolumeX },
};

function AsanaRow({ item }: { item: TriageItem }) {
  const config = priorityConfig[item.priority];
  const PriorityIcon = config.icon;
  const meta = item.meta as Record<string, unknown> | undefined;
  const isOverdue = meta?.isOverdue as boolean;
  const isDueToday = meta?.isDueToday as boolean;
  const dueDate = meta?.dueDate as string | undefined;
  const permalink = meta?.permalink as string | undefined;
  const section = meta?.section as string | undefined;

  return (
    <div className="group p-4 border-b border-border/50 hover:bg-accent/30 transition-colors">
      <div className="flex items-start gap-3">
        <CheckSquare className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
              <PriorityIcon className="h-3 w-3 mr-1" />{config.label}
            </Badge>
            {section && <span className="text-xs text-muted-foreground font-body">{section}</span>}
            {dueDate && (
              <span className={`text-xs font-body flex items-center gap-1 ml-auto ${isOverdue ? "text-red-600 font-medium" : isDueToday ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                <Clock className="h-3 w-3" />
                {isOverdue ? "Overdue" : isDueToday ? "Due today" : `Due ${new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              </span>
            )}
          </div>
          <h3 className="text-sm font-medium text-foreground font-body">{item.title}</h3>
          {item.snippet && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-body">{item.snippet}</p>
          )}
          {permalink && (
            <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <a href={permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-body">
                <ExternalLink className="h-3 w-3" />Open in Asana
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AsanaPage() {
  const { user } = useAuth();
  const brief = trpc.brief.generate.useQuery({ includeSummary: false }, { enabled: !!user, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const asanaItems = (brief.data?.items ?? []).filter((i) => i.platform === "asana");

  if (brief.isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full mb-2 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          <h1 className="font-headline text-2xl font-semibold text-foreground">Asana Tasks</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => brief.refetch()} disabled={brief.isFetching}>
          {brief.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      {asanaItems.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 font-body">No Asana tasks to show.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {asanaItems.map((item) => <AsanaRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
