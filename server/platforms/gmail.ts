import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { TriageItem } from "@shared/types";

const CACHE_PATH = join(process.cwd(), "data-cache", "gmail-raw.json");

/**
 * Fetch recent emails from cached Gmail MCP data.
 * READ-ONLY: no write operations to Gmail.
 */
export async function fetchGmailItems(
  maxResults = 15
): Promise<Omit<TriageItem, "priority">[]> {
  try {
    if (!existsSync(CACHE_PATH)) {
      console.warn("[Gmail] No cache file found at", CACHE_PATH);
      return [];
    }

    const raw = readFileSync(CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);

    // Shape: { success, userEmail, result: { threads: [...] } }
    const threads = data?.result?.threads ?? [];
    const items: Omit<TriageItem, "priority">[] = [];

    for (const thread of threads) {
      const messages = thread.messages ?? [];
      if (messages.length === 0) continue;

      // Use the LAST message in the thread (most recent)
      const lastMsg = messages[messages.length - 1];
      const headers = lastMsg.pickedHeaders ?? {};

      // Skip messages sent by the user themselves
      const from = String(headers.from ?? "");
      if (from.includes("areeb@within.co")) continue;

      const subject = String(headers.subject ?? "(no subject)");
      const snippet = String(lastMsg.snippet ?? lastMsg.pickedPlainContent ?? "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .slice(0, 300);

      const timestamp = lastMsg.internalDate
        ? new Date(Number(lastMsg.internalDate)).toISOString()
        : new Date().toISOString();

      const isReply = /^(Re:|Fw:|Fwd:)/i.test(subject);
      const cleanTitle = subject.replace(/^(Re:\s*|Fw:\s*|Fwd:\s*)+/i, "").trim() || subject;

      items.push({
        id: String(lastMsg.id ?? thread.id ?? Math.random()),
        platform: "gmail",
        title: subject, // Keep original for triage rules (Re: detection)
        snippet,
        sender: from,
        timestamp,
        isRead: false,
        threadId: String(lastMsg.threadId ?? thread.id ?? ""),
        meta: {
          to: headers.to ?? "",
          cc: headers.cc ?? "",
          hasAttachments: (lastMsg.pickedAttachments ?? []).length > 0,
          cleanTitle,
          isReply,
        },
      });
    }

    // Deduplicate by threadId (keep most recent)
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      if (!item.threadId || seen.has(item.threadId)) return false;
      seen.add(item.threadId);
      return true;
    });

    return deduped.slice(0, maxResults);
  } catch (e) {
    console.error("[Gmail] Failed to parse cache:", (e as Error).message);
    return [];
  }
}

/**
 * READ-ONLY stub — no write operations allowed.
 */
export async function markGmailAsRead(_messageId: string): Promise<boolean> {
  console.warn("[Gmail] READ-ONLY mode — markAsRead is disabled");
  return false;
}
