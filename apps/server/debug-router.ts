// Debug script to understand router structure
import { authRouter } from "./src/routers/auth";
import { projectsRouter } from "./src/routers/projects";

console.log("=== Auth Router ===");
console.log("authRouter type:", typeof authRouter);
console.log("authRouter keys:", Object.keys(authRouter));

if (authRouter.authenticate) {
  console.log("authenticate type:", typeof authRouter.authenticate);
  console.log("authenticate keys:", Object.keys(authRouter.authenticate));
}

console.log("=== Projects Router ===");
console.log("projectsRouter type:", typeof projectsRouter);
console.log("projectsRouter keys:", Object.keys(projectsRouter));

if (projectsRouter.list) {
  console.log("list type:", typeof projectsRouter.list);
  console.log("list keys:", Object.keys(projectsRouter.list));
}