import { invokeLLM } from "./_core/llm";
import type { TriageItem, CalendarEvent } from "@shared/types";

/**
 * Generate a concise morning brief summary from triaged items.
 * This is the ONE AI call per sweep — batched for credit efficiency.
 */
export async function generateBriefSummary(
  items: TriageItem[],
  calendarEvents: CalendarEvent[]
): Promise<string> {
  const importantItems = items.filter(
    (i) => i.priority === "urgent" || i.priority === "action"
  );

  if (importantItems.length === 0 && calendarEvents.length === 0) {
    return "Nothing urgent today. Your inbox and tasks are clear.";
  }

  // Build a compact prompt with just the data the LLM needs
  const emailItems = importantItems
    .filter((i) => i.platform === "gmail")
    .map((i) => `- [${i.priority.toUpperCase()}] From: ${i.sender} | Subject: ${i.title} | Preview: ${i.snippet.slice(0, 100)}`)
    .join("\n");

  const slackItems = importantItems
    .filter((i) => i.platform === "slack")
    .map((i) => `- [${i.priority.toUpperCase()}] #${i.title} | ${i.sender}: ${i.snippet.slice(0, 100)}`)
    .join("\n");

  const asanaItems = importantItems
    .filter((i) => i.platform === "asana")
    .map((i) => {
      const meta = i.meta as Record<string, unknown> | undefined;
      const due = meta?.dueDate ? ` (due: ${meta.dueDate})` : "";
      return `- [${i.priority.toUpperCase()}] ${i.title}${due} | ${i.snippet.slice(0, 80)}`;
    })
    .join("\n");

  const calItems = calendarEvents
    .map((e) => {
      const time = e.isAllDay
        ? "All day"
        : `${new Date(e.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${new Date(e.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
      return `- ${time}: ${e.title}${e.location ? ` @ ${e.location}` : ""}`;
    })
    .join("\n");

  const prompt = `You are a concise personal admin assistant. Generate a brief morning summary.

CALENDAR TODAY:
${calItems || "No events today."}

IMPORTANT EMAILS:
${emailItems || "None."}

IMPORTANT SLACK:
${slackItems || "None."}

IMPORTANT ASANA TASKS:
${asanaItems || "None."}

Rules:
- Be extremely concise. Use bullet points.
- Lead with the most urgent items.
- For each item, say what it is and what action is needed (if any).
- Group by urgency, not by platform.
- End with a one-line "Today's focus" recommendation.
- Do NOT include noise or low-priority items.
- Keep the entire summary under 300 words.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are a sharp, concise personal admin assistant. No fluff." },
        { role: "user", content: prompt },
      ],
    });

    return result.choices[0]?.message?.content as string ?? "Summary generation failed.";
  } catch (e) {
    console.error("[AI] Failed to generate summary:", e);
    return "Could not generate AI summary. Review items manually.";
  }
}

/**
 * Generate a context-aware draft reply for a given email/message.
 * Uses conversation history to match the tone and style of the relationship.
 */
export async function generateDraftReply(
  item: TriageItem,
  conversationHistory?: string
): Promise<string> {
  const historyBlock = conversationHistory
    ? `\nPREVIOUS CONVERSATION HISTORY WITH THIS PERSON (use this to match tone/style):\n${conversationHistory}\n`
    : "";

  const prompt = `Draft a reply to this message.

Platform: ${item.platform}
From: ${item.sender}
Subject/Title: ${item.title}
Message: ${item.snippet}
${historyBlock}
Rules:
- CRITICAL: Match the tone and style of the conversation history. If past messages are casual/direct, reply casually. If formal, reply formally.
- Keep it short — 1-3 sentences max.
- Be direct. No fluff, no filler.
- If it's a question, answer it or say you'll check.
- If it's a request, acknowledge and confirm.
- Do NOT include greetings ("Hi Ron"), sign-offs ("Best,"), or your name.
- Just the reply body, nothing else.
- If the conversation history shows a casual/blunt style, match that exactly. No corporate speak.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You draft short replies that perfectly match the existing conversational tone between two people. If they talk casually, you reply casually. If they're blunt, you're blunt. Never default to corporate/formal unless the history shows that pattern." },
        { role: "user", content: prompt },
      ],
    });

    return result.choices[0]?.message?.content as string ?? "";
  } catch (e) {
    console.error("[AI] Failed to generate draft reply:", e);
    return "";
  }
}

/**
 * Fetch conversation history with a specific person from cached data.
 * Looks across Gmail and Slack caches for previous messages.
 */
export async function getConversationHistory(
  senderName: string,
  platform: string,
  channelId?: string
): Promise<string> {
  const { readFileSync, existsSync } = await import("fs");
  const { join } = await import("path");
  const snippets: string[] = [];

  try {
    // Check Slack cache for DM history
    if (platform === "slack" && channelId) {
      const slackPath = join(process.cwd(), "data-cache", "slack-raw.json");
      if (existsSync(slackPath)) {
        const raw = JSON.parse(readFileSync(slackPath, "utf-8"));
        const results = raw?.results ?? "";
        if (typeof results === "string") {
          // Extract messages from same channel
          const blocks = results.split(/###\s*Result\s+\d+\s+of\s+\d+/);
          for (const block of blocks) {
            if (block.includes(`ID: ${channelId}`)) {
              const textMatch = block.match(/Text:\s*\n?([\s\S]*?)$/);
              const fromMatch = block.match(/From:\s*(.+?)\s*\(/);
              const text = textMatch?.[1]?.trim();
              const from = fromMatch?.[1]?.trim();
              if (text && from) {
                snippets.push(`${from}: ${text.slice(0, 200)}`);
              }
            }
          }
        }
      }
    }

    // Check Gmail cache for email history with same sender
    if (platform === "gmail") {
      const gmailPath = join(process.cwd(), "data-cache", "gmail-raw.json");
      if (existsSync(gmailPath)) {
        const raw = JSON.parse(readFileSync(gmailPath, "utf-8"));
        const results = raw?.results ?? "";
        if (typeof results === "string") {
          const blocks = results.split(/###\s*Result\s+\d+\s+of\s+\d+/);
          for (const block of blocks) {
            const senderLower = senderName.toLowerCase();
            if (block.toLowerCase().includes(senderLower)) {
              const snippetMatch = block.match(/Snippet:\s*(.+)/i) || block.match(/Body Preview:\s*(.+)/i);
              const subjectMatch = block.match(/Subject:\s*(.+)/i);
              const text = snippetMatch?.[1]?.trim() ?? "";
              const subject = subjectMatch?.[1]?.trim() ?? "";
              if (text) {
                snippets.push(`[${subject}] ${text.slice(0, 200)}`);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("[AI] Failed to load conversation history:", e);
  }

  return snippets.slice(0, 10).join("\n");
}
