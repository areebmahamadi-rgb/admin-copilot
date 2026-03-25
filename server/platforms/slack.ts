import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { TriageItem } from "@shared/types";

const CACHE_PATH = join(process.cwd(), "data-cache", "slack-raw.json");

/**
 * Parse a single Slack search result block (markdown format from MCP).
 */
function parseResultBlock(block: string): Omit<TriageItem, "priority" | "column"> | null {
  try {
    const channelMatch = block.match(/Channel:\s*(?:#?([\w-]+)|DM)\s*\(ID:\s*([\w]+)\)/);
    const channelName = channelMatch?.[1] ?? "DM";
    const channelId = channelMatch?.[2] ?? "";

    const participantsMatch = block.match(/Participants:\s*(.+)/);
    const participants = participantsMatch?.[1] ?? "";

    const fromMatch = block.match(/From:\s*(.+?)\s*\(ID:\s*([\w]+)\)/);
    const senderName = fromMatch?.[1]?.trim() ?? "";
    const senderId = fromMatch?.[2] ?? "";
    const isBot = block.includes("[BOT]");

    const timeMatch = block.match(/Time:\s*(.+)/);
    const timeStr = timeMatch?.[1]?.trim() ?? "";

    const tsMatch = block.match(/Message_ts:\s*([\d.]+)/);
    const messageTs = tsMatch?.[1] ?? "";

    const permalinkMatch = block.match(/Permalink:\s*\[link\]\((.+?)\)/);
    const permalink = permalinkMatch?.[1] ?? "";

    // Full text — no truncation
    const textMatch = block.match(/Text:\s*\n?([\s\S]*?)$/);
    const text = textMatch?.[1]?.trim() ?? "";

    if (isBot) return null;
    if (!senderName || !text) return null;

    let timestamp: string;
    try {
      if (messageTs) {
        timestamp = new Date(parseFloat(messageTs) * 1000).toISOString();
      } else if (timeStr) {
        timestamp = new Date(timeStr).toISOString();
      } else {
        timestamp = new Date().toISOString();
      }
    } catch {
      timestamp = new Date().toISOString();
    }

    let title: string;
    if (channelName === "DM") {
      const otherPerson = participants
        .split(",")
        .map((p) => p.trim().split("(")[0].trim())
        .find((name) => name !== "Areeb Mahamadi" && name.length > 0);
      title = otherPerson ? `DM with ${otherPerson}` : "Direct Message";
    } else {
      title = `#${channelName}`;
    }

    return {
      id: messageTs || String(Math.random()),
      platform: "slack",
      title,
      snippet: text, // Full text, no truncation
      sender: senderName,
      timestamp,
      isRead: false,
      meta: {
        channelId,
        channelName,
        permalink,
        senderId,
        isDM: channelName === "DM",
      },
    };
  } catch {
    return null;
  }
}

/**
 * Fetch recent Slack messages from cached MCP search results.
 * READ-ONLY: no write operations to Slack.
 * Groups messages by channel/DM and keeps all of them for context.
 */
export async function fetchSlackItems(
  maxResults = 20
): Promise<Omit<TriageItem, "priority" | "column">[]> {
  try {
    if (!existsSync(CACHE_PATH)) {
      console.warn("[Slack] No cache file found at", CACHE_PATH);
      return [];
    }

    const raw = readFileSync(CACHE_PATH, "utf-8").trim();
    if (!raw || raw.length < 10) return [];

    const data = JSON.parse(raw);
    const results = data?.results ?? "";

    if (typeof results !== "string" || results.length === 0) return [];

    const blocks = results.split(/###\s*Result\s+\d+\s+of\s+\d+/);

    const items: Omit<TriageItem, "priority" | "column">[] = [];
    for (const block of blocks) {
      if (!block.trim()) continue;
      const parsed = parseResultBlock(block);
      if (parsed) items.push(parsed);
    }

    // Group by channel — for each channel/DM, keep the latest message as the main item
    // but store ALL messages in meta.threadMessages for context display
    const channelGroups = new Map<string, Omit<TriageItem, "priority" | "column">[]>();
    for (const item of items) {
      const meta = item.meta as Record<string, unknown>;
      const key = String(meta.channelId ?? item.id);
      if (!channelGroups.has(key)) channelGroups.set(key, []);
      channelGroups.get(key)!.push(item);
    }

    const grouped: Omit<TriageItem, "priority" | "column">[] = [];
    const entries = Array.from(channelGroups.entries());
    for (const [, msgs] of entries) {
      // Sort by timestamp descending — latest first
      msgs.sort((a: Omit<TriageItem, "priority" | "column">, b: Omit<TriageItem, "priority" | "column">) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const latest = msgs[0];
      // Store all messages as thread context (oldest first for display)
      const threadMsgs = [...msgs].reverse().map((m: Omit<TriageItem, "priority" | "column">) => ({
        sender: m.sender,
        text: m.snippet,
        timestamp: m.timestamp,
      }));
      if (latest) {
        grouped.push({
          ...latest,
          meta: {
            ...(latest.meta as Record<string, unknown>),
            threadMessages: threadMsgs,
          },
        });
      }
    }

    return grouped.slice(0, maxResults) as Omit<TriageItem, "priority" | "column">[];
  } catch (e) {
    console.warn("[Slack] Failed to parse cache:", (e as Error).message);
    return [] as Omit<TriageItem, "priority" | "column">[];
  }
}
