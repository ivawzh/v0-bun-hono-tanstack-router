// Debug script to understand procedure structure
import { authRouter } from "./src/routers/auth";

console.log("=== Procedure internal structure ===");
const authenticate = authRouter.authenticate;

console.log("authenticate:", authenticate);
console.log("authenticate['~orpc']:", authenticate['~orpc']);

// Check the orpc internal structure  
if (authenticate['~orpc']) {
  const orpcData = authenticate['~orpc'];
  console.log("orpc keys:", Object.keys(orpcData));
  
  if (orpcData.handler) {
    console.log("handler found:", typeof orpcData.handler);
  }
  
  if (orpcData._def) {
    console.log("_def found:", orpcData._def);
    console.log("_def keys:", Object.keys(orpcData._def));
  }
}