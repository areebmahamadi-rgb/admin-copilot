# Architecture Notes

## Critical Finding: MCP CLI Limitation
The `manus-mcp-cli` tool can ONLY be called from the sandbox shell environment.
It CANNOT be called from the deployed server via execSync/exec.

Error: "mcp server gmail must be invoked via shell tool call"
Error: "mcp server google-calendar must be invoked via shell tool call"

## Solution: Pre-fetch + Cache Pattern
Since MCP can't run from the server, we need to:
1. Pre-fetch data from MCP during build/sandbox time
2. Store it in the database as cached snapshots
3. Serve cached data from tRPC endpoints
4. Provide a "refresh" mechanism that re-fetches via a sandbox-triggered script

OR: Use the GWS CLI / direct API calls instead of MCP for Gmail and Calendar.

## Current Status
- Gmail MCP: Works from sandbox shell, NOT from server
- Calendar MCP: Works from sandbox shell, NOT from server  
- Asana MCP: Works from sandbox shell, NOT from server
- Slack MCP: Auth broken (missing_token)
