import { Hono } from 'hono';
import { openauth } from '../lib/openauth';
import { setAuthCookies } from '../ops/authCookies';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { jwtDecode } from '../ops/authCookies';
import type { AccessTokenPayload } from '../ops/authCookies';
import { isEmailAuthorized } from '../utils/email-authorization';

const app = new Hono();

app.get('/callback', async (c) => {
  console.log("🚀 -> '/callback':", '/callback');
  const url = new URL(c.req.url);
  console.log(`🚀 -> url:`, url);
  const code = url.searchParams.get('code');

  if (!code) {
    return c.text('Query param `code` is missing from oauth provider callback', 400);
  }

  // Ensure we use the correct protocol - https for production
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : url.protocol.slice(0, -1);
  const redirectUrl = `${protocol}://${url.hostname}/api/oauth/callback`;
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

  // Extract user email from token for authorization check
  const tokenResult = jwtDecode<AccessTokenPayload>(exchanged.tokens.access);
  if (!tokenResult.ok) {
    console.error('Failed to decode access token for authorization check');
    return c.json({
      error: 'Authentication Error',
      message: 'Failed to process authentication token',
    }, 400);
  }

  const payload: any = tokenResult.good as any;
  const userEmail =
    payload?.subject?.properties?.email ??
    payload?.properties?.email ??
    payload?.email ??
    payload?.user?.email ??
    payload?.userinfo?.email ??
    payload?.claims?.email;

  if (!userEmail) {
    console.error('No email found in access token payload');
    return c.json({
      error: 'Authentication Error',
      message: 'Email address not provided by authentication provider',
    }, 400);
  }

  // Check if user is authorized
  const authResult = isEmailAuthorized(userEmail);
  if (!authResult.isAuthorized) {
    console.warn(`Unauthorized access attempt by email: ${userEmail}`);
    return c.json({
      error: 'Access Denied',
      message: authResult.error || 'Your email address is not authorized to access this application. Please contact the administrator.',
    }, 403);
  }

  console.log(`Authorized user login: ${userEmail}`);

  await setAuthCookies(c, {
    accessToken: exchanged.tokens.access,
    refreshToken: exchanged.tokens.refresh,
  });

  await upsertUserIfNewAuthInfo(exchanged.tokens.access);

  const frontendOrigin =
    process.env.FRONTEND_ORIGIN ||
    process.env.WEB_APP_URL ||
    'http://localhost:8302';
  console.log('🔁 Redirecting back to frontend:', frontendOrigin);
  return c.redirect(frontendOrigin);
});

async function upsertUserIfNewAuthInfo(accessToken: string) {
  console.log(`🚀 -> upsertUserIfNewAuthInfo -> accessToken:`, accessToken);
  const result = jwtDecode<AccessTokenPayload>(accessToken);
  console.log(`🚀 -> upsertUserIfNewAuthInfo -> result:`, JSON.stringify(result, null, 2));

  if (!result.ok) return;

  const payload: any = result.good as any;
  const email =
    payload?.subject?.properties?.email ??
    payload?.properties?.email ??
    payload?.email ??
    payload?.user?.email ??
    payload?.userinfo?.email ??
    payload?.claims?.email;

  if (!email) {
    console.error('No email found in access token payload. Payload was:', payload);
    return;
  }

  const userFound = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (userFound) {
    // Update user info if there's new information
    const name =
      payload?.subject?.properties?.name ??
      payload?.properties?.name ??
      payload?.name ??
      payload?.user?.name ??
      payload?.userinfo?.name;
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
    displayName:
      payload?.subject?.properties?.name ??
      payload?.properties?.name ??
      payload?.name ??
      payload?.user?.name ??
      payload?.userinfo?.name ??
      email.split('@')[0],
  });
}

export { app as oauthCallbackRoutes };
