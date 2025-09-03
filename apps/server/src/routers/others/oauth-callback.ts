import { Hono } from 'hono'
import { openauth, type AccessTokenPayload } from '@/lib/openauth'
import { setAuthCookies } from '@/services/authCookies'
import { db } from '@/db/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { jwtDecode } from '@/services/authCookies'

const app = new Hono()

app.get('/callback', async (c) => {
  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return c.text('Query param `code` is missing from oauth provider callback', 400)
  }

  // Ensure we use the correct protocol - https for production
  const protocol = process.env.NODE_ENV === 'production'
    ? 'https'
    : url.protocol.slice(0, -1)
  const redirectUrl = `${protocol}://${url.hostname}/api/oauth/callback`
  const exchanged = await openauth.exchange(code, redirectUrl)

  if (exchanged.err) {
    const { message, stack, name, cause } = exchanged.err
    return c.json(
      {
        message,
        stack,
        name,
        cause,
      },
      400,
    )
  }

  // Extract user email from token for authorization check
  const tokenResult = jwtDecode<AccessTokenPayload>(exchanged.tokens.access)
  if (!tokenResult.ok) {
    console.error('Failed to decode access token for authorization check')
    return c.json({
      error: 'Authentication Error',
      message: 'Failed to process authentication token',
    }, 400)
  }

  const payload = tokenResult.good
  console.log(`🚀 -> payload:`, payload)
  const userEmail = payload?.subject?.properties?.email

  if (!userEmail) {
    console.error('No email found in access token payload')
    return c.json({
      error: 'Authentication Error',
      message: 'Email address not provided by authentication provider',
    }, 400)
  }

  await setAuthCookies(c, {
    accessToken: exchanged.tokens.access,
    refreshToken: exchanged.tokens.refresh,
  })

  await upsertUserIfNewAuthInfo(exchanged.tokens.access)

  const frontendOrigin
    = process.env.FRONTEND_ORIGIN
      || process.env.WEB_APP_URL
      || 'http://localhost:8302'
  console.log('🔁 Redirecting back to frontend:', frontendOrigin)
  return c.redirect(frontendOrigin)
})

async function upsertUserIfNewAuthInfo(accessToken: string) {
  const result = jwtDecode<AccessTokenPayload>(accessToken)

  if (!result.ok) return

  const payload = result.good
  const properties = payload.subject?.properties
  const email = properties?.email
  const displayNameFromToken
    = properties?.provider === 'google'
      ? properties.name
      : undefined

  if (!email) {
    console.error('No email found in access token payload. Payload was:', payload)
    return
  }

  const userFound = await db().query.users.findFirst({ where: eq(users.email, email) })

  if (userFound) {
    // Update user info if there's new information
    if (displayNameFromToken && displayNameFromToken !== userFound.displayName) {
      await db()
        .update(users)
        .set({ displayName: displayNameFromToken })
        .where(eq(users.email, email))
    }
    return
  }

  // Create new user
  await db().insert(users).values({
    email,
    displayName: displayNameFromToken ?? email.split('@')[0],
  })
}

export { app as oauthCallbackRoutes }
