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
    if (error.message?.includes("UNAUTHORIZED") || error.code === "UNAUTHORIZED") {
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