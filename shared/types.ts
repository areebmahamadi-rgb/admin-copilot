/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// Triage priority levels
export type Priority = "urgent" | "action" | "info" | "noise";

// Column assignment for three-column layout
export type Column = "fyi" | "respond" | "work";

// Platform types
export type Platform = "gmail" | "slack" | "asana" | "calendar";

// A triaged item from any platform
export interface TriageItem {
  id: string;
  platform: Platform;
  priority: Priority;
  column?: Column;
  title: string;
  snippet: string;
  sender?: string;
  timestamp: string; // ISO string
  isRead: boolean;
  threadId?: string;
  // AI-generated fields
  aiSummary?: string;
  draftReply?: string;
  // Platform-specific metadata
  meta?: Record<string, unknown>;
}

// Calendar event
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  attendees?: string[];
  isAllDay?: boolean;
}

// Morning brief digest
export interface MorningBrief {
  generatedAt: string;
  calendarEvents: CalendarEvent[];
  items: TriageItem[];
  stats: {
    total: number;
    urgent: number;
    action: number;
    noise: number;
    autoTriaged: number;
  };
}
