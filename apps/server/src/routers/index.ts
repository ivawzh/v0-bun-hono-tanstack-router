import { o, protectedProcedure, publicProcedure } from "../lib/orpc";
import { todoRouter } from "./todo";
import { projectsRouter } from "./projects";
// import { repositoriesRouter } from "./repositories"; // Removed in simplified architecture
import { tasksRouter } from "./tasks";
import { repoAgentsRouter } from "./repo-agents";
import { actorsRouter } from "./actors";
import { agentsRouter } from "./agents";
import { voiceRouter } from "./voice";
import { authRouter } from "./auth";
import { claudeProjectsRouter } from "./claude-projects";

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
  todo: todoRouter,
  projects: projectsRouter,
  // repositories: repositoriesRouter, // Removed in simplified architecture
  repoAgents: repoAgentsRouter,
  actors: actorsRouter,
  tasks: tasksRouter,
  agents: agentsRouter,
  voice: voiceRouter,
  claudeProjects: claudeProjectsRouter,
});
export type AppRouter = typeof appRouter;
