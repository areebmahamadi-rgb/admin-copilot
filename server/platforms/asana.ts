import { execSync } from "child_process";
import type { TriageItem } from "@shared/types";

/**
 * Fetch tasks assigned to the current user from Asana using the MCP CLI.
 * Focuses on "My Tasks" that are incomplete and due soon.
 */
export async function fetchAsanaItems(
  maxResults = 20
): Promise<Omit<TriageItem, "priority">[]> {
  try {
    // Search for tasks assigned to me that are incomplete
    const raw = execSync(
      `manus-mcp-cli tool call asana_search_tasks --server asana --input '${JSON.stringify({
        assignee_any: "me",
        completed: false,
        sort_by: "due_date",
        opt_fields: "name,due_on,due_at,notes,assignee_section.name,created_at,permalink_url",
      })}'`,
      { encoding: "utf-8", timeout: 15000 }
    );

    const data = JSON.parse(raw);
    const tasks = (data?.data ?? data ?? []).slice(0, maxResults);

    return tasks.map((task: Record<string, unknown>) => {
      const dueDate = String(task.due_at ?? task.due_on ?? "");
      const isOverdue = dueDate && new Date(dueDate) < new Date();
      const isDueToday =
        dueDate &&
        new Date(dueDate).toDateString() === new Date().toDateString();

      return {
        id: String(task.gid ?? task.id ?? Math.random()),
        platform: "asana" as const,
        title: String(task.name ?? "Untitled Task"),
        snippet: String(task.notes ?? "").slice(0, 200),
        timestamp: String(task.created_at ?? new Date().toISOString()),
        isRead: false,
        meta: {
          dueDate,
          isOverdue,
          isDueToday,
          section: (task.assignee_section as Record<string, unknown>)?.name,
          permalink: task.permalink_url,
        },
      };
    });
  } catch (e) {
    console.warn("[Asana] Failed to fetch tasks:", (e as Error).message);
    return [];
  }
}
