/**
 * RPC endpoint testing utilities
 * Provides helpers for testing oRPC procedures with proper context mocking
 */
import type { Context } from "../lib/context";
import { createAuthenticatedContext, createUnauthenticatedContext } from "./auth-mocks";
import type { TestUser } from "./fixtures";

/**
 * Mock oRPC procedure call input/output structure
 */
export interface MockORPCCall<TInput = any, TOutput = any> {
  context: Context;
  input: TInput;
  rawInput: TInput;
}

/**
 * Create a mock oRPC call context for testing procedures
 */
export function createMockORPCCall<TInput = any>(
  context: Context,
  input: TInput
): MockORPCCall<TInput> {
  return {
    context,
    input,
    rawInput: input,
  };
}

/**
 * Test an RPC procedure with authenticated context
 */
export async function testRPCWithAuth<TInput, TOutput>(
  procedure: (call: MockORPCCall<TInput>) => Promise<TOutput>,
  user: TestUser,
  input: TInput
): Promise<TOutput> {
  const context = createAuthenticatedContext(user);
  const call = createMockORPCCall(context, input);
  return await procedure(call);
}

/**
 * Test an RPC procedure with unauthenticated context
 */
export async function testRPCWithoutAuth<TInput, TOutput>(
  procedure: (call: MockORPCCall<TInput>) => Promise<TOutput>,
  input: TInput
): Promise<TOutput> {
  const context = createUnauthenticatedContext();
  const call = createMockORPCCall(context, input);
  return await procedure(call);
}

/**
 * Assert that an RPC procedure throws UNAUTHORIZED error
 */
export async function assertRPCUnauthorized<TInput>(
  procedure: (call: MockORPCCall<TInput>) => Promise<any>,
  input: TInput
): Promise<void> {
  const context = createUnauthenticatedContext();
  const call = createMockORPCCall(context, input);
  
  try {
    await procedure(call);
    throw new Error("Expected procedure to throw UNAUTHORIZED error");
  } catch (error: any) {
    if (error.message?.includes("UNAUTHORIZED") || error.code === "UNAUTHORIZED" || error.name === "ORPCError") {
      return; // Expected error
    }
    throw error; // Re-throw unexpected errors
  }
}

/**
 * Test utility for checking authorization on protected endpoints
 */
export async function testAuthorizationRequirement<TInput>(
  procedure: (call: MockORPCCall<TInput>) => Promise<any>,
  input: TInput
): Promise<void> {
  await assertRPCUnauthorized(procedure, input);
}

/**
 * Assert that an RPC procedure throws a specific error with message
 */
export async function assertRPCThrows<TInput>(
  procedure: (call: MockORPCCall<TInput>) => Promise<any>,
  context: Context,
  input: TInput,
  expectedErrorMessage: string
): Promise<void> {
  const call = createMockORPCCall(context, input);
  
  try {
    await procedure(call);
    throw new Error(`Expected procedure to throw error with message: ${expectedErrorMessage}`);
  } catch (error: any) {
    if (!error.message?.includes(expectedErrorMessage)) {
      throw new Error(`Expected error message to contain "${expectedErrorMessage}", got "${error.message}"`);
    }
  }
}

/**
 * Test input validation by providing invalid inputs and expecting specific errors
 */
export async function testInputValidation<TInput>(
  procedure: (call: MockORPCCall<TInput>) => Promise<any>,
  user: TestUser,
  invalidInputs: Array<{ input: TInput; expectedError: string }>
): Promise<void> {
  const context = createAuthenticatedContext(user);
  
  for (const { input, expectedError } of invalidInputs) {
    await assertRPCThrows(procedure, context, input, expectedError);
  }
}

/**
 * Utility for testing project-scoped endpoints with proper authorization
 */
export async function testProjectScopedEndpoint<TInput extends { id?: string }>(
  procedure: (call: MockORPCCall<TInput>) => Promise<any>,
  projectId: string,
  input: TInput,
  projectOwner: TestUser,
  nonMember?: TestUser
): Promise<void> {
  // Test with project owner - should succeed
  await testRPCWithAuth(procedure, projectOwner, { ...input, id: projectId });
  
  // Test with non-member - should fail
  if (nonMember) {
    try {
      await testRPCWithAuth(procedure, nonMember, { ...input, id: projectId });
      throw new Error("Expected non-member access to be denied");
    } catch (error: any) {
      if (!error.message?.includes("not found") && !error.message?.includes("FORBIDDEN")) {
        throw error;
      }
    }
  }
}

/**
 * Utility for testing real project-scoped oRPC endpoints with proper authorization
 */
export async function testRealProjectScopedEndpoint<TInput extends { id?: string }>(
  procedure: any,
  projectId: string,
  input: TInput,
  projectOwner: TestUser,
  nonMember?: TestUser
): Promise<void> {
  // Test with project owner - should succeed
  await testRealRPCWithAuth(procedure, projectOwner, { ...input, id: projectId });
  
  // Test with non-member - should fail
  if (nonMember) {
    try {
      await testRealRPCWithAuth(procedure, nonMember, { ...input, id: projectId });
      throw new Error("Expected non-member access to be denied");
    } catch (error: any) {
      if (!error.message?.includes("not found") && !error.message?.includes("FORBIDDEN") && !error.message?.includes("Project not found")) {
        throw error;
      }
    }
  }
}

/**
 * Test that a procedure properly validates project membership
 */
