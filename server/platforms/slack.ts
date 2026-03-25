import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { TriageItem } from "@shared/types";

const CACHE_PATH = join(process.cwd(), "data-cache", "slack-raw.json");

/**
 * Fetch recent Slack messages from cached MCP data.
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
    if (!raw || raw.length < 5) {
      return [];
    }

    const data = JSON.parse(raw);

    // Handle the MCP channel list format (from slack_search_channels)
    const channels = data?.channels ?? [];
    if (channels.length === 0) {
      // Try messages format
      const messages = data?.messages?.matches ?? data?.matches ?? [];
      return messages.slice(0, maxResults).map((msg: Record<string, unknown>) => ({
        id: String(msg.ts ?? msg.iid ?? Math.random()),
        platform: "slack" as const,
        title: String(
          (msg.channel as Record<string, unknown>)?.name ?? msg.channel ?? "DM"
        ),
        snippet: String(msg.text ?? ""),
        sender: String(msg.username ?? msg.user ?? ""),
        timestamp: msg.ts
          ? new Date(parseFloat(String(msg.ts)) * 1000).toISOString()
          : new Date().toISOString(),
        isRead: false,
        meta: { channel: msg.channel, permalink: msg.permalink },
      }));
    }

    // Channel list format — not useful for triage, return empty
    return [];
  } catch (e) {
    console.warn(
      "[Slack] Failed to parse cache:",
      (e as Error).message
    );
    return [];
  }
}
