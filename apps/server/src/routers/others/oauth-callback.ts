import { Hono } from 'hono'
import { openauth, type AccessTokenPayload } from '@/lib/openauth'
import { setAuthCookies } from '@/services/authCookies'
import { db } from '@/db/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { jwtDecode } from '@/services/authCookies'
import { getEnv } from 'env'

const app = new Hono()
const env = getEnv()
const loginSuccessRedirectUrl = env.webUrl

app.get('/oauth/callback', async (c) => {
  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return c.text('Query param `code` is missing from oauth provider callback', 400)
  }

  // Ensure we use the correct protocol and host - https for production
  const protocol = process.env.NODE_ENV === 'production'
    ? 'https'
    : url.protocol.slice(0, -1)
  const redirectUrl = `${protocol}://${url.host}/api/oauth/callback`
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
  const userEmail = payload?.properties?.email

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

  return c.redirect(loginSuccessRedirectUrl)
})

async function upsertUserIfNewAuthInfo(accessToken: string) {
  const result = jwtDecode<AccessTokenPayload>(accessToken)

  if (!result.ok) return

  const payload = result.good
  const properties = payload.properties
  const email = properties?.email
  const displayNameFromToken
    = properties?.provider === 'google'
      ? properties.name
      : undefined
  const avatarFromToken
    = properties?.provider === 'google'
      ? properties.avatar
      : undefined

  if (!email) {
    console.error('No email found in access token payload. Payload was:', payload)
    return
  }

  const userFound = await db().query.users.findFirst({ where: eq(users.email, email) })

  if (userFound) {
    // Update user info if there's new information
    const updates: { displayName?: string, avatar?: string } = {}
    if (displayNameFromToken && displayNameFromToken !== userFound.displayName) {
      updates.displayName = displayNameFromToken
    }
    if (avatarFromToken && avatarFromToken !== userFound.avatar) {
      updates.avatar = avatarFromToken
    }

    if (Object.keys(updates).length > 0) {
      await db()
        .update(users)
        .set(updates)
        .where(eq(users.email, email))
    }
    return
  }

  // Create new user
  await db().insert(users).values({
    email,
    displayName: displayNameFromToken ?? email.split('@')[0],
    avatar: avatarFromToken,
  })
}

export { app as oauthCallbackRoutes }
