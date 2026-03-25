import { describe, expect, it, vi } from "vitest";
import { classifyByRules, triageItems } from "./triage";

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

  // ─── New: Direct human reply detection ─────────────────────────────────

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
    ).toBe("noise"); // noreply → noise takes precedence
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
    // Should be noise (noreply pattern) or null, not action
    expect(result).not.toBe("action");
  });

  // ─── New: Snippet-based request detection ──────────────────────────────

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
    // noreply → noise, not action
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
});

// ─── Cache-backed Gmail fetcher ──────────────────────────────────────────────

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
      expect(item.id.length).toBeGreaterThan(0);
    }
  });
});

// ─── Cache-backed Calendar fetcher ───────────────────────────────────────────

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

// ─── Cache-backed Asana fetcher ──────────────────────────────────────────────

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
      expect(item.id.length).toBeGreaterThan(0);
    }
  });
});

// ─── Read-only router behavior ───────────────────────────────────────────────

describe("Read-only actions router", () => {
  it("markRead returns failure with read-only message", async () => {
    const { appRouter } = await import("./routers");

    const ctx = {
      user: {
        id: 1,
        openId: "test",
        email: "test@test.com",
        name: "Test",
        loginMethod: "manus",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.actions.markRead({
      itemId: "test-123",
      platform: "gmail",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Read-only");
  });
});
