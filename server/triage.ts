import type { Priority, TriageItem } from "@shared/types";

// ─── Rule-based noise detection ───────────────────────────────────────────────
// These rules run BEFORE any AI call. They handle ~80% of classification
// at zero credit cost.

const NOISE_SENDER_PATTERNS = [
  /noreply@/i,
  /no-reply@/i,
  /notifications?@/i,
  /mailer-daemon@/i,
  /donotreply@/i,
  /newsletter@/i,
  /marketing@/i,
  /promotions?@/i,
  /updates?@/i,
  /digest@/i,
  /hello@.*\.substack\.com/i,
  /@mail\.beehiiv\.com/i,
];

const NOISE_SUBJECT_PATTERNS = [
  /unsubscribe/i,
  /\bnewsletter\b/i,
  /weekly digest/i,
  /daily digest/i,
  /your .* receipt/i,
  /order confirmation/i,
  /shipping confirmation/i,
  /delivery notification/i,
  /password reset/i,
  /verify your email/i,
  /confirm your email/i,
  /welcome to/i,
  /thanks for signing up/i,
  /invitation to edit/i,
  /commented on/i,
  /new sign-?in/i,
  /security alert/i,
  /two-factor/i,
  /2fa/i,
  /your .* statement/i,
  /payment received/i,
  /invoice/i,
];

const URGENT_SUBJECT_PATTERNS = [
  /\burgent\b/i,
  /\basap\b/i,
  /\bblocking\b/i,
  /\bblocked\b/i,
  /\bescalat/i,
  /\bincident\b/i,
  /\bdowntime\b/i,
  /\boutage\b/i,
  /\bsev[- ]?[012]\b/i,
  /\bp0\b/i,
  /\bp1\b/i,
  /\bfire\b/i,
  /\bcritical\b/i,
  /\bemergency\b/i,
];

const ACTION_SUBJECT_PATTERNS = [
  /\baction required\b/i,
  /\bplease review\b/i,
  /\bfeedback needed\b/i,
  /\bapproval needed\b/i,
  /\bapprove\b/i,
  /\bsign off\b/i,
  /\bdeadline\b/i,
  /\bdue (today|tomorrow|by)\b/i,
  /\bfollow up\b/i,
  /\bfollow-up\b/i,
  /\breminder\b/i,
  /\bcan you\b/i,
  /\bcould you\b/i,
  /\bwould you\b/i,
  /\?$/,
];

/**
 * Patterns that indicate a direct human reply in a conversation thread.
 * These are NOT automated — a real person wrote back and likely expects a response.
 */
const DIRECT_REPLY_INDICATORS = [
  /^Re:/i,       // Email reply thread
  /^Fw:/i,       // Forwarded for action
  /^Fwd:/i,      // Forwarded for action
];

/**
 * Sender domains that are clearly automated / not human.
 * Used to distinguish real human replies from bot-generated Re: threads.
 */
const AUTOMATED_SENDER_DOMAINS = [
  /noreply@/i,
  /no-reply@/i,
  /notifications?@/i,
  /mailer-daemon@/i,
  /donotreply@/i,
  /@.*\.google\.com$/i,
  /@.*facebook\.com$/i,
  /@.*\.facebookmail\.com$/i,
  /support@manus\.im/i,
  /jobs@/i,
  /hr@/i,
  /newsletter@/i,
  /marketing@/i,
  /updates?@/i,
  /digest@/i,
];

// VIP senders get auto-elevated to at least "action" priority
const VIP_SENDER_PATTERNS: RegExp[] = [];

/**
 * Classify a single item using deterministic rules.
 * Accepts optional meta for platform-specific signals (e.g., isDM for Slack).
 * Returns null if the rules are inconclusive (→ needs AI).
 */
export function classifyByRules(item: {
  sender?: string;
  title: string;
  snippet: string;
  platform?: string;
  meta?: Record<string, unknown>;
}): Priority | null {
  const { sender, title, snippet, platform, meta } = item;
  const text = `${title} ${snippet}`;

  // Check noise first
  if (sender && NOISE_SENDER_PATTERNS.some((p) => p.test(sender))) {
    return "noise";
  }
  if (NOISE_SUBJECT_PATTERNS.some((p) => p.test(title))) {
    return "noise";
  }

  // Check urgent
  if (URGENT_SUBJECT_PATTERNS.some((p) => p.test(text))) {
    return "urgent";
  }

  // Check VIP
  if (sender && VIP_SENDER_PATTERNS.some((p) => p.test(sender))) {
    return "action";
  }

  // ─── Slack-specific rules ─────────────────────────────────────────
  if (platform === "slack") {
    // DMs from real people always need a response
    if (meta?.isDM === true && sender) {
      return "action";
    }
    // Direct mentions in channels
    if (snippet && /\b@?areeb\b/i.test(snippet)) {
      return "action";
    }
    // Any non-bot Slack message with substance is at least action-worthy
    // (you don't get random Slack messages — they're directed at you)
    if (sender && snippet.length > 10) {
      return "action";
    }
  }

  // ─── Asana-specific rules ─────────────────────────────────────────
  if (platform === "asana") {
    // Tasks with due dates are action items
    if (meta?.dueDate) {
      return "action";
    }
  }

  // Check action keywords
  if (ACTION_SUBJECT_PATTERNS.some((p) => p.test(text))) {
    return "action";
  }

  // Direct human reply in a thread → likely needs a response
  if (
    sender &&
    DIRECT_REPLY_INDICATORS.some((p) => p.test(title)) &&
    !AUTOMATED_SENDER_DOMAINS.some((p) => p.test(sender))
  ) {
    return "action";
  }

  // Snippet contains a direct question or request directed at the user
  if (
    sender &&
    !AUTOMATED_SENDER_DOMAINS.some((p) => p.test(sender)) &&
    /\b(i'd like|please|could you|can you|would you|let me know|thoughts\?|what do you think)\b/i.test(snippet)
  ) {
    return "action";
  }

  // Inconclusive — needs AI or defaults to "info"
  return null;
}

/**
 * Batch-classify items. Items that can't be classified by rules
 * are returned with priority "info" (safe default).
 * AI classification is done separately in a batch call.
 */
export function triageItems(
  items: Omit<TriageItem, "priority">[]
): TriageItem[] {
  return items.map((item) => {
    const priority =
      classifyByRules({
        ...item,
        meta: item.meta as Record<string, unknown> | undefined,
      }) ?? "info";
    return { ...item, priority };
  });
}
