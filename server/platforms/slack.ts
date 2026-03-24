import { execSync } from "child_process";
import type { TriageItem } from "@shared/types";

/**
 * Fetch recent Slack messages/mentions using the MCP CLI.
 * Falls back gracefully if Slack auth isn't available.
 */
export async function fetchSlackItems(
  maxResults = 20
): Promise<Omit<TriageItem, "priority">[]> {
  try {
    // Search for recent mentions and DMs
    const raw = execSync(
      `manus-mcp-cli tool call slack_search_messages --server slack --input '${JSON.stringify({
        query: "is:unread",
        count: maxResults,
      })}'`,
      { encoding: "utf-8", timeout: 15000 }
    );

    const data = JSON.parse(raw);
    const messages = data?.messages?.matches ?? data?.matches ?? [];

    return messages.map((msg: Record<string, unknown>) => ({
      id: String(msg.ts ?? msg.iid ?? Math.random()),
      platform: "slack" as const,
      title: String((msg.channel as Record<string, unknown>)?.name ?? msg.channel ?? "DM"),
      snippet: String(msg.text ?? ""),
      sender: String(msg.username ?? msg.user ?? ""),
      timestamp: msg.ts
        ? new Date(parseFloat(String(msg.ts)) * 1000).toISOString()
        : new Date().toISOString(),
      isRead: false,
      meta: { channel: msg.channel, permalink: msg.permalink },
    }));
  } catch (e) {
    console.warn("[Slack] Failed to fetch messages (auth may not be configured):", (e as Error).message);
    return [];
  }
}
