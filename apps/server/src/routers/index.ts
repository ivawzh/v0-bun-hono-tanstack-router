import { o, protectedProcedure, publicProcedure } from "../lib/orpc";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { actorsRouter } from "./actors";
import { repositoriesRouter } from "./repositories";
import { agentsRouter as userAgentsRouter } from "./user-agents";
import { authRouter } from "./auth";

export const appRouter = o.router({
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  // Protected endpoint example
  ownerPing: protectedProcedure.handler(() => ({ ok: true })),
  auth: authRouter,
  projects: projectsRouter,
  actors: actorsRouter,
  repositories: repositoriesRouter,
  userAgents: userAgentsRouter,
  tasks: tasksRouter,
});
export type AppRouter = typeof appRouter;
