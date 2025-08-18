import { o, protectedProcedure, publicProcedure } from "../lib/orpc";
import { projectsRouter } from "./projects";
// import { tasksRouter } from "./tasks";
// import { repoAgentsRouter } from "./repo-agents";
import { actorsRouter } from "./actors";
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
  // Temporarily disabled V1 routers during V2 migration
  // repoAgents: repoAgentsRouter,
  actors: actorsRouter,
  // tasks: tasksRouter,
});
export type AppRouter = typeof appRouter;
