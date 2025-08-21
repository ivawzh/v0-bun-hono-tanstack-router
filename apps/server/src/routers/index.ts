import { o, protectedProcedure, publicProcedure } from "../lib/orpc";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { agentsRouter } from "./agents";
import { actorsRouter } from "./actors";
import { repositoriesRouter } from "./repositories";
import { authRouter } from "./auth";
import { invitationsRouter } from "./invitations";

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
  agents: agentsRouter,
  actors: actorsRouter,
  repositories: repositoriesRouter,
  tasks: tasksRouter,
  invitations: invitationsRouter,
});
export type AppRouter = typeof appRouter;
