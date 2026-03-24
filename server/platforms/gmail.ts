import { execSync } from "child_process";
import type { TriageItem } from "@shared/types";

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
  internalDate?: string;
  labelIds?: string[];
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate?: number;
}

function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Fetch recent unread emails from Gmail using the gws CLI.
 * Returns raw items without priority (triage engine assigns that).
 */
export async function fetchGmailItems(
  maxResults = 30
): Promise<Omit<TriageItem, "priority">[]> {
  try {
    // List recent unread messages
    const listRaw = execSync(
      `gws gmail users messages list --params '${JSON.stringify({
        userId: "me",
        q: "is:unread category:primary",
        maxResults,
      })}'`,
      { encoding: "utf-8", timeout: 15000 }
    );

    const listData: GmailListResponse = JSON.parse(listRaw);
    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    // Fetch details for each message (batch via sequential calls for simplicity)
    const items: Omit<TriageItem, "priority">[] = [];

    for (const msg of listData.messages.slice(0, maxResults)) {
      try {
        const detailRaw = execSync(
          `gws gmail users messages get --params '${JSON.stringify({
            userId: "me",
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "Date"],
          })}'`,
          { encoding: "utf-8", timeout: 10000 }
        );

        const detail: GmailMessage = JSON.parse(detailRaw);
        const headers = detail.payload?.headers;

        items.push({
          id: detail.id,
          platform: "gmail",
          title: getHeader(headers, "Subject") || "(no subject)",
          snippet: detail.snippet || "",
          sender: getHeader(headers, "From"),
          timestamp: detail.internalDate
            ? new Date(parseInt(detail.internalDate)).toISOString()
            : new Date().toISOString(),
          isRead: !(detail.labelIds?.includes("UNREAD") ?? true),
          threadId: detail.threadId,
          meta: { labelIds: detail.labelIds },
        });
      } catch (e) {
        console.warn(`[Gmail] Failed to fetch message ${msg.id}:`, e);
      }
    }

    return items;
  } catch (e) {
    console.error("[Gmail] Failed to fetch messages:", e);
    return [];
  }
}

/**
 * Mark a Gmail message as read by removing the UNREAD label.
 */
export async function markGmailAsRead(messageId: string): Promise<boolean> {
  try {
    execSync(
      `gws gmail users messages modify --params '${JSON.stringify({
        userId: "me",
        id: messageId,
      })}' --json '${JSON.stringify({
        removeLabelIds: ["UNREAD"],
      })}'`,
      { encoding: "utf-8", timeout: 10000 }
    );
    return true;
  } catch (e) {
    console.error(`[Gmail] Failed to mark ${messageId} as read:`, e);
    return false;
  }
}
