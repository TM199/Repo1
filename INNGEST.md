# Inngest Configuration

## MCP Server Details

The Inngest MCP server provides tools for interacting with Inngest functions during development.

### Connection Details
- **Server URL**: `http://127.0.0.1:8288`
- **MCP Endpoint**: `http://127.0.0.1:8288/mcp`
- **Dashboard**: `http://127.0.0.1:8288`

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_functions` | List all registered Inngest functions |
| `send_event` | Fire an event to trigger functions (fire-and-forget) |
| `invoke_function` | Call a function directly and wait for result |
| `get_run_status` | Get status/trace for a specific run |
| `poll_run_status` | Poll multiple runs until completion |
| `list_docs` | List Inngest documentation categories |
| `read_doc` | Read specific documentation |
| `grep_docs` | Search documentation |

### Starting the Dev Server

```bash
# Start Inngest dev server
npx inngest-cli@latest dev

# Or with explicit port
npx inngest-cli@latest dev --port 8288
```

### Registered Functions

| Function ID | Event Trigger | Description |
|-------------|---------------|-------------|
| `generate-pain-signals` | `pain-signals/generate` | Generate pain signals for all ICPs |
| `classify-companies-batch` | `company/classify.requested` | Batch classify companies as agencies |

### Triggering Functions

**Via MCP (preferred):**
```
Use mcp__inngest-dev__send_event with:
- name: "pain-signals/generate"
- data: {} (optional payload)
```

**Via curl:**
```bash
curl -X POST http://127.0.0.1:8288/v1/events \
  -H "Content-Type: application/json" \
  -d '{"name":"pain-signals/generate","data":{}}'
```

### Checking Function Status

```
Use mcp__inngest-dev__get_run_status with:
- runId: "<run-id-from-send_event>"
```

### Environment Variables

Required in `.env.local` for production:
```
INNGEST_SIGNING_KEY=<your-signing-key>
```

The signing key is used to verify webhooks from Inngest Cloud in production.

### Webhook Endpoint

The Next.js app exposes the Inngest webhook at:
- **Local**: `http://localhost:3000/api/inngest`
- **Production**: `https://signal-mentis.vercel.app/api/inngest`

### Cron Schedules

| Function | Schedule | Description |
|----------|----------|-------------|
| `generate-pain-signals` | `45 */2 * * *` | Every 2 hours at :45 |

### Quick Commands

```bash
# Start dev server
npx inngest-cli@latest dev

# List functions (via MCP)
# Use: mcp__inngest-dev__list_functions

# Trigger pain signal generation (via MCP)
# Use: mcp__inngest-dev__send_event with name="pain-signals/generate"

# Trigger batch classification (via MCP)
# Use: mcp__inngest-dev__send_event with name="company/classify.requested" data={"companyIds":["id1","id2"]}
```
