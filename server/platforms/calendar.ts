import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { CalendarEvent } from "@shared/types";

const CACHE_PATH = join(process.cwd(), "data-cache", "calendar-raw.json");

/**
 * Fetch today's calendar events from cached MCP data.
 * READ-ONLY: no write operations to Google Calendar.
 */
export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    if (!existsSync(CACHE_PATH)) {
      console.warn("[Calendar] No cache file found at", CACHE_PATH);
      return [];
    }

    const raw = readFileSync(CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);

    // Shape: { success, result: [event, ...] }
    const events: Array<Record<string, unknown>> = data?.result ?? [];

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // "2026-03-24"

    const mapped: CalendarEvent[] = [];

    for (const event of events) {
      const summary = String(event.summary ?? "Untitled Event");
      const status = String(event.status ?? "confirmed");

      // Skip cancelled events
      if (status === "cancelled") continue;

      // Skip OOO events (noise reduction)
      if (summary.toLowerCase().includes("ooo") || summary.toLowerCase().includes("out of office")) continue;

      const start = event.start as Record<string, string> | undefined;
      const end = event.end as Record<string, string> | undefined;

      if (!start) continue;

      const isAllDay = !!(start.date && !start.dateTime);
      const startTime = start.dateTime ?? start.date ?? "";
      const endTime = end?.dateTime ?? end?.date ?? "";

      // For timed events, check if they're today
      if (!isAllDay) {
        const eventDate = startTime.slice(0, 10);
        if (eventDate !== todayStr) continue;
      }

      // Skip all-day events that span many days (like long OOO blocks)
      if (isAllDay) {
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const daySpan = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daySpan > 3) continue; // Skip events spanning more than 3 days
      }

      const attendees = (event.attendees as Array<Record<string, string>>) ?? [];
      const location = event.location ? String(event.location) : undefined;
      const description = event.description
        ? String(event.description).replace(/<[^>]*>/g, "").slice(0, 200)
        : undefined;

      mapped.push({
        id: String(event.id ?? Math.random()),
        title: summary,
        startTime: isAllDay ? startTime : new Date(startTime).toISOString(),
        endTime: isAllDay ? endTime : new Date(endTime).toISOString(),
        location: location === "None" ? undefined : location,
        description,
        attendees: attendees.map((a) => a.email ?? a.displayName ?? "").filter(Boolean),
        isAllDay,
      });
    }

    // Sort by start time
    mapped.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return mapped;
  } catch (e) {
    console.error("[Calendar] Failed to parse cache:", (e as Error).message);
    return [];
  }
}
