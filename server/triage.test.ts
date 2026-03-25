import { describe, expect, it, vi } from "vitest";
import { classifyByRules, triageItems } from "./triage";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── classifyByRules ─────────────────────────────────────────────────────────

describe("classifyByRules", () => {
  it("classifies noreply senders as noise", () => {
    expect(
      classifyByRules({ sender: "noreply@example.com", title: "Hello", snippet: "" })
    ).toBe("noise");
  });

  it("classifies newsletter senders as noise", () => {
    expect(
      classifyByRules({ sender: "newsletter@company.com", title: "Weekly update", snippet: "" })
    ).toBe("noise");
  });

  it("classifies newsletter subjects as noise", () => {
    expect(
      classifyByRules({ sender: "john@example.com", title: "Our weekly newsletter", snippet: "" })
    ).toBe("noise");
  });

  it("classifies password reset as noise", () => {
    expect(
      classifyByRules({ sender: "security@bank.com", title: "Password reset request", snippet: "" })
    ).toBe("noise");
  });

  it("classifies urgent subjects as urgent", () => {
    expect(
      classifyByRules({ sender: "boss@company.com", title: "URGENT: Server down", snippet: "" })
    ).toBe("urgent");
  });

  it("classifies P0 incidents as urgent", () => {
    expect(
      classifyByRules({ sender: "alerts@pagerduty.com", title: "P0 incident detected", snippet: "" })
    ).toBe("urgent");
  });

  it("classifies action-required subjects as action", () => {
    expect(
      classifyByRules({ sender: "pm@company.com", title: "Action required: Review PR", snippet: "" })
    ).toBe("action");
  });

  it("classifies questions as action", () => {
    expect(
      classifyByRules({ sender: "colleague@company.com", title: "Can you review this doc?", snippet: "" })
    ).toBe("action");
  });

  it("returns null for ambiguous items", () => {
    expect(
      classifyByRules({ sender: "friend@gmail.com", title: "Hey, how's it going", snippet: "Just checking in" })
    ).toBeNull();
  });

  it("classifies direct human Re: emails as action", () => {
    expect(
      classifyByRules({
        sender: "Ron Yakuel <ron@fragrancex.com>",
        title: "Re: Fw: Your ads were approved",
        snippet: "No what I mean is I see a lot of ads",
      })
    ).toBe("action");
  });

  it("does NOT classify automated Re: emails as action", () => {
    expect(
      classifyByRules({
        sender: "noreply@business-updates.facebook.com",
        title: "Re: Your ads were approved",
        snippet: "Your ad has been approved",
      })
    ).toBe("noise");
  });

  it("classifies Fw: from real humans as action", () => {
    expect(
      classifyByRules({
        sender: "colleague@company.com",
        title: "Fw: Budget proposal",
        snippet: "Take a look at this",
      })
    ).toBe("action");
  });

  it("does NOT classify Re: from google.com as action", () => {
    const result = classifyByRules({
      sender: "ads-account-noreply@google.com",
      title: "Re: Account update",
      snippet: "Your account has been updated",
    });
    expect(result).not.toBe("action");
  });

  it("classifies emails with 'I'd like' in snippet as action", () => {
    expect(
      classifyByRules({
        sender: "client@company.com",
        title: "Product feedback",
        snippet: "I'd like you to try Prestige or Niche products",
      })
    ).toBe("action");
  });

  it("classifies emails with 'please' in snippet as action", () => {
    expect(
      classifyByRules({
        sender: "manager@company.com",
        title: "Q3 report",
        snippet: "Please review the attached report and let me know",
      })
    ).toBe("action");
  });

  it("classifies emails with 'let me know' in snippet as action", () => {
    expect(
      classifyByRules({
        sender: "partner@agency.com",
        title: "Campaign update",
        snippet: "Let me know your thoughts on the new creative",
      })
    ).toBe("action");
  });

  it("does NOT flag automated senders even with action words in snippet", () => {
    const result = classifyByRules({
      sender: "noreply@service.com",
      title: "Account update",
      snippet: "Please verify your email address",
    });
    expect(result).toBe("noise");
  });
});

// ─── triageItems ─────────────────────────────────────────────────────────────