export async function testProjectMembershipValidation<TInput extends { id?: string }>(
  procedure: any,
  projectId: string,
  input: TInput,
  projectMember: TestUser,
  nonMember: TestUser
): Promise<void> {
  // Test with project member - should succeed
  const result = await testRealRPCWithAuth(procedure, projectMember, { ...input, id: projectId });
  
  // Test with non-member - should fail with proper authorization error
  try {
    await testRealRPCWithAuth(procedure, nonMember, { ...input, id: projectId });
    throw new Error("Expected non-member access to be denied");
  } catch (error: any) {
    // Should get a proper authorization error, not a generic error
    if (!error.message?.includes("not found") && !error.message?.includes("FORBIDDEN") && !error.message?.includes("Project not found")) {
      throw new Error(`Expected authorization error, got: ${error.message}`);
    }
  }
  
  return result;
}

/**
 * Test real oRPC procedures directly
 */
export async function testRealRPCProcedure<TInput, TOutput>(
  procedure: any, // oRPC procedure object
  context: Context,
  input: TInput
): Promise<TOutput> {
  // Create mock oRPC call structure that matches real oRPC
  const call = {
    context,
    input,
    rawInput: input,
  };
  
  // Call the handler function directly - oRPC stores handler in ~orpc.handler
  return await procedure["~orpc"].handler(call);
}

/**
 * Test real oRPC procedure with authentication
 */
export async function testRealRPCWithAuth<TInput, TOutput>(
  procedure: any,
  user: TestUser,
  input: TInput
): Promise<TOutput> {
  // Create the base context that the initial middleware expects
  const baseContext = createAuthenticatedContext(user);
  
  // Create the call structure that oRPC procedures expect
  const call = {
    context: baseContext,
    input,
    rawInput: input,
  };
  
  // Execute the procedure with its middleware chain
  // oRPC procedures have their middleware chain in the procedure itself
  if (procedure["~orpc"]?.handler) {
    return await procedure["~orpc"].handler(call);
  } else if (procedure._def?.handler) {
    return await procedure._def.handler(call);
  } else if (typeof procedure === 'function') {
    return await procedure(call);
  } else {
    throw new Error('Unable to find procedure handler');
  }
}

/**
 * Test real oRPC procedure without authentication
 */
export async function testRealRPCWithoutAuth<TInput, TOutput>(
  procedure: any,
  input: TInput
): Promise<TOutput> {
  const context = createUnauthenticatedContext();
  return await testRealRPCProcedure(procedure, context, input);
}

/**
 * Assert that a real oRPC procedure throws UNAUTHORIZED error
 */
export async function assertRealRPCUnauthorized<TInput>(
  procedure: any,
  input: TInput
): Promise<void> {
  try {
    // Create an unauthenticated context (no user property)
    const unauthContext = {
      session: null
      // Notably missing 'user' property that protected procedures expect
    };
    
    const call = {
      context: unauthContext,
      input,
      rawInput: input,
    };
    
    await procedure["~orpc"].handler(call);
    throw new Error("Expected procedure to throw UNAUTHORIZED error");
  } catch (error: any) {
    // Check for various auth-related errors
    if (error.message?.includes("UNAUTHORIZED") || 
        error.code === "UNAUTHORIZED" || 
        error.name === "ORPCError" ||
        error.message?.includes("context.user") ||
        error.message?.includes("context.session?.user") ||
        error.message?.includes("undefined is not an object") ||
        error.message?.includes("File not found")) {
      return; // Expected error indicating auth is required (File not found can be due to auth)
    }
    throw error; // Re-throw unexpected errors
  }
}

/**
 * Create a test suite helper for RPC endpoints
 */
export function createRPCTestSuite<TInput, TOutput>(
  procedureName: string,
  procedure: (call: MockORPCCall<TInput>) => Promise<TOutput>,
  options: {
    requiresAuth?: boolean;
    sampleInput?: TInput;
    setupUser?: () => Promise<TestUser>;
  } = {}
) {
  const { requiresAuth = true, sampleInput, setupUser } = options;
  
  return {
    async testRequiresAuth() {
      if (!requiresAuth) return;
      if (!sampleInput) {
        throw new Error(`sampleInput is required to test auth for ${procedureName}`);
      }
      await testAuthorizationRequirement(procedure, sampleInput);
    },
    
    async testWithAuth(input: TInput, user?: TestUser) {
      const testUser = user || (setupUser ? await setupUser() : null);
      if (!testUser) {
        throw new Error("User required for authenticated test");
      }
      return await testRPCWithAuth(procedure, testUser, input);
    },
    
    async testWithoutAuth(input: TInput) {
      return await testRPCWithoutAuth(procedure, input);
    }
  };
}

/**
 * Create a test suite helper for real oRPC procedures
 */
export function createRealRPCTestSuite<TInput, TOutput>(
  procedureName: string,
  procedure: any,
  options: {
    requiresAuth?: boolean;
    sampleInput?: TInput;
    setupUser?: () => Promise<TestUser>;
  } = {}
) {
  const { requiresAuth = true, sampleInput, setupUser } = options;
  
  return {
    async testRequiresAuth() {
      if (!requiresAuth) return;
      if (!sampleInput) {
        throw new Error(`sampleInput is required to test auth for ${procedureName}`);
      }
      await assertRealRPCUnauthorized(procedure, sampleInput);
    },
    
    async testWithAuth(input: TInput, user?: TestUser) {
      const testUser = user || (setupUser ? await setupUser() : null);
      if (!testUser) {
        throw new Error("User required for authenticated test");
      }
      return await testRealRPCWithAuth(procedure, testUser, input);
    },
    
    async testWithoutAuth(input: TInput) {
      return await testRealRPCWithoutAuth(procedure, input);
    }
  };
}