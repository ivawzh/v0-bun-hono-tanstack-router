import { Context, Next } from "hono";
import { auth } from "./auth";
import { HTTPException } from "hono/http-exception";
import { getCookie } from "hono/cookie";

export async function requireOwnerAuth(c: Context, next: Next) {
  const headers = new Headers();
  const authCookie = getCookie(c, "better-auth.session_token");
  
  if (authCookie) {
    headers.set("cookie", `better-auth.session_token=${authCookie}`);
  }

  const authorization = c.req.header("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }

  const session = await auth.api.getSession({
    headers: headers,
  });

  if (!session) {
    throw new HTTPException(401, { message: "Unauthorized - Owner authentication required" });
  }

  c.set("user", session.user);
  c.set("session", session.session);
  
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