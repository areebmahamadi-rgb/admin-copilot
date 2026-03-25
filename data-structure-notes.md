# Data Structure Notes

## Gmail Cache
- Has full thread with multiple messages (pickedPlainContent, pickedMarkdownContent)
- Each message has pickedHeaders (from, to, cc, subject)
- Thread shows full conversation history — perfect for context panel

## Slack Cache
- Markdown format from MCP search results
- Multiple messages from same channel ID = conversation thread
- DMs have Participants field showing both people
- Group DMs show all participants
- Bot messages marked with [BOT]
- Real DMs: Danielle, Dan Rojas, Joe Yakuel, Maria Hoyos, Taylor Thomson

## Key Design Decisions
- Feed = single column, expandable cards
- Expanded card shows: full message + conversation thread + recommended action
- Gmail: show full thread (all messages in thread)
- Slack: show all messages from same channel ID as conversation context
- Mic button: use MediaRecorder → upload to S3 → transcribeAudio → edit draft
- Learning: store (original_draft, edited_draft, platform, sender) in DB
