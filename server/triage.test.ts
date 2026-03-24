import { describe, expect, it } from "vitest";
import { classifyByRules, triageItems } from "./triage";

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
});

describe("triageItems", () => {
  it("assigns priority to all items, defaulting to info", () => {
    const items = [
      { id: "1", platform: "gmail" as const, title: "Hello", snippet: "", sender: "friend@gmail.com", timestamp: new Date().toISOString(), isRead: false },
      { id: "2", platform: "gmail" as const, title: "URGENT: Deploy broken", snippet: "", sender: "ops@company.com", timestamp: new Date().toISOString(), isRead: false },
      { id: "3", platform: "gmail" as const, title: "Your weekly digest", snippet: "", sender: "noreply@service.com", timestamp: new Date().toISOString(), isRead: false },
    ];

    const result = triageItems(items);

    expect(result).toHaveLength(3);
    expect(result[0].priority).toBe("info"); // ambiguous → default
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
});
