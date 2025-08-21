# Solo Unicorn Test Suite - New Terminology

This test suite validates the terminology refactor from `task→card`, `status→column`, and `stage→mode` terminology.

## Test Coverage

### 1. Test Utilities (`test-utils.ts`)
- **TestFixtures**: Factory methods for creating test data using new terminology
- **TestValidation**: Helper functions for validating card states and transitions
- **Complete test environment setup** with all entities (users, projects, repositories, agents, actors, cards)

### 2. Cards Router Tests (`tasks.router.test.ts`) 
- ✅ **Card Creation**: Validates default columns and modes
- ✅ **Card State Transitions**: Tests todo → doing → done workflow
- ✅ **Card Workflow Modes**: Tests clarify → plan → execute progression  
- ✅ **Column Validation**: Validates all valid column values (todo, doing, done, loop)
- ✅ **Mode Validation**: Validates all valid mode values (clarify, plan, execute, loop, talk)
- ✅ **Agent Session Status**: Tests INACTIVE, PUSHING, ACTIVE states
- ✅ **Priority and Ready State**: Tests priority levels and ready flags

### 3. MCP Tools Tests (`mcp-tools.test.ts`)
- ✅ **task_update MCP Tool**: Tests updating card column, mode, and agent session status
- ✅ **task_create MCP Tool**: Tests creating new cards via MCP with correct terminology
- ✅ **project_memory MCP Tools**: Tests updating and getting project memory
- ✅ **MCP Tool Integration**: Tests full workflow using all MCP tools in sequence

### 4. WebSocket Events Tests (`websocket.test.ts`)
- ✅ **Card Movement Events**: Tests column transition events using new terminology
- ✅ **Loop Card Events**: Tests loop card cycling events
- ✅ **Agent Session Events**: Tests agent session status change events
- ✅ **Mode Transition Events**: Tests mode transitions within doing column
- ✅ **Project Updates**: Tests project memory and card creation events
- ✅ **Real-time Board Updates**: Tests concurrent updates and board state consistency

### 5. Agent System Tests (`agents.test.ts`)
- ✅ **Card Selection Logic**: Tests priority-based card selection from columns
- ✅ **Agent Session Management**: Tests session lifecycle and concurrency limits
- ✅ **Agent Workflow Modes**: Tests progression through workflow modes
- ✅ **Loop Mode Workflow**: Tests infinite loop card cycling
- ✅ **Agent Rate Limiting**: Tests rate limit tracking and availability

### 6. Terminology Validation (`terminology-validation.test.ts`)
- ✅ **Database Schema**: Validates use of `list` and `mode` columns
- ✅ **Column Values**: Tests all valid column values
- ✅ **Mode Values**: Tests all valid mode values  
- ✅ **Workflow Validation**: Tests complete card and mode workflows
- ✅ **Agent Session Integration**: Tests integration with agent session status
- ✅ **Terminology Consistency**: Validates no old terminology remains

## Key Terminology Changes Validated

| Old Term | New Term | Validation |
|----------|----------|------------|
| `task` | `card` | ✅ All tests use "card" terminology |
| `status` | `column` (list) | ✅ Database uses `list` field with todo/doing/done/loop values |
| `stage` | `mode` | ✅ Database uses `mode` field with clarify/plan/execute/loop/talk values |
| `column_order` | `list_order` | ✅ Field renamed and working correctly |

## Test Results Summary

- **49 tests** across 5 test files
- **188 expect() calls** 
- **All tests passing** ✅
- **Full workflow coverage** from card creation to completion
- **Complete MCP tool validation** 
- **WebSocket event validation**
- **Agent system validation**
- **Database schema validation**

## Running Tests

```bash
# Run all new terminology tests
bun test src/test/

# Run specific test suite
bun test src/test/tasks.router.test.ts
bun test src/test/mcp-tools.test.ts
bun test src/test/websocket.test.ts
bun test src/test/agents.test.ts
bun test src/test/terminology-validation.test.ts

# Test database setup
bun run test:setup
```

## Coverage

The test suite provides comprehensive coverage of:

1. **Database Operations**: All CRUD operations using new terminology
2. **MCP Integration**: Agent communication via MCP tools
3. **WebSocket Events**: Real-time updates with new terminology
4. **Agent Workflows**: Complete agent lifecycle management
5. **Card Workflows**: Full card lifecycle from creation to completion
6. **Loop Cards**: Infinite cycling workflow validation
7. **Priority Handling**: Priority-based card selection
8. **Session Management**: Agent session status tracking

All tests validate that the terminology refactor is complete and functional.