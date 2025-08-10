import type { Context as HonoContext } from "hono";
import { auth } from "./auth";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    session = await auth.api.getSession({
      headers: context.req.raw.headers,
    });
  } catch (err) {
    console.warn("auth.getSession failed; proceeding without session (likely no tables in dev)", err);
  }
  return {
    session,
  };
}


export type Context = Awaited<ReturnType<typeof createContext>>;
