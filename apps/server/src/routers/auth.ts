import { o, publicProcedure } from "../lib/orpc";
import { resolveAuthCookies, deleteAuthCookies, getHeaders } from "../ops/authCookies";
import { openauth } from "../lib/openauth";

export function rpcRedirect(
  location: string,
  opts?: {
    reason: string;
  }
) {
  return {
    rpcRedirect: true,
    location,
    reason: opts?.reason,
  };
}

export const authRouter = o.router({
  authenticate: publicProcedure.handler(async ({ context }) => {
    const result = await resolveAuthCookies(context.context);
    if (result.ok) {
      const payload: any = result.good as any;
      return {
        email:
          payload?.subject?.properties?.email ??
          payload?.properties?.email ??
          payload?.email ??
          payload?.user?.email ??
          payload?.userinfo?.email ??
          payload?.claims?.email ??
          null,
        name:
          payload?.subject?.properties?.name ??
          payload?.properties?.name ??
          payload?.name ??
          payload?.user?.name ??
          payload?.userinfo?.name ??
          payload?.claims?.name ??
          null,
        provider:
          payload?.subject?.properties?.provider ??
          payload?.properties?.provider ??
          payload?.provider ??
          null,
        raw: payload,
      };
    }
    return null;
  }),

  logout: publicProcedure.handler(async ({ context }) => {
    deleteAuthCookies(context.context);
    return rpcRedirect('/', { reason: 'logged-out' });
  }),

  login: publicProcedure.handler(async ({ context }) => {
    const authResult = await resolveAuthCookies(context.context);
    if (authResult.ok) {
      return rpcRedirect('/', { reason: 'already-logged-in' });
    }

    // User is not logged in, redirect to OAuth-provider-hosted web page (Monster Auth) to authenticate
    const headers = await getHeaders();

    const host = headers.host || process.env.BASE_URL;
    const protocol = process.env.NODE_ENV === 'development' && host?.includes('localhost') ? 'http' : 'https';
    const callbackUrl = `${protocol}://${host}/api/oauth/callback`;

    const { url: authServiceUrl } = await openauth.authorize(
      callbackUrl,
      'code',
      {
        provider: 'google',
      }
    );

    return rpcRedirect(authServiceUrl, { reason: 'authenticate-via-auth-service' });
  }),
});
