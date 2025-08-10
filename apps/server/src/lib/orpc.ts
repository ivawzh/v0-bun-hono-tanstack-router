import { ORPCError, os } from "@orpc/server";
import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
      user: context.session.user,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

// Minimal owner-only guard for day-1 authorization model
export const requireOwnerAuth = o.middleware(async ({ context, next }) => {
  const user = context.session?.user;
  if (!user) throw new ORPCError('UNAUTHORIZED');
  // For day-0, treat any authenticated user as owner; later: check role/claims
  return next({ context: { ...context, user } });
});

// Export the oRPC builder for creating routers
export const orpc = {
  router: o.router,
  protectedRouter: o.router.use(requireAuth),
};
