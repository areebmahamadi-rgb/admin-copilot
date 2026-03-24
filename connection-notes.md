# MCP Connection Status

- Gmail MCP: WORKING (gmail_search_messages returns real data)
- Google Calendar MCP: WORKING (google_calendar_search_events returns real events)
- Asana MCP: WORKING (asana_get_tasks with assignee="me" + workspace GID works)
  - User GID: 1200450853270255
  - Workspace GID: 1166910246816688
  - NOTE: opt_fields param causes timeout. Use minimal params only.
- Slack MCP: BROKEN (missing_token auth error)

# Key findings
- Gmail returns thread-based results with full message bodies
- Calendar returns events with attendees, descriptions, locations
- Asana returns task list (paginated, 10 per page)
- All MCP calls must be done from sandbox CLI, not from deployed server
  - Server needs to use execSync/exec to call manus-mcp-cli
