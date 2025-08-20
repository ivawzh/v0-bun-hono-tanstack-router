# Solo Unicorn Test Infrastructure

This directory contains comprehensive testing infrastructure for Solo Unicorn's RPC endpoints and business logic.

## Overview

The test infrastructure provides:
- Complete database setup and cleanup utilities
- Authentication mocking for protected endpoints
- RPC endpoint testing helpers
- Comprehensive test fixtures and data seeding
- Project-scoped authorization testing
- Enhanced test runner configuration

## Core Components

### 1. Database Management (`setup.ts`, `test-utils.ts`)

**Database Setup:**
```typescript
import { setupDatabaseTests, getTestDb } from "./test-utils";

// Use in any test file that needs database access
setupDatabaseTests();

// Get database instance in tests
const db = getTestDb();
```

**Features:**
- Automatic test database connection
- Clean slate for each test (cleanup between tests)
- Proper connection pooling and cleanup
- Support for test database URL configuration

### 2. Authentication Mocking (`auth-mocks.ts`)

**Context Creation:**
```typescript
import { 
  createAuthenticatedContext, 
  createUnauthenticatedContext,
  createProtectedContext 
} from "./auth-mocks";

// For regular context
const authContext = createAuthenticatedContext(user);
const unauthContext = createUnauthenticatedContext();

// For protected procedures (with user property)
const protectedContext = createProtectedContext(user);
```

### 3. Test Fixtures (`fixtures.ts`)

**Available Fixtures:**
- `createTestUser()` - Individual users
- `createTestProject()` - Projects with ownership  
- `createTestRepository()` - Repository configurations
- `createTestAgent()` - AI agents
- `createTestActor()` - Agent personalities
- `createTestTask()` - Tasks with various statuses
- `createCompleteTestSetup()` - Full project setup
- `createComplexTestScenario()` - Multi-user test scenarios
- `seedTestDatabase()` - Large-scale realistic data

### 4. RPC Testing Utilities (`rpc-test-helpers.ts`)

**Basic RPC Testing:**
```typescript
import { 
  testRealRPCWithAuth,
  testRealRPCWithoutAuth,
  assertRealRPCUnauthorized 
} from "./rpc-test-helpers";

// Test with authenticated user
const result = await testRealRPCWithAuth(procedure, user, input);

// Assert unauthorized access is blocked
await assertRealRPCUnauthorized(procedure, input);
```

### 5. Test Runner Configuration (`bunfig.toml`)

**Features:**
- Test database environment setup
- 30-second timeout for complex tests
- Sequential test execution (concurrency = 1) to avoid database conflicts
- Watch mode configuration with proper ignore patterns

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Verbose output
bun test --verbose
```

## Test Infrastructure Status

✅ **Complete Features:**
1. **Database Setup & Cleanup** - Automatic test database management
2. **Authentication Mocking** - Full auth context simulation
3. **Test Fixtures** - Comprehensive data creation utilities
4. **Database Seeding** - Multi-user scenarios and realistic data
5. **Test Runner Config** - Optimized Bun test configuration
6. **Project Authorization Testing** - Multi-user access validation
7. **RPC Test Helpers** - Enhanced endpoint testing utilities

The infrastructure is ready for comprehensive RPC endpoint testing with proper isolation, authentication, and data management.
