import { execSync } from "child_process";
import type { CalendarEvent } from "@shared/types";

/**
 * Fetch today's calendar events using the gws CLI.
 */
export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const raw = execSync(
      `gws calendar events list --params '${JSON.stringify({
        calendarId: "primary",
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 25,
      })}'`,
      { encoding: "utf-8", timeout: 15000 }
    );

    const data = JSON.parse(raw);
    const events = data?.items ?? [];

    return events.map((event: Record<string, unknown>) => {
      const start = event.start as Record<string, string> | undefined;
      const end = event.end as Record<string, string> | undefined;
      const attendees = (event.attendees as Array<Record<string, string>>) ?? [];

      return {
        id: String(event.id ?? Math.random()),
        title: String(event.summary ?? "Untitled Event"),
        startTime: start?.dateTime ?? start?.date ?? new Date().toISOString(),
        endTime: end?.dateTime ?? end?.date ?? new Date().toISOString(),
        location: event.location ? String(event.location) : undefined,
        description: event.description
          ? String(event.description).slice(0, 300)
          : undefined,
        attendees: attendees.map((a) => a.email ?? a.displayName ?? ""),
        isAllDay: !!start?.date && !start?.dateTime,
      };
    });
  } catch (e) {
    console.error("[Calendar] Failed to fetch events:", e);
    return [];
  }
}
