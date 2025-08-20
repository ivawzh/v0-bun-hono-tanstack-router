/**
 * Authentication mocking utilities for tests
 * Provides mock contexts with authenticated and unauthenticated states
 */
import type { Context as HonoContext } from "hono";
import type { Context } from "../lib/context";
import type { TestUser } from "./fixtures";

/**
 * Create a mock Hono context for testing
 */
function createMockHonoContext(): HonoContext {
  const headers = new Headers();
  
  return {
    req: {
      header: () => undefined,
      raw: {
        headers: headers,
      },
    },
    get: () => undefined,
    set: () => {},
    header: () => {},
    res: {
      headers: headers,
    },
    env: {},
  } as any;
}

/**
 * Create an authenticated test context
 */
export function createAuthenticatedContext(user: TestUser): Context {
  const honoContext = createMockHonoContext();
  
  return {
    session: {
      user: {
        email: user.email,
        name: user.displayName,
      },
    },
    appUser: user,
    context: honoContext,
  };
}

/**
 * Create an authenticated context with protectedProcedure structure
 * This mimics what the requireAuth middleware adds to context
 */
export function createProtectedContext(user: TestUser) {
  return {
    session: {
      user: {
        email: user.email,
        name: user.displayName,
      },
    },
    user: user, // This is what protectedProcedure adds
  };
}

/**
 * Create an unauthenticated test context
 */
export function createUnauthenticatedContext(): Context {
  const honoContext = createMockHonoContext();
  
  return {
    session: null,
    appUser: null,
    context: honoContext,
  };
}

/**
 * Mock oRPC context for testing procedures
 */
export function createMockORPCContext(context: Context) {
  return {
    context,
    input: undefined,
    rawInput: undefined,
  };
}

/**
 * Create authenticated oRPC context
 */
export function createAuthenticatedORPCContext(user: TestUser) {
  const context = createAuthenticatedContext(user);
  return createMockORPCContext(context);
}

/**
 * Create unauthenticated oRPC context
 */
export function createUnauthenticatedORPCContext() {
  const context = createUnauthenticatedContext();
  return createMockORPCContext(context);
}