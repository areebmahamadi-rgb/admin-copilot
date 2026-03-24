import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { TriageItem } from "@shared/types";

const CACHE_PATH = join(process.cwd(), "data-cache", "asana-raw.json");

/**
 * Fetch tasks assigned to the current user from cached Asana MCP data.
 * READ-ONLY: no write operations to Asana.
 *
 * Cache shape: { data: [{ gid, name, resource_type, resource_subtype }, ...] }
 * These are already filtered to the user's assignee GID.
 */
export async function fetchAsanaItems(
  maxResults = 15
): Promise<Omit<TriageItem, "priority">[]> {
  try {
    if (!existsSync(CACHE_PATH)) {
      console.warn("[Asana] No cache file found at", CACHE_PATH);
      return [];
    }

    const raw = readFileSync(CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);

    const tasks: Array<Record<string, unknown>> = data?.data ?? [];

    return tasks.slice(0, maxResults).map((task) => ({
      id: String(task.gid ?? Math.random()),
      platform: "asana" as const,
      title: String(task.name ?? "Untitled Task"),
      snippet: "", // Lightweight stubs don't include notes
      timestamp: new Date().toISOString(),
      isRead: false,
      meta: {
        permalink: task.gid
          ? `https://app.asana.com/0/0/${task.gid}`
          : undefined,
      },
    }));
  } catch (e) {
    console.warn("[Asana] Failed to parse cache:", (e as Error).message);
    return [];
  }
}
