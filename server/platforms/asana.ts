import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { TriageItem } from "@shared/types";

const CACHE_PATH = join(process.cwd(), "data-cache", "asana-raw.json");

/**
 * Fetch tasks assigned to the current user from cached Asana MCP data.
 * READ-ONLY: no write operations to Asana.
 * Filters out completed tasks and enriches with notes/due_on.
 */
export async function fetchAsanaItems(
  maxResults = 15
): Promise<Omit<TriageItem, "priority" | "column">[]> {
  try {
    if (!existsSync(CACHE_PATH)) {
      console.warn("[Asana] No cache file found at", CACHE_PATH);
      return [];
    }

    const raw = readFileSync(CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);

    const tasks: Array<Record<string, unknown>> = data?.data ?? [];

    // Filter out completed tasks
    const activeTasks = tasks.filter((task) => task.completed !== true);

    return activeTasks.slice(0, maxResults).map((task) => ({
      id: String(task.gid ?? Math.random()),
      platform: "asana" as const,
      title: String(task.name ?? "Untitled Task"),
      snippet: String(task.notes ?? "").slice(0, 500),
      timestamp: task.due_on
        ? new Date(String(task.due_on)).toISOString()
        : new Date().toISOString(),
      isRead: false,
      meta: {
        permalink: task.permalink_url
          ? String(task.permalink_url)
          : task.gid
            ? `https://app.asana.com/0/0/${task.gid}`
            : undefined,
        dueDate: task.due_on ? String(task.due_on) : undefined,
        completed: task.completed === true,
      },
    }));
  } catch (e) {
    console.warn("[Asana] Failed to parse cache:", (e as Error).message);
    return [];
  }
}
