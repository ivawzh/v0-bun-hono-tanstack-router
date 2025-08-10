import { protectedProcedure, publicProcedure, requireOwnerAuth } from "../lib/orpc";
import { todoRouter } from "./todo";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  // Example of applying owner guard explicitly to a route group in future
  ownerPing: requireOwnerAuth.handler(() => ({ ok: true })),
  todo: todoRouter,
};
export type AppRouter = typeof appRouter;
