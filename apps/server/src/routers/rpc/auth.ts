import { o, publicProcedure } from '../../lib/orpc'
import { deleteAuthCookies, getHeaders } from '../../services/authCookies'
import { openauth } from '../../lib/openauth'

export function rpcRedirect(
  location: string,
  opts?: {
    reason: string
  },
) {
  return {
    rpcRedirect: true,
    location,
    reason: opts?.reason,
  }
}

export const authRouter = o.router({
  authenticate: publicProcedure.handler(async ({ context }) => {
    if (context.session) {
      return {
        email: context.session.user.email,
        name: context.session.user.name,
      }
    }
    return null
  }),

  logout: publicProcedure.handler(async ({ context }) => {
    deleteAuthCookies(context.context)
    return rpcRedirect('/', { reason: 'logged-out' })
  }),

  login: publicProcedure.handler(async ({ context }) => {
    if (context.session) {
      return rpcRedirect('/', { reason: 'already-logged-in' })
    }

    // User is not logged in, redirect to OAuth-provider-hosted web page (Monster Auth) to authenticate
    const headers = await getHeaders()
    const host = headers.host
    const protocol = host?.includes('localhost') ? 'http' : 'https'
    const callbackUrl = `${protocol}://${host}/api/oauth/callback`

    const { url: authServiceUrl } = await openauth.authorize(
      callbackUrl,
      'code',
      {
        provider: 'google',
      },
    )

    return rpcRedirect(authServiceUrl, { reason: 'authenticate-via-auth-service' })
  }),
})
