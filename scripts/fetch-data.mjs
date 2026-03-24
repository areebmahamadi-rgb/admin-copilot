#!/usr/bin/env node
/**
 * Pre-fetch script — runs from sandbox shell (NOT from deployed server).
 * Fetches data from Gmail, Calendar, and Asana MCP, then writes JSON cache files
 * that the tRPC server can read.
 *
 * Usage: node scripts/fetch-data.mjs
 */
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", "data-cache");

mkdirSync(CACHE_DIR, { recursive: true });

function mcpCall(server, tool, input) {
  try {
    const raw = execSync(
      `manus-mcp-cli tool call ${tool} --server ${server} --input '${JSON.stringify(input)}'`,
      { encoding: "utf-8", timeout: 45000 }
    );
    // Try to find JSON file path in output
    const fileMatch = raw.match(/saved to:\s*(.+\.(?:json|txt))/);
    if (fileMatch) {
      const filePath = fileMatch[1].trim();
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf-8");
      }
    }
    return raw;
  } catch (e) {
    console.error(`[MCP] ${server}/${tool} failed:`, e.message?.slice(0, 200));
    return null;
  }
}

function fetchGmail() {
  console.log("[Gmail] Fetching recent messages...");
  const raw = mcpCall("gmail", "gmail_search_messages", {
    q: "newer_than:1d",
    max_results: 15,
  });
  if (raw) {
    writeFileSync(join(CACHE_DIR, "gmail-raw.json"), raw, "utf-8");
    console.log("[Gmail] Cached to gmail-raw.json (" + raw.length + " chars)");
  } else {
    console.log("[Gmail] No data");
  }
}

function fetchCalendar() {
  console.log("[Calendar] Fetching today's events...");
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const raw = mcpCall("google-calendar", "google_calendar_search_events", {
    time_min: startOfDay.toISOString(),
    time_max: endOfDay.toISOString(),
    max_results: 20,
  });
  if (raw) {
    writeFileSync(join(CACHE_DIR, "calendar-raw.json"), raw, "utf-8");
    console.log("[Calendar] Cached to calendar-raw.json (" + raw.length + " chars)");
  } else {
    console.log("[Calendar] No data");
  }
}

function fetchAsana() {
  console.log("[Asana] Fetching tasks assigned to user...");
  const raw = mcpCall("asana", "asana_get_tasks", {
    assignee: "1200450853270255",
    workspace: "1166910246816688",
  });
  if (raw) {
    writeFileSync(join(CACHE_DIR, "asana-raw.json"), raw, "utf-8");
    console.log("[Asana] Cached to asana-raw.json (" + raw.length + " chars)");
  } else {
    console.log("[Asana] No data");
  }
}

function fetchSlack() {
  console.log("[Slack] Fetching (may fail — auth issue)...");
  const raw = mcpCall("slack", "slack_search_channels", {
    query: "general",
    channel_types: "public_channel,private_channel",
  });
  if (raw) {
    writeFileSync(join(CACHE_DIR, "slack-raw.json"), raw, "utf-8");
    console.log("[Slack] Cached to slack-raw.json");
  } else {
    console.log("[Slack] No data (expected — auth broken)");
  }
}

// Write timestamp
writeFileSync(
  join(CACHE_DIR, "last-fetch.json"),
  JSON.stringify({ timestamp: new Date().toISOString() }),
  "utf-8"
);

fetchGmail();
fetchCalendar();
fetchAsana();
fetchSlack();

console.log("\n[Done] All data cached to", CACHE_DIR);
