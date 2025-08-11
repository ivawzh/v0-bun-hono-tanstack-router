# Automated Test User Journeys

This document describes all the automated user journeys tested by our E2E test suite. Each journey represents a critical user flow that must work correctly for the application to function properly.

## Test Coverage Overview

Our E2E tests cover the following major areas:
- **Authentication & Authorization**
- **Project Management**  
- **Task Management**
- **Agent Gateway Integration**

## 1. Authentication User Journeys

### 1.1 Initial Login Flow
**File:** `e2e/auth.spec.ts`  
**Test:** "should display login page"

**Journey:**
1. User navigates to the application root (`/`)
2. System displays the login page with:
   - Sign in heading
   - "Continue with Google" button
3. User can see all authentication options

**Validates:**
- Login page renders correctly
- OAuth provider options are visible

### 1.2 OAuth Provider Redirect
**File:** `e2e/auth.spec.ts`  
**Test:** "should redirect to Monster Auth on Google login"

**Journey:**
1. User clicks "Continue with Google" button
2. System redirects to Monster Auth service
3. URL changes to include `monstermake.limited`

**Validates:**
- OAuth integration is properly configured
- Redirect URLs are correct

### 1.3 OAuth Callback Handling
**File:** `e2e/auth.spec.ts`  
**Test:** "should handle OAuth callback"

**Journey:**
1. OAuth provider redirects back with authorization code
2. System processes the callback at `/api/oauth/callback`
3. System sets authentication cookies
4. User is redirected to the main application

**Validates:**
- OAuth callback processing
- Session establishment
- Post-login redirect

### 1.4 Protected Route Authorization
**File:** `e2e/auth.spec.ts`  
**Test:** "should protect authenticated routes"

**Journey:**
1. Unauthenticated user attempts to access `/projects`
2. System detects missing authentication
3. User is redirected to login page

**Validates:**
- Route protection is enforced
- Redirect to login works correctly

## 2. Project Management User Journeys

### 2.1 View Projects List
**File:** `e2e/projects.spec.ts`  
**Test:** "should display projects page"

**Journey:**
1. Authenticated user navigates to `/projects`
2. System displays:
   - "Projects" heading
   - "New Project" button
   - List of existing projects (if any)

**Validates:**
- Projects page loads for authenticated users
- UI elements are present

### 2.2 Create New Project
**File:** `e2e/projects.spec.ts`  
**Test:** "should create a new project"

**Journey:**
1. User clicks "New Project" button
2. Dialog appears with form fields
3. User enters:
   - Project name: "Test Project"
   - Description: "This is a test project"
4. User clicks "Create" button
5. Dialog closes
6. New project appears in the projects list

**Validates:**
- Project creation dialog works
- Form submission creates project
- UI updates to show new project

### 2.3 Navigate to Project Boards
**File:** `e2e/projects.spec.ts`  
**Test:** "should navigate to project boards"

**Journey:**
1. User clicks on a project card
2. System navigates to `/projects/{id}/boards`
3. Boards page displays with "Boards" heading

**Validates:**
- Project navigation works
- Boards page loads correctly

### 2.4 Edit Project Details
**File:** `e2e/projects.spec.ts`  
**Test:** "should edit project details"

**Journey:**
1. User clicks project menu button (three dots)
2. Menu appears with options
3. User selects "Edit"
4. Edit dialog appears with current project details
5. User modifies project name to "Updated Project Name"
6. User clicks "Save"
7. Dialog closes
8. Project list shows updated name

**Validates:**
- Edit functionality works
- Changes persist
- UI reflects updates

### 2.5 Delete Project
**File:** `e2e/projects.spec.ts`  
**Test:** "should delete a project"

**Journey:**
1. User clicks project menu button
2. User selects "Delete" option
3. Confirmation dialog appears
4. User confirms deletion
5. Project is removed from list

**Validates:**
- Delete confirmation flow
- Project removal
- UI updates after deletion

## 3. Task Management User Journeys

### 3.1 View Kanban Board
**File:** `e2e/tasks.spec.ts`  
**Test:** "should display board with tasks"

**Journey:**
1. User navigates to project board
2. System displays Kanban columns:
   - Todo
   - In Progress
   - Done
3. Tasks are displayed in appropriate columns

**Validates:**
- Board layout renders correctly
- Column structure is present

### 3.2 Create New Task
**File:** `e2e/tasks.spec.ts`  
**Test:** "should create a new task"

**Journey:**
1. User clicks "Add Task" button
2. Task creation dialog appears
3. User fills in:
   - Title: "Test Task"
   - Description: "This is a test task description"
   - Priority: 5
   - Stage: "dev"
4. User clicks "Create"
5. New task appears in Todo column

**Validates:**
- Task creation dialog
- Form submission
- Task appears on board

### 3.3 Drag and Drop Tasks
**File:** `e2e/tasks.spec.ts`  
**Test:** "should drag task between columns"

**Journey:**
1. User drags task from Todo column
2. User drops task in In Progress column
3. Task moves to new column
4. Task status updates

**Validates:**
- Drag and drop functionality
- Status updates on move
- UI reflects changes

### 3.4 View Task Details
**File:** `e2e/tasks.spec.ts`  
**Test:** "should open task drawer on click"

**Journey:**
1. User clicks on a task card
2. Task drawer slides open from right
3. Drawer displays:
   - Task title
   - Description
   - Priority
   - Stage information
   - Checklist items
   - Messages section

**Validates:**
- Task drawer opens
- Details are displayed
- All sections are present

### 3.5 Update Task Information
**File:** `e2e/tasks.spec.ts`  
**Test:** "should update task details"

