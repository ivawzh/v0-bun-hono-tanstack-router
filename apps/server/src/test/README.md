# Test Infrastructure

This directory contains the comprehensive test infrastructure for Solo Unicorn server testing.

## Overview

The test infrastructure provides:

- **Database Management**: Test database setup, cleanup, and migration utilities
- **Test Fixtures**: Factory functions for creating test data (users, projects, repos, etc.)
- **Authentication Mocking**: Mock authenticated and unauthenticated contexts
- **RPC Testing Helpers**: Utilities for testing oRPC endpoints with proper context
- **General Test Utilities**: Common helpers and assertions

## Quick Start

```typescript
import bunTest from "bun:test";
const { describe, it, expect } = bunTest;

import { 
  setupDatabaseTests, 
  createCompleteTestSetup,
  testRPCWithAuth 
} from "./test";

// Setup database hooks
setupDatabaseTests();

describe("My Feature", () => {
  it("should work", async () => {
    const setup = await createCompleteTestSetup();
    // Test your feature
  });
});
```

## Test Database Setup

The test infrastructure automatically manages a PostgreSQL test database:

1. **Database Creation**: `bun run test:setup` creates and migrates test database
2. **Automatic Cleanup**: Each test starts with a clean database state
3. **Isolation**: Tests are fully isolated from each other

### Environment Variables

- `DATABASE_TEST_URL`: Test database connection string (default: `postgresql://$USER@localhost:5432/solo_unicorn_test`)
- `NODE_ENV`: Must be set to `"test"` for tests

## Test Fixtures

Factory functions for creating test data:

```typescript
import { 
  createTestUser,
  createTestProject, 
  createCompleteTestSetup 
} from "./fixtures";

// Create individual entities
const user = await createTestUser();
const project = await createTestProject(user.id);

// Create complete setup with all entities
const setup = await createCompleteTestSetup();
// Returns: { user, project, repository, agent, actor }
```

## Authentication Testing

Mock authentication contexts for testing protected endpoints:

```typescript
import { 
  createAuthenticatedContext,
  createUnauthenticatedContext 
} from "./auth-mocks";

const user = await createTestUser();
const authContext = createAuthenticatedContext(user);
const unauthContext = createUnauthenticatedContext();
```

## RPC Endpoint Testing

Helper utilities for testing oRPC procedures:

```typescript
import { 
  testRPCWithAuth,
  testAuthorizationRequirement 
} from "./rpc-test-helpers";

// Test that endpoint requires authentication
await testAuthorizationRequirement(myProcedure, sampleInput);

// Test with authenticated user
const result = await testRPCWithAuth(myProcedure, user, input);
```

## File Structure

```
src/test/
├── README.md              # This file
├── index.ts              # Main exports (may have import issues - use direct imports)
├── setup.ts              # Database setup and teardown
├── fixtures.ts           # Test data factory functions
├── auth-mocks.ts         # Authentication context mocking
├── rpc-test-helpers.ts   # RPC endpoint testing utilities
├── test-utils.ts         # General test utilities and database hooks
└── *.test.ts            # Test files
```

## Available Scripts

- `bun run test` - Run all tests
- `bun run test:watch` - Run tests in watch mode
- `bun run test:setup` - Create and migrate test database
- `bun run test:teardown` - Drop test database

## Best Practices

1. **Use Direct Imports**: Due to Bun's import handling, prefer importing directly from specific files rather than the index
2. **Database Cleanup**: Always use `setupDatabaseTests()` in test files that need database access
3. **Test Isolation**: Each test gets a clean database state automatically
4. **Authentication**: Use mock contexts rather than real authentication in tests
5. **Fixtures**: Use factory functions rather than hardcoded test data

## Example Test

```typescript
import bunTest from "bun:test";
const { describe, it, expect } = bunTest;

import { setupDatabaseTests } from "./test-utils";
import { createCompleteTestSetup } from "./fixtures";
import { testRPCWithAuth } from "./rpc-test-helpers";

// Setup database hooks
setupDatabaseTests();

describe("Projects API", () => {
  it("should list user projects", async () => {
    const setup = await createCompleteTestSetup();
    
    const result = await testRPCWithAuth(
      myProjectsListProcedure,
      setup.user,
      {}
    );
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(setup.project.id);
  });
});
```

## Troubleshooting

- **Import Errors**: Use direct imports instead of the index file
- **Database Errors**: Ensure test database exists and is migrated with `bun run test:setup`
- **Auth Errors**: Make sure to use mock contexts for testing, not real authentication
- **Test Isolation**: If tests are affecting each other, ensure `setupDatabaseTests()` is called