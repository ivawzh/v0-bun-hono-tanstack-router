import type { Context as HonoContext } from "hono";
import { db } from "../db";
import { users } from "../db/schema/core";
import { eq } from "drizzle-orm";
import { resolveAuthCookies } from "../ops/authCookies";
import type { AccessTokenPayload } from "../ops/authCookies";

export type CreateContextOptions = {
  context: HonoContext;
};

export type MonsterAuthSession = {
  user: {
    email: string;
    name: string;
  };
};

export async function createContext({ context }: CreateContextOptions) {
  let session: MonsterAuthSession | null = null;
  let appUser: typeof users.$inferSelect | null = null;
  
  try {
    const authResult = await resolveAuthCookies(context);
    if (authResult.ok) {
      const userInfo = authResult.good.subject.properties;
      session = {
        user: {
          email: userInfo.email,
          name: userInfo.name,
        }
      };

      // Get or create app user
      const existing = await db.select().from(users).where(eq(users.email, userInfo.email)).limit(1);
      if (existing.length > 0) {
        appUser = existing[0];
      } else {
        const displayName = userInfo.name || userInfo.email.split("@")[0] || "User";
        const inserted = await db
          .insert(users)
          .values({ email: userInfo.email, displayName })
          .returning();
        appUser = inserted[0] ?? null;
      }
    }
  } catch (err) {
    console.warn("Monster Auth session resolution failed; proceeding without session", err);
  }

  return {
    session,
    appUser,
    context, // Pass through Hono context for auth operations
  };
}


export type Context = Awaited<ReturnType<typeof createContext>>;
