import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { fetchGmailItems } from "./platforms/gmail";
import { fetchSlackItems } from "./platforms/slack";
import { fetchAsanaItems } from "./platforms/asana";
import { fetchCalendarEvents } from "./platforms/calendar";
import { triageItems } from "./triage";
import {
  generateBriefSummary,
  generateDraftReply,
  getConversationHistory,
  getThreadMessages,
} from "./ai";
import { saveDraftEdit, getRecentDraftEdits } from "./db";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
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
     * Reads from cached platform data, applies rule-based triage,
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

        // Fetch from all cached platform data in parallel
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
        if (
          opts.includeSummary &&
          (stats.urgent > 0 || stats.action > 0 || calendarEvents.length > 0)
        ) {
          try {
            aiSummary = await generateBriefSummary(items, calendarEvents);
          } catch (e) {
            console.error("[AI] Summary generation failed:", e);
          }
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
  }),

  thread: router({
    /**
     * Get full conversation thread for a specific item.
     * Returns all messages in the thread for context display.
     */
    messages: protectedProcedure
      .input(
        z.object({
          platform: z.enum(["gmail", "slack", "asana", "calendar"]),
          threadId: z.string().optional(),
          channelId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const messages = await getThreadMessages(
          input.platform,
          input.threadId,
          input.channelId
        );
        return { messages };
      }),
  }),

  actions: router({
    /**
     * READ-ONLY: Mark as read is disabled.
     */
    markRead: protectedProcedure
      .input(
        z.object({
          itemId: z.string(),
          platform: z.enum(["gmail", "slack", "asana", "calendar"]),
        })
      )
      .mutation(async () => {
        return {
          success: false,
          message: "Read-only mode — no changes are made to your accounts.",
        };
      }),

    /**
     * Generate a draft reply for a specific item.
     * Pulls conversation history + past edit corrections for tone matching.
     */
    draftReply: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          platform: z.enum(["gmail", "slack", "asana", "calendar"]),
          title: z.string(),
          snippet: z.string(),
          sender: z.string().optional(),
          channelId: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Fetch conversation history for tone matching
        let history = "";
        if (input.sender) {
          history = await getConversationHistory(
            input.sender,
            input.platform,
            input.channelId
          );
        }

        // Fetch past edit corrections for learning
        let pastEdits: { originalDraft: string; editedDraft: string; sender: string | null }[] = [];
        if (ctx.user) {
          pastEdits = await getRecentDraftEdits(
            ctx.user.id,
            input.platform,
            input.sender
          );
        }

        const draft = await generateDraftReply(
          input as TriageItem,
          history || undefined,
          pastEdits.length > 0 ? pastEdits : undefined
        );
        return { draft };
      }),

    /**
     * Save a user's edit to a draft — used for learning/calibration.
     * Stores the original AI draft and the user's corrected version.
     */
    saveDraftEdit: protectedProcedure
      .input(
        z.object({
          platform: z.string(),
          sender: z.string().optional(),
          originalDraft: z.string(),
          editedDraft: z.string(),
          itemTitle: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) return { success: false };
        await saveDraftEdit({
          userId: ctx.user.id,
          platform: input.platform,
          sender: input.sender ?? null,
          originalDraft: input.originalDraft,
          editedDraft: input.editedDraft,
          itemTitle: input.itemTitle ?? null,
        });
        return { success: true };
      }),
  }),

  voice: router({
    /**
     * Transcribe an audio recording to text.
     * Accepts a base64-encoded audio blob, uploads to S3, then transcribes.
     */
    transcribe: protectedProcedure
      .input(
        z.object({
          audioBase64: z.string(),
          mimeType: z.string().optional().default("audio/webm"),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Decode base64 to buffer
          const buffer = Buffer.from(input.audioBase64, "base64");

          // Upload to S3
          const ext = input.mimeType.includes("webm") ? "webm" : "mp3";
          const key = `voice/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { url } = await storagePut(key, buffer, input.mimeType);

          // Transcribe
          const result = await transcribeAudio({
            audioUrl: url,
            language: "en",
            prompt: "Transcribe this voice note for editing a draft reply",
          });

          if ("error" in result) {
            console.error("[Voice] Transcription error:", result.error);
            return { text: "", success: false };
          }

          return { text: result.text ?? "", success: true };
        } catch (e) {
          console.error("[Voice] Transcription failed:", e);
          return { text: "", success: false };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
