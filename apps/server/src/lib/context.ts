import type { Context as HonoContext } from "hono";
import { auth } from "./auth";
import { db } from "../db";
import { users } from "../db/schema/core";
import { eq } from "drizzle-orm";

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

  let appUser: typeof users.$inferSelect | null = null;
  try {
    if (session?.user?.email) {
      const existing = await db.select().from(users).where(eq(users.email, session.user.email)).limit(1);
      if (existing.length > 0) {
        appUser = existing[0];
      } else {
        const displayName = session.user.name || session.user.email.split("@")[0] || "User";
        const inserted = await db
          .insert(users)
          .values({ email: session.user.email, displayName })
          .returning();
        appUser = inserted[0] ?? null;
      }
    }
  } catch (err) {
    console.error("Failed to resolve/create app user for session user", err);
  }

  return {
    session,
    appUser,
  };
}


export type Context = Awaited<ReturnType<typeof createContext>>;
