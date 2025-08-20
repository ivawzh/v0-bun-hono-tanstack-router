# RPC Endpoint Testing Guide

This document demonstrates how to properly test oRPC endpoints using the test infrastructure.

## Basic Setup

```typescript
import { describe, it, expect } from "bun:test";
import { setupDatabaseTests } from "./test-utils";
import { 
  createCompleteTestSetup,
  createTestUser,
  createTestProject
} from "./fixtures";
import {
  testRPCWithAuth,
  testRPCWithoutAuth,
  assertRPCUnauthorized,
  createMockORPCCall
} from "./rpc-test-helpers";

// Setup database for all tests in this file
setupDatabaseTests();
```

## Testing Protected Procedures

```typescript
describe("Projects Router", () => {
  it("should list user projects", async () => {
    // Create test data
    const setup = await createCompleteTestSetup();
    
    // Mock the procedure call
    const mockCall = createMockORPCCall(
      createAuthenticatedContext(setup.user),
      {}
    );
    
    // Test the procedure directly (you would import the actual procedure handler)
    // const result = await projectsListHandler(mockCall);
    // expect(result).toHaveLength(1);
    // expect(result[0].id).toBe(setup.project.id);
  });
  
  it("should reject unauthenticated requests", async () => {
    const mockCall = createMockORPCCall(
      createUnauthenticatedContext(),
      {}
    );
    
    // This should throw UNAUTHORIZED
    // await expect(() => projectsListHandler(mockCall)).toThrow("UNAUTHORIZED");
  });
});
```

## Testing Input Validation

```typescript
describe("Input Validation", () => {
  it("should validate UUID parameters", async () => {
    const user = await createTestUser();
    
    const invalidInputs = [
      { input: { id: "invalid-uuid" }, expectedError: "Invalid UUID" },
      { input: { id: "" }, expectedError: "required" },
    ];
    
    // Use the testInputValidation helper
    await testInputValidation(procedureHandler, user, invalidInputs);
  });
});
```

## Testing Authorization

```typescript
describe("Project Authorization", () => {
  it("should only allow project members to access project data", async () => {
    const setup1 = await createCompleteTestSetup();
    const setup2 = await createCompleteTestSetup();
    
    // Test with project owner - should succeed
    await testRPCWithAuth(
      projectGetHandler,
      setup1.user,
      { id: setup1.project.id }
    );
    
    // Test with non-member - should fail
    try {
      await testRPCWithAuth(
        projectGetHandler,
        setup2.user,
        { id: setup1.project.id }
      );
      throw new Error("Expected authorization to fail");
    } catch (error) {
      expect(error.message).toContain("Project not found");
    }
  });
});
```

## Key Points

1. **Always use `setupDatabaseTests()`** - This ensures proper database cleanup between tests
2. **Create test data with fixtures** - Use `createCompleteTestSetup()` and related helpers
3. **Mock contexts properly** - Use `createAuthenticatedContext()` and `createUnauthenticatedContext()`
4. **Test both success and failure cases** - Include authentication, authorization, and input validation tests
5. **Use descriptive test names** - Make it clear what each test is verifying

## Available Test Utilities

- `setupDatabaseTests()` - Database lifecycle management
- `createTestUser()` - Create test user
- `createTestProject()` - Create test project with owner
- `createCompleteTestSetup()` - Create user, project, repo, agent, and actor
- `createAuthenticatedContext()` - Mock authenticated request context
- `createUnauthenticatedContext()` - Mock unauthenticated request context
- `createMockORPCCall()` - Create mock oRPC call structure
- `testRPCWithAuth()` - Test procedure with authenticated user
- `assertRPCUnauthorized()` - Assert procedure throws UNAUTHORIZED
- `testInputValidation()` - Test multiple invalid inputs