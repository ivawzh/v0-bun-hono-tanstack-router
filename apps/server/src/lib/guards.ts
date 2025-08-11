import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { resolveAuthCookies } from "../ops/authCookies";

export async function requireOwnerAuth(c: Context, next: Next) {
  const authResult = await resolveAuthCookies(c);

  if (!authResult.ok) {
    throw new HTTPException(401, { message: "Unauthorized - Owner authentication required" });
  }

  const userInfo = authResult.good.subject.properties;
  c.set("user", {
    email: userInfo.email,
    name: userInfo.name,
    id: userInfo.email, // Using email as ID for compatibility
  });
  c.set("session", { 
    userId: userInfo.email,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min from now
  });
  
  await next();
}

export async function requireAgentAuth(c: Context, next: Next) {
  const agentToken = c.req.header("X-Agent-Token");
  
  if (!agentToken) {
    throw new HTTPException(401, { message: "Unauthorized - Agent token required" });
  }

  const expectedToken = process.env.AGENT_AUTH_TOKEN;
  
  if (!expectedToken) {
    console.error("AGENT_AUTH_TOKEN not configured");
    throw new HTTPException(500, { message: "Agent authentication not configured" });
  }

  if (agentToken !== expectedToken) {
    throw new HTTPException(401, { message: "Invalid agent token" });
  }

  const agentId = c.req.header("X-Agent-ID");
  if (agentId) {
    c.set("agentId", agentId);
  }
  
  await next();
}

export function requireAuth(type: "owner" | "agent" = "owner") {
  return type === "owner" ? requireOwnerAuth : requireAgentAuth;
}