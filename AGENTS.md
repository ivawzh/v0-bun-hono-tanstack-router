# Code Agent Rules

## Musts

- use `apps/{appName}/env.ts` to get environment variables. Must not use `process.env` directly.
- use `oRPC` on `/rpc` endpoints for communication between bundled-deployment applications where will allow breaking changes. E.g. web app and server app will always deploy together so that there will be no breaking changes.
- use `oRPC` with OpenAPI on `/api` endpoints for non-bundled apps communication where backward compatibility is required. E.g. CLI app, SDK app, and API services.
- use Monster Realtime for websocket communication. See `monster-wiki/shared-services/monster-realtime.md` for more details.
- use Monster Auth for authentication. See `monster-wiki/shared-services/monster-auth.md` for more details. However, server app still needs to implement its own authorization/access control logic.
