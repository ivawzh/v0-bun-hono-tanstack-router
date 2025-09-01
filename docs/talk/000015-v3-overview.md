# Overview of Solo Unicorn v3

Let's start from scratch. Rebuild everything.

## Definition

Solo Unicorn is

- a task management system for dispatching tasks to AI agents. We are like Trello for AI tasks.
- a flexible AI meta workflow framework.
- an easy switch to different agents. We are like OpenRouter for coding agent CLIs.
- a web UI for code agent CLIs.
- multi-repo coordination.

Our differentiator to other AI tools - we're focusing on AI task orchestration while leaving coding execution to proven tools.

## Tech Stack

- Web: React + TanStack Router + TanStack Query ([apps/web](../apps/web)). Hosted at <https://solo-unicorn.com>
- Style: TailwindCSS + shadcn/ui
- API: Hono + oRPC ([apps/server](../apps/server)). Hosted at <https://api.solo-unicorn.com>
- CLI: Bun compiled single-file executable + yargs
- Runtime: Bun
- ORM: Drizzle ([apps/db](../apps/db))
- Database: PostgreSQL
- Validation: Valibot for most. Zod for MCP server.
- MCP: stateless HTTP server (@modelcontextprotocol/sdk/server/mcp)
- Auth: Monster Auth (See [monster-wiki/shared-services/monster-auth.md](../../monster-wiki/shared-services/monster-auth.md))
- Realtime (WebSocket): Monster Realtime (See [monster-wiki/shared-services/monster-realtime.md](../../monster-wiki/shared-services/monster-realtime.md))
