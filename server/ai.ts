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
 * Generate a simple draft reply for a given email/message.
 * Only called on-demand per item (not batched).
 */
export async function generateDraftReply(
  item: TriageItem
): Promise<string> {
  const prompt = `Draft a brief, professional reply to this message.

From: ${item.sender}
Subject: ${item.title}
Message preview: ${item.snippet}

Rules:
- Keep it under 3 sentences.
- Be polite but direct.
- If it's a question, answer concisely or say you'll follow up.
- If it's a request, acknowledge and confirm next step.
- Match the tone of the original (formal if formal, casual if casual).
- Do NOT include a greeting line or sign-off — just the body.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You draft short, professional email replies. No fluff, no sign-offs." },
        { role: "user", content: prompt },
      ],
    });

    return result.choices[0]?.message?.content as string ?? "";
  } catch (e) {
    console.error("[AI] Failed to generate draft reply:", e);
    return "";
  }
}