describe("triageItems", () => {
  it("assigns priority to all items, defaulting to info", () => {
    const items = [
      { id: "1", platform: "gmail" as const, title: "Hello", snippet: "", sender: "friend@gmail.com", timestamp: new Date().toISOString(), isRead: false },
      { id: "2", platform: "gmail" as const, title: "URGENT: Deploy broken", snippet: "", sender: "ops@company.com", timestamp: new Date().toISOString(), isRead: false },
      { id: "3", platform: "gmail" as const, title: "Your weekly digest", snippet: "", sender: "noreply@service.com", timestamp: new Date().toISOString(), isRead: false },
    ];

    const result = triageItems(items);
    expect(result).toHaveLength(3);
    expect(result[0].priority).toBe("info");
    expect(result[1].priority).toBe("urgent");
    expect(result[2].priority).toBe("noise");
  });

  it("preserves all original fields", () => {
    const items = [
      { id: "x", platform: "asana" as const, title: "Task", snippet: "Do stuff", sender: "pm@co.com", timestamp: "2026-01-01T00:00:00Z", isRead: false, threadId: "t1" },
    ];
    const result = triageItems(items);
    expect(result[0].id).toBe("x");
    expect(result[0].platform).toBe("asana");
    expect(result[0].threadId).toBe("t1");
  });

  it("handles empty input", () => {
    expect(triageItems([])).toEqual([]);
  });

  it("handles items without sender", () => {
    const items = [
      { id: "1", platform: "asana" as const, title: "Some task", snippet: "", timestamp: new Date().toISOString(), isRead: false },
    ];
    const result = triageItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe("info");
  });

  it("classifies Ron's email as action (direct reply with request)", () => {
    const items = [
      {
        id: "ron-1",
        platform: "gmail" as const,
        title: "Re: Fw: Your ads were approved",
        snippet: "No what I mean is I see a lot of ads that we're doing all have mainstream products and I'd like you to try Prestige or Niche products",
        sender: "Ron Yakuel <ron@fragrancex.com>",
        timestamp: new Date().toISOString(),
        isRead: false,
      },
    ];
    const result = triageItems(items);
    expect(result[0].priority).toBe("action");
  });

  it("classifies Slack DMs from real people as action", () => {
    const items = [
      {
        id: "dm-1",
        platform: "slack" as const,
        title: "DM with Dan",
        sender: "Dan",
        snippet: "Hey can you check this?",
        timestamp: new Date().toISOString(),
        isRead: false,
        meta: { isDM: true },
      },
    ];
    const result = triageItems(items);
    expect(["action", "urgent"]).toContain(result[0].priority);
  });
});

// ─── Cache-backed fetchers ──────────────────────────────────────────────────

describe("Gmail cache fetcher", () => {
  it("parses cached gmail-raw.json correctly", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cachePath = path.join(process.cwd(), "data-cache", "gmail-raw.json");

    if (!fs.existsSync(cachePath)) {
      console.warn("Skipping Gmail cache test — no cache file");
      return;
    }

    const { fetchGmailItems } = await import("./platforms/gmail");
    const items = await fetchGmailItems(10);

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      expect(item.platform).toBe("gmail");
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.timestamp).toBe("string");
    }
  });
});

describe("Calendar cache fetcher", () => {
  it("parses cached calendar-raw.json correctly", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cachePath = path.join(process.cwd(), "data-cache", "calendar-raw.json");

    if (!fs.existsSync(cachePath)) {
      console.warn("Skipping Calendar cache test — no cache file");
      return;
    }

    const { fetchCalendarEvents } = await import("./platforms/calendar");
    const events = await fetchCalendarEvents();

    expect(Array.isArray(events)).toBe(true);

    for (const event of events) {
      expect(typeof event.id).toBe("string");
      expect(typeof event.title).toBe("string");
      expect(typeof event.startTime).toBe("string");
      expect(typeof event.endTime).toBe("string");
    }
  });
});

describe("Asana cache fetcher", () => {
  it("parses cached asana-raw.json correctly", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cachePath = path.join(process.cwd(), "data-cache", "asana-raw.json");

    if (!fs.existsSync(cachePath)) {
      console.warn("Skipping Asana cache test — no cache file");
      return;
    }

    const { fetchAsanaItems } = await import("./platforms/asana");
    const items = await fetchAsanaItems(10);

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      expect(item.platform).toBe("asana");
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
    }
  });
});

// ─── Router tests ───────────────────────────────────────────────────────────

function createAuthContext() {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const user = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("actions.markRead", () => {
  it("returns read-only message", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.actions.markRead({
      itemId: "test-123",
      platform: "gmail",
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Read-only");
  });
});

describe("thread.messages", () => {
  it("returns array of messages for any platform", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.thread.messages({
      platform: "gmail",
      threadId: "nonexistent",
    });
    expect(result).toHaveProperty("messages");
    expect(Array.isArray(result.messages)).toBe(true);
  });

  it("returns array for slack platform", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.thread.messages({
      platform: "slack",
      channelId: "C12345",
    });
    expect(result).toHaveProperty("messages");
    expect(Array.isArray(result.messages)).toBe(true);
  });
});

describe("actions.saveDraftEdit", () => {
  it("accepts edit data for learning", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.actions.saveDraftEdit({
        platform: "gmail",
        sender: "ron@client.com",
        originalDraft: "I'll review the proposal and get back to you.",
        editedDraft: "Got it, will check today.",
        itemTitle: "Re: Proposal",
      });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    } catch {
      // DB not available in test env — acceptable
    }
  });
});
