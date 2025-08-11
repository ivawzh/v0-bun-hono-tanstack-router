import { Hono } from 'hono';
import { openauth } from '../lib/openauth';
import { setAuthCookies } from '../ops/authCookies';
import { db } from '../db';
import { users } from '../db/schema/core';
import { eq } from 'drizzle-orm';
import { jwtDecode } from '../ops/authCookies';
import type { AccessTokenPayload } from '../ops/authCookies';

const app = new Hono();

app.get('/callback', async (c) => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return c.text('Query param `code` is missing from oauth provider callback', 400);
  }

  const redirectUrl = `${url.origin}/api/oauth/callback`;
  const exchanged = await openauth.exchange(code, redirectUrl);

  if (exchanged.err) {
    const { message, stack, name, cause } = exchanged.err;
    return c.json(
      {
        message,
        stack,
        name,
        cause,
      },
      400
    );
  }

  await setAuthCookies(c, {
    accessToken: exchanged.tokens.access,
    refreshToken: exchanged.tokens.refresh,
  });

  await upsertUserIfNewAuthInfo(exchanged.tokens.access);

  return c.redirect(url.origin);
});

async function upsertUserIfNewAuthInfo(accessToken: string) {
  const result = jwtDecode<AccessTokenPayload>(accessToken);

  if (!result.ok) return;

  const email = result.good.subject.properties.email;

  const userFound = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (userFound) {
    // Update user info if there's new information
    const name = result.good.subject.properties.name;
    if (name && name !== userFound.displayName) {
      await db
        .update(users)
        .set({ displayName: name })
        .where(eq(users.email, email));
    }
    return;
  }

  // Create new user
  await db.insert(users).values({
    email,
    displayName: result.good.subject.properties.name || email.split('@')[0],
  });
}

export { app as oauthCallbackRoutes };