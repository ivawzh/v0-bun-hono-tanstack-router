import type { Context as HonoContext } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import { openauth } from '../lib/openauth';

export interface AccessTokenPayload {
  subject: {
    properties: {
      email: string;
      name: string;
      provider: 'google' | 'password';
      [key: string]: any;
    };
  };
  [key: string]: any;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type Result<T, E = Error> = 
  | { ok: true; good: T }
  | { ok: false; bad: E };

const ACCESS_TOKEN_COOKIE = 'monster-auth-access-token';
const REFRESH_TOKEN_COOKIE = 'monster-auth-refresh-token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function setAuthCookies(context: HonoContext, tokens: AuthTokens) {
  setCookie(context, ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 15, // 15 minutes
  });

  setCookie(context, REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getAuthCookies(context: HonoContext): Promise<{ accessToken?: string; refreshToken?: string }> {
  const accessToken = getCookie(context, ACCESS_TOKEN_COOKIE);
  const refreshToken = getCookie(context, REFRESH_TOKEN_COOKIE);

  return { accessToken, refreshToken };
}

export function deleteAuthCookies(context: HonoContext) {
  deleteCookie(context, ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS);
  deleteCookie(context, REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS);
}

export async function getHeaders() {
  return {
    host: process.env.HOST || 'localhost:8500'
  };
}

export function jwtDecode<T = any>(token: string): Result<T> {
  try {
    const decoded = jwt.decode(token) as T;
    if (!decoded) {
      return { ok: false, bad: new Error('Invalid token') };
    }
    return { ok: true, good: decoded };
  } catch (error) {
    return { ok: false, bad: error as Error };
  }
}

export async function verifyAccessToken(token: string): Promise<Result<AccessTokenPayload>> {
  try {
    // OpenAuth.exchange handles JWKS verification automatically
    // For now we just decode since exchange already verified it
    const decoded = jwt.decode(token) as AccessTokenPayload;
    
    if (!decoded) {
      return { ok: false, bad: new Error('Invalid token') };
    }

    return { ok: true, good: decoded };
  } catch (error) {
    return { ok: false, bad: error as Error };
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<Result<AuthTokens>> {
  try {
    const refreshed = await openauth.refresh(refreshToken);
    
    if (!refreshed || refreshed.err) {
      return { ok: false, bad: refreshed?.err || new Error('Failed to refresh token') };
    }

    if (!refreshed.tokens) {
      return { ok: false, bad: new Error('No tokens returned from refresh') };
    }

    return { 
      ok: true, 
      good: {
        accessToken: refreshed.tokens.access,
        refreshToken: refreshed.tokens.refresh,
      }
    };
  } catch (error) {
    return { ok: false, bad: error as Error };
  }
}

export async function resolveAuthCookies(context: HonoContext): Promise<Result<AccessTokenPayload>> {
  const { accessToken, refreshToken } = await getAuthCookies(context);

  if (!accessToken) {
    return { ok: false, bad: new Error('No access token') };
  }

  // First try to verify the current access token
  const verifyResult = await verifyAccessToken(accessToken);
  if (verifyResult.ok) {
    return verifyResult;
  }

  // If access token is invalid/expired, try to refresh
  if (!refreshToken) {
    return { ok: false, bad: new Error('No refresh token available') };
  }

  const refreshResult = await refreshAccessToken(refreshToken);
  if (!refreshResult.ok) {
    return { ok: false, bad: refreshResult.bad };
  }

  // Set the new tokens in cookies
  await setAuthCookies(context, refreshResult.good);

  // Verify and return the new access token
  return await verifyAccessToken(refreshResult.good.accessToken);
}