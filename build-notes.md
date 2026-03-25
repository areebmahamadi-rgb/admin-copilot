# Build Notes — Three-Column Redesign

## Key Issues to Fix
1. **Slack truncation**: `slack.ts` line 87 slices to 300 chars. Remove the slice.
2. **Slack dedup too aggressive**: Dedupes by `channelId-sender`, losing multiple messages from same person. Should keep all messages but group them.
3. **Asana data is all completed/old (2021)**: The `completed: true` filter is missing. Need to filter out completed tasks.
4. **Asana missing notes/snippet**: The fetcher returns empty snippet. Should use `task.notes`.
5. **Asana missing due_on in meta**: The fetcher doesn't pass `due_on` to meta.dueDate.

## Three-Column Classification
- **FYI (left)**: priority = "info" or "noise" — newsletters, notifications, status updates, completed tasks
- **Respond (middle)**: priority = "action" — emails needing reply, event invites, Slack DMs, things needing quick feedback
- **Deep Work (right)**: priority = "urgent" or items with meta.isDeepWork — strategy tasks, plans, process work, Asana tasks with real deliverables

## Triage Rule Updates Needed
- Add a new priority level or use meta flag for "deep_work" vs "respond"
- Or: keep existing priority system but add a `column` field to TriageItem
- Better: Add `column: "fyi" | "respond" | "work"` to the triage output

## Write Access with Guardrails
- Enable markRead for Gmail
- Every action shows a confirmation dialog first
- User must click "Confirm" before any write happens
- Log all actions taken