**Journey:**
1. User opens task drawer
2. User clicks "Edit" button
3. Form becomes editable
4. User changes title to "Updated Task Title"
5. User clicks "Save"
6. Changes are reflected immediately

**Validates:**
- Edit mode toggle
- Field updates
- Changes persist

### 3.6 Manage Checklist Items
**File:** `e2e/tasks.spec.ts`  
**Test:** "should add checklist items"

**Journey:**
1. User opens task drawer
2. User clicks "Add checklist item"
3. User types "Complete unit tests"
4. User presses Enter
5. Item is added to checklist
6. User clicks checkbox to mark complete
7. Item shows as completed

**Validates:**
- Checklist addition
- Item toggling
- State persistence

### 3.7 Add Task Messages
**File:** `e2e/tasks.spec.ts`  
**Test:** "should add messages to task"

**Journey:**
1. User opens task drawer
2. User types message: "This task needs review"
3. User presses Enter
4. Message appears in conversation thread
5. Timestamp is displayed

**Validates:**
- Message submission
- Message display
- Conversation threading

### 3.8 Filter Tasks by Stage
**File:** `e2e/tasks.spec.ts`  
**Test:** "should filter tasks by stage"

**Journey:**
1. User clicks "Filter by stage" button
2. Dropdown menu appears with stage options
3. User selects "dev"
4. Board refreshes to show only dev stage tasks
5. All visible tasks show "dev" badge

**Validates:**
- Filter functionality
- Filtered view updates
- Stage badges display

## 4. Agent Gateway User Journeys

### 4.1 Agent Registration
**File:** `e2e/agent-gateway.spec.ts`  
**Test:** "should register agent with valid token"

**Journey:**
1. Agent sends POST to `/agent/register` with:
   - Valid auth token in header
   - Agent ID, name, capabilities
2. System validates token
3. System creates session
4. Returns session ID

**Validates:**
- Token authentication
- Session creation
- Registration flow

### 4.2 Unauthorized Access Prevention
**File:** `e2e/agent-gateway.spec.ts`  
**Test:** "should reject requests without auth token"

**Journey:**
1. Request sent without Authorization header
2. System returns 401 Unauthorized
3. No session is created

**Validates:**
- Security enforcement
- Token requirement

### 4.3 Task Claiming
**File:** `e2e/agent-gateway.spec.ts`  
**Test:** "should claim a task"

**Journey:**
1. Agent registers and receives session ID
2. Agent sends POST to `/agent/tasks/claim` with:
   - Session ID
   - Filter criteria (stage: dev, status: todo)
3. System finds matching task
4. Task is assigned to agent
5. Task details returned

**Validates:**
- Task assignment logic
- Filter matching
- Claim mechanism

### 4.4 Progress Reporting
**File:** `e2e/agent-gateway.spec.ts`  
**Test:** "should report task progress"

**Journey:**
1. Agent has active session
2. Agent sends progress update:
   - Task ID
   - Progress percentage (50%)
   - Status message
   - Code artifacts
3. System updates task progress
4. Progress reflected in UI

**Validates:**
- Progress tracking
- Artifact storage
- Real-time updates

### 4.5 Task Completion
**File:** `e2e/agent-gateway.spec.ts`  
**Test:** "should complete a task"

**Journey:**
1. Agent completes work on task
2. Agent sends completion request with:
   - Final artifacts (code, tests)
   - Completion message
3. Task status changes to "Done"
4. Session is closed

**Validates:**
- Completion flow
- Status updates
- Artifact delivery

### 4.6 Agent Questions
**File:** `e2e/agent-gateway.spec.ts`  
**Test:** "should handle agent questions"

**Journey:**
1. Agent encounters ambiguity
2. Agent posts question with context
3. System creates question record
4. Question appears in task UI
5. Human can respond
6. Response sent back to agent

**Validates:**
- Question submission
- Human-in-the-loop flow
- Bidirectional communication

## Test Execution

### Running All Tests
```bash
bun test:e2e
```

### Running Specific Journey Categories
```bash
# Authentication tests only
bun test:e2e e2e/auth.spec.ts

# Project management tests
bun test:e2e e2e/projects.spec.ts

# Task management tests
bun test:e2e e2e/tasks.spec.ts

# Agent gateway tests
bun test:e2e e2e/agent-gateway.spec.ts
```

### Interactive Test Development
```bash
# UI Mode - Visual test runner
bun test:e2e:ui

# Debug Mode - Step through tests
bun test:e2e:debug

# Headed Mode - See browser actions
bun test:e2e:headed
```

## Test Data Requirements

### Database State
- Tests run against `solo_unicorn_test` database
- Database is created fresh for each test run
- Schema is applied via `db:push:test`

### Authentication Mocking
- Tests use mocked authentication tokens
- LocalStorage is pre-populated for authenticated tests
- OAuth flows are simulated

### Agent Tokens
- Test agent token can be configured via environment
- Default test token used if not specified

## Adding New User Journeys

When adding new features, ensure to:

1. **Identify the user journey** - What steps does the user take?
2. **Create test file** - Group related journeys together
3. **Mock dependencies** - Use test doubles where appropriate
4. **Assert outcomes** - Verify both UI and data changes
5. **Document here** - Add the journey to this document

## Coverage Goals

We aim for:
- **100% coverage** of critical user paths
- **80% coverage** of secondary features
- **All API endpoints** tested
- **All error states** handled

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Commits to main branch
- Pre-deployment checks
- Nightly test runs

Failed tests block deployment to ensure quality.