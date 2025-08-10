import { protectedProcedure, publicProcedure, requireOwnerAuth } from "../lib/orpc";
import { todoRouter } from "./todo";
import { projectsRouter } from "./projects";
import { repositoriesRouter } from "./repositories";
import { boardsRouter } from "./boards";
import { tasksRouter } from "./tasks";
import { agentsRouter } from "./agents";

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
  projects: projectsRouter,
  repositories: repositoriesRouter,
  boards: boardsRouter,
  tasks: tasksRouter,
  agents: agentsRouter,
};
export type AppRouter = typeof appRouter;
