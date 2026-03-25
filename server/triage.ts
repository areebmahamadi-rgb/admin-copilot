import type { Priority, Column, TriageItem } from "@shared/types";

// ─── Rule-based noise detection ───────────────────────────────────────────────

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
  // Automated platform senders
  /@.*atlassian\.com$/i,
  /@.*confluence/i,
  /confluence@/i,
  /@.*facebook\.com$/i,
  /@.*facebookmail\.com$/i,
  // Retail / e-commerce senders
  /@.*softsurroundings\./i,
  /@.*goldwatercreek\./i,
  /@.*theory\./i,
  /@.*feedonomics\./i,
];

const NOISE_SUBJECT_PATTERNS = [
  /unsubscribe/i,
  /\bnewsletter\b/i,
  /weekly digest/i,
  /daily digest/i,
  /daily alert/i,
  /daily report/i,
  /daily summary/i,
  /weekly report/i,
  /automated report/i,
  /system notification/i,
  /your .* receipt/i,
  /order confirmation/i,
  /shipping confirmation/i,
  /delivery notification/i,
  /password reset/i,
  /verify your email/i,
  /confirm your email/i,
  /welcome to/i,
  /thanks for signing up/i,
  /new sign-?in/i,
  /security alert/i,
  /two-factor/i,
  /2fa/i,
  /your .* statement/i,
  /payment received/i,
  /invoice/i,
  // Auth / token notifications
  /authentication token/i,
  /access token/i,
  /api key/i,
  /token expired/i,
  /token generated/i,
  // CI/CD and platform alerts
  /build (passed|failed|succeeded)/i,
  /deployment (succeeded|failed|complete)/i,
  /page updated in confluence/i,
  /confluence.*page/i,
  // Retail noise
  /\bsale\b.*\bends\b/i,
  /\boff\b.*\btoday\b/i,
  /\bdiscount\b/i,
  /\bcoupon\b/i,
  /\bpromo\b/i,
  /\bfree shipping\b/i,
  /\bnew arrivals\b/i,
  /\bback in stock\b/i,
  /\bwishlist\b/i,
  /\bexclusive offer\b/i,
  /\byour order\b/i,
  /\btrack your/i,
  /\bshipped\b/i,
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

const DIRECT_REPLY_INDICATORS = [
  /^Re:/i,
  /^Fw:/i,
  /^Fwd:/i,
];

const AUTOMATED_SENDER_DOMAINS = [
  /noreply@/i,
  /no-reply@/i,
  /notifications?@/i,
  /mailer-daemon@/i,
  /donotreply@/i,
  /@.*\.google\.com$/i,
  /@.*facebook\.com$/i,
  /@.*\.facebookmail\.com$/i,
  /@.*atlassian\.com$/i,
  /confluence@/i,
  /support@manus\.im/i,
  /jobs@/i,
  /hr@/i,
  /newsletter@/i,
  /marketing@/i,
  /updates?@/i,
  /digest@/i,
];

/** Patterns that indicate deep work (strategy, planning, process creation) */
const DEEP_WORK_PATTERNS = [
  /\bstrategy\b/i,
  /\bplan\b/i,
  /\bprocess\b/i,
  /\bproposal\b/i,
  /\bbudget\b/i,
  /\bforecast\b/i,
  /\banalysis\b/i,
  /\breport\b/i,
  /\bpresentation\b/i,
  /\bdeck\b/i,
  /\boutline\b/i,
  /\bdocument\b/i,
  /\bwrite\b/i,
  /\bcreate\b/i,
  /\bdesign\b/i,
  /\bbuild\b/i,
  /\barchitect/i,
  /\bframework\b/i,
  /\broadmap\b/i,
];

// VIP senders get auto-elevated to at least "action" priority
const VIP_SENDER_PATTERNS: RegExp[] = [];

/**
 * Classify a single item using deterministic rules.
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

  // Check noise first — sender patterns
  if (sender && NOISE_SENDER_PATTERNS.some((p) => p.test(sender))) {
    return "noise";
  }
  // Check noise — subject patterns
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
    if (meta?.isDM === true && sender) return "action";
    if (snippet && /\b@?areeb\b/i.test(snippet)) return "action";
    if (sender && snippet.length > 10) return "action";
  }

  // ─── Asana-specific rules ─────────────────────────────────────────
  if (platform === "asana") {
    if (meta?.dueDate) return "action";
    if (snippet && snippet.length > 50) return "action";
    return "action"; // All incomplete Asana tasks need attention
  }

  // Check action keywords
  if (ACTION_SUBJECT_PATTERNS.some((p) => p.test(text))) return "action";

  // Direct human reply in a thread
  if (
    sender &&
    DIRECT_REPLY_INDICATORS.some((p) => p.test(title)) &&
    !AUTOMATED_SENDER_DOMAINS.some((p) => p.test(sender))
  ) {
    return "action";
  }

  // Snippet contains a direct question or request
  if (
    sender &&
    !AUTOMATED_SENDER_DOMAINS.some((p) => p.test(sender)) &&
    /\b(i'd like|please|could you|can you|would you|let me know|thoughts\?|what do you think)\b/i.test(snippet)
  ) {
    return "action";
  }

  return null;
}

/**
 * Determine which column an item belongs to.
 *
 * FYI (left):     Pure awareness — newsletters, notifications, status updates, automated alerts
 * Respond (mid):  Quick reply/decision — emails needing response, DMs, event invites, Asana tasks
 * Work (right):   Requires thinking — strategy, plans, process, deliverables
 */
export function assignColumn(item: TriageItem): Column {
  const { priority, platform, title, snippet, meta } = item;
  const text = `${title} ${snippet}`;

  // Noise / info always goes to FYI (except calendar events)
  if (priority === "noise" || priority === "info") {
    if (platform === "calendar") return "respond";
    return "fyi";
  }

  // Asana tasks → Deep Work if title/snippet contains strategic keywords, else Respond
  if (platform === "asana") {
    const titleOnly = title;
    if (DEEP_WORK_PATTERNS.some((p) => p.test(titleOnly))) return "work";
    return "respond";
  }

  // Urgent items that require deep thinking → work
  if (priority === "urgent" && DEEP_WORK_PATTERNS.some((p) => p.test(text))) {
    return "work";
  }

  // Emails and Slack messages — only route to Deep Work if title strongly indicates it
  if (platform === "gmail" || platform === "slack") {
    if (DEEP_WORK_PATTERNS.some((p) => p.test(title))) return "work";
    return "respond";
  }

  // Calendar events → respond (accept/decline/review)
  if (platform === "calendar") return "respond";

  // Default: respond
  return "respond";
}

/**
 * Batch-classify items and assign columns.
 */
export function triageItems(
  items: Omit<TriageItem, "priority" | "column">[]
): TriageItem[] {
  return items.map((item) => {
    const priority =
      classifyByRules({
        ...item,
        meta: item.meta as Record<string, unknown> | undefined,
      }) ?? "info";
    const triaged: TriageItem = { ...item, priority };
    triaged.column = assignColumn(triaged);
    return triaged;
  });
}
