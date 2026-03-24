# Admin Copilot – Design Brainstorm

<response>
<text>

## Idea 1: "Terminal Operator" – Hacker/CLI Aesthetic

**Design Movement:** Terminal/Hacker UI meets modern dashboard. Inspired by Bloomberg Terminal, Warp terminal, and retro-futuristic command interfaces.

**Core Principles:**
- Information density over decoration
- Monospace typography as a design feature
- Dark-first, low-distraction environment
- Status indicators over icons

**Color Philosophy:** Deep charcoal base (#0D1117) with electric green (#00FF41) and amber (#FFB800) accents. Green = good/done, amber = needs attention, red = urgent. The palette evokes "system status" rather than "brand identity."

**Layout Paradigm:** Vertical column-based layout. Left rail = platform switcher (Gmail/Slack/Asana/Calendar). Main area = scrollable feed of triaged items. Right rail = detail/action panel. No cards—just rows with clear hierarchy.

**Signature Elements:**
- Monospace status badges (e.g., `[NOISE]`, `[ACTION]`, `[URGENT]`)
- Blinking cursor animation on the active section
- Scanline/grid background texture

**Interaction Philosophy:** Keyboard-first. Everything feels like issuing commands. Click to expand, Enter to act.

**Animation:** Minimal. Typewriter text reveals for summaries. Subtle fade-ins. No bouncing or sliding.

**Typography System:** JetBrains Mono for data/labels, Inter for body text. Tight line heights. All-caps for section headers.

</text>
<probability>0.06</probability>
</response>

<response>
<text>

## Idea 2: "Morning Brief" – Editorial/Newspaper Layout

**Design Movement:** Editorial design meets productivity tool. Inspired by The Economist app, Readwise Reader, and morning briefing newsletters.

**Core Principles:**
- Content hierarchy through typography, not color
- Generous whitespace as a signal of calm
- Reading-optimized layout
- Progressive disclosure (summary → detail)

**Color Philosophy:** Warm off-white (#FAFAF7) with ink-black text (#1A1A1A). A single accent color—muted teal (#2B7A78)—for interactive elements and urgency markers. The palette says "curated information" not "software dashboard."

**Layout Paradigm:** Single-column editorial flow with a fixed left sidebar for navigation. Main content area reads like a newspaper: date header, then sections (Email Brief, Slack Brief, Asana Tasks, Calendar). Each section is a collapsible "article" with a headline summary and expandable detail.

**Signature Elements:**
- Serif headlines with sans-serif body (like a newspaper)
- Horizontal rule dividers between sections
- "Edition" timestamp at the top (e.g., "Morning Brief — March 24, 2026")

**Interaction Philosophy:** Scroll-to-read. Expand for detail. Act with inline buttons. Feels like reading a curated briefing, not operating a dashboard.

**Animation:** Smooth accordion expansions. Gentle opacity transitions. No flashy motion.

**Typography System:** Playfair Display for section headlines, Source Sans 3 for body. Clear size hierarchy: 28px headlines, 16px body, 13px metadata.

</text>
<probability>0.08</probability>
</response>

<response>
<text>

## Idea 3: "Ops Console" – Military/Mission Control

**Design Movement:** Mission control UI. Inspired by SpaceX launch dashboards, air traffic control interfaces, and tactical operations centers.

**Core Principles:**
- Status-at-a-glance over aesthetics
- Color = meaning (never decorative)
- Dense but organized information architecture
- Everything has a priority level

**Color Philosophy:** Navy-black base (#0A0E1A) with a strict status palette: green (#22C55E) = clear, yellow (#EAB308) = attention, orange (#F97316) = action needed, red (#EF4444) = urgent. Blue (#3B82F6) for neutral/informational. White text on dark. No gradients.

**Layout Paradigm:** Grid-based "panels" layout. Top bar = status strip (counts per platform). Below = 2x2 grid of platform panels (Email, Slack, Asana, Calendar), each showing a compact summary. Click any panel to expand into full-screen detail view. Bottom bar = action queue.

**Signature Elements:**
- Numeric counters with status dots (e.g., "● 3 Urgent  ● 12 Noise  ● 5 Action")
- Thin border panels with subtle glow on active
- Priority badges: P0/P1/P2/P3

**Interaction Philosophy:** Scan → identify → act. Designed for quick decision-making. Bulk actions prominent.

**Animation:** Status dot pulses for urgent items. Panel transitions are instant (no slide). Loading states use a thin progress bar, not spinners.

**Typography System:** Space Grotesk for everything. Medium weight for labels, bold for counts/numbers, regular for body. Tabular numbers for alignment.

</text>
<probability>0.07</probability>
</response>
