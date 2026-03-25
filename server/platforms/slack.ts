import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { TriageItem } from "@shared/types";

const CACHE_PATH = join(process.cwd(), "data-cache", "slack-raw.json");

/**
 * Parse a single Slack search result block (markdown format from MCP).
 * Each block looks like:
 *   ### Result N of M
 *   Channel: #name (ID: CXXX) or DM (ID: DXXX)
 *   Participants: ...
 *   From: Name (ID: UXXX) [BOT]?
 *   Time: 2026-03-24 20:03:49 EDT
 *   Message_ts: 1774397029.747859
 *   Permalink: [link](https://...)
 *   Text: ...
 */
function parseResultBlock(block: string): Omit<TriageItem, "priority"> | null {
  try {
    // Channel or DM
    const channelMatch = block.match(/Channel:\s*(?:#?([\w-]+)|DM)\s*\(ID:\s*([\w]+)\)/);
    const channelName = channelMatch?.[1] ?? "DM";
    const channelId = channelMatch?.[2] ?? "";

    // Participants (for DMs)
    const participantsMatch = block.match(/Participants:\s*(.+)/);
    const participants = participantsMatch?.[1] ?? "";

    // From
    const fromMatch = block.match(/From:\s*(.+?)\s*\(ID:\s*([\w]+)\)/);
    const senderName = fromMatch?.[1]?.trim() ?? "";
    const senderId = fromMatch?.[2] ?? "";
    const isBot = block.includes("[BOT]");

    // Time
    const timeMatch = block.match(/Time:\s*(.+)/);
    const timeStr = timeMatch?.[1]?.trim() ?? "";

    // Message_ts
    const tsMatch = block.match(/Message_ts:\s*([\d.]+)/);
    const messageTs = tsMatch?.[1] ?? "";

    // Permalink
    const permalinkMatch = block.match(/Permalink:\s*\[link\]\((.+?)\)/);
    const permalink = permalinkMatch?.[1] ?? "";

    // Text — everything after "Text:" until end of block
    const textMatch = block.match(/Text:\s*\n?([\s\S]*?)$/);
    const text = textMatch?.[1]?.trim() ?? "";

    // Skip bot messages (Asana notifications, Google Drive, etc.)
    if (isBot) return null;
    if (!senderName || !text) return null;

    // Parse timestamp
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

    // Build title: for DMs show participant name, for channels show #channel
    let title: string;
    if (channelName === "DM") {
      // Extract the other person's name from participants
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
      snippet: text.slice(0, 300),
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
 */
export async function fetchSlackItems(
  maxResults = 20
): Promise<Omit<TriageItem, "priority">[]> {
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

    // Split by "### Result N of M" headers
    const blocks = results.split(/###\s*Result\s+\d+\s+of\s+\d+/);

    const items: Omit<TriageItem, "priority">[] = [];
    for (const block of blocks) {
      if (!block.trim()) continue;
      const parsed = parseResultBlock(block);
      if (parsed) items.push(parsed);
    }

    // Deduplicate by combining consecutive messages from same sender in same channel
    const deduped: Omit<TriageItem, "priority">[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const meta = item.meta as Record<string, unknown>;
      const key = `${meta.channelId}-${item.sender}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    return deduped.slice(0, maxResults);
  } catch (e) {
    console.warn("[Slack] Failed to parse cache:", (e as Error).message);
    return [];
  }
}
