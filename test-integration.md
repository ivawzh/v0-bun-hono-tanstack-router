# Solo Unicorn - Claude Code UI Integration Test Guide

## Setup Complete ✅

### Changes Made:
1. **Database Schema Updated**
   - Added `activeSessionId` field to tasks table
   - Database migrations applied successfully

2. **Agent Session Management**
   - Start Agent button now creates sessions properly
   - Task status updates from "todo" to "in_progress"
   - WebSocket notifications sent to Claude Code UI

3. **Claude Code UI Integration**
   - Auto-starts working on tasks when notified
   - WebSocket client configured for Solo Unicorn

## Testing Steps:

### 1. Verify Services Running
```bash
# Solo Unicorn Server (port 8500)
cd apps/server
bun run dev

# Claude Code UI (port 8888)  
cd apps/claudecode-ui
bun run dev
```

### 2. Environment Configuration
Create `/apps/claudecode-ui/.env`:
```env
SOLO_UNICORN_URL=ws://localhost:8500/ws/agent
AGENT_AUTH_TOKEN=dev-token
PORT=8888
```

### 3. Test Flow
1. Open Solo Unicorn: http://localhost:8302
2. Log in with your credentials
3. Create or select a project
4. Create a task
5. Assign the task to an agent
6. Click "Start Agent" button
7. Observe:
   - Task moves to "In Progress" column
   - Claude Code UI console shows task notification
   - Agent session is created in database

### 4. Verify Database
```sql
-- Check active sessions
SELECT t.title, t.status, t.active_session_id, as.state 
FROM tasks t
LEFT JOIN agent_sessions as ON t.active_session_id = as.id
WHERE t.active_session_id IS NOT NULL;
```

## Troubleshooting

### If boards don't load:
- Database schema is updated ✅
- Run `bun run db:push` in server directory ✅

### If Claude Code UI doesn't receive notifications:
- Check WebSocket connection in browser DevTools
- Verify SOLO_UNICORN_URL in .env
- Check server logs for WebSocket connections

### If task doesn't move to In Progress:
- Verify agent is assigned to task
- Check browser console for errors
- Ensure activeSessionId is being set

## Next Steps
1. Test with actual Claude Code projects
2. Configure project paths and Claude project IDs
3. Set up proper authentication tokens for production