import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { fetchGmailItems, markGmailAsRead } from "./platforms/gmail";
import { fetchSlackItems } from "./platforms/slack";
import { fetchAsanaItems } from "./platforms/asana";
import { fetchCalendarEvents } from "./platforms/calendar";
import { triageItems } from "./triage";
import { generateBriefSummary, generateDraftReply } from "./ai";
import type { TriageItem, MorningBrief } from "@shared/types";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  brief: router({
    /**
     * Generate the morning brief — the main endpoint.
     * Fetches from all platforms, applies rule-based triage,
     * and optionally generates an AI summary.
     */
    generate: protectedProcedure
      .input(
        z
          .object({
            includeSummary: z.boolean().optional().default(true),
          })
          .optional()
      )
      .query(async ({ input }): Promise<MorningBrief> => {
        const opts = input ?? { includeSummary: true };

        // Fetch from all platforms in parallel
        const [gmailRaw, slackRaw, asanaRaw, calendarEvents] =
          await Promise.all([
            fetchGmailItems(30),
            fetchSlackItems(20),
            fetchAsanaItems(20),
            fetchCalendarEvents(),
          ]);

        // Combine and triage
        const allRaw = [...gmailRaw, ...slackRaw, ...asanaRaw];
        const items = triageItems(allRaw);

        // Stats
        const stats = {
          total: items.length,
          urgent: items.filter((i) => i.priority === "urgent").length,
          action: items.filter((i) => i.priority === "action").length,
          noise: items.filter((i) => i.priority === "noise").length,
          autoTriaged: items.filter((i) => i.priority === "noise").length,
        };

        // Generate AI summary if requested (single batched call)
        let aiSummary: string | undefined;
        if (opts.includeSummary && (stats.urgent > 0 || stats.action > 0 || calendarEvents.length > 0)) {
          aiSummary = await generateBriefSummary(items, calendarEvents);
        }

        // Attach summary to the first item or create a virtual summary item
        const enrichedItems = aiSummary
          ? items.map((item, idx) =>
              idx === 0 ? { ...item, aiSummary } : item
            )
          : items;

        return {
          generatedAt: new Date().toISOString(),
          calendarEvents,
          items: enrichedItems,
          stats,
        };
      }),

    /**
     * Get AI summary only (lighter endpoint for refresh).
     */
    summary: protectedProcedure
      .input(
        z.object({
          items: z.array(
            z.object({
              id: z.string(),
              platform: z.enum(["gmail", "slack", "asana", "calendar"]),
              priority: z.enum(["urgent", "action", "info", "noise"]),
              title: z.string(),
              snippet: z.string(),
              sender: z.string().optional(),
              timestamp: z.string(),
              isRead: z.boolean(),
              threadId: z.string().optional(),
              meta: z.record(z.string(), z.unknown()).optional(),
            })
          ),
          calendarEvents: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              startTime: z.string(),
              endTime: z.string(),
              location: z.string().optional(),
              description: z.string().optional(),
              attendees: z.array(z.string()).optional(),
              isAllDay: z.boolean().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const summary = await generateBriefSummary(
          input.items as TriageItem[],
          input.calendarEvents
        );
        return { summary };
      }),
  }),

  actions: router({
    /**
     * Mark an item as read on its source platform.
     */
    markRead: protectedProcedure
      .input(
        z.object({
          itemId: z.string(),
          platform: z.enum(["gmail", "slack", "asana", "calendar"]),
        })
      )
      .mutation(async ({ input }) => {
        if (input.platform === "gmail") {
          const success = await markGmailAsRead(input.itemId);
          return { success };
        }
        // Other platforms: mark locally only for now
        return { success: true };
      }),

    /**
     * Generate a draft reply for a specific item.
     */
    draftReply: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          platform: z.enum(["gmail", "slack", "asana", "calendar"]),
          title: z.string(),
          snippet: z.string(),
          sender: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const draft = await generateDraftReply(input as TriageItem);
        return { draft };
      }),
  }),
});

export type AppRouter = typeof appRouter;
