import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  RefreshCw,
  Loader2,
  MapPin,
  Users,
  Clock,
} from "lucide-react";
import type { CalendarEvent } from "@shared/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function EventCard({ event }: { event: CalendarEvent }) {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const now = new Date();
  const isNow = now >= startDate && now <= endDate;
  const isPast = now > endDate;

  return (
    <Card className={`transition-all ${isNow ? "border-primary bg-primary/5 shadow-sm" : isPast ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`text-sm font-medium font-body w-28 shrink-0 ${isNow ? "text-primary" : "text-muted-foreground"}`}>
            {event.isAllDay ? (
              <span>All day</span>
            ) : (
              <div className="flex flex-col">
                <span>{formatTime(event.startTime)}</span>
                <span className="text-xs">– {formatTime(event.endTime)}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground font-body">{event.title}</h3>
              {isNow && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">NOW</span>
              )}
            </div>
            {event.location && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-body">
                <MapPin className="h-3 w-3" />{event.location}
              </p>
            )}
            {event.attendees && event.attendees.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-body">
                <Users className="h-3 w-3" />{event.attendees.length} attendee{event.attendees.length > 1 ? "s" : ""}
              </p>
            )}
            {event.description && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2 font-body">{event.description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const brief = trpc.brief.generate.useQuery({ includeSummary: false }, { enabled: !!user, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const events = brief.data?.calendarEvents ?? [];

  if (brief.isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full mb-3 rounded-lg" />)}
      </div>
    );
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h1 className="font-headline text-2xl font-semibold text-foreground">Calendar</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-body flex items-center gap-1">
            <Clock className="h-3 w-3" />{dateStr}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => brief.refetch()} disabled={brief.isFetching}>
          {brief.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 font-body">No events scheduled for today.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => <EventCard key={event.id} event={event} />)}
        </div>
      )}
    </div>
  );
}
