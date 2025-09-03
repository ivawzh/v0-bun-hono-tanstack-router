import type { Context as HonoContext } from 'hono'
import { db } from '../db/db'
import { users, type User } from '../db/schema'
import { eq } from 'drizzle-orm'
import { resolveAuthCookies } from '../services/authCookies'
import type { AccessTokenPayload } from '../lib/openauth'

export type CreateContextOptions = {
  context: HonoContext
}

export type MonsterAuthSession = {
  user: {
    email: string
    name: string
  }
}

export async function createContext({ context }: CreateContextOptions) {
  let session: MonsterAuthSession | null = null
  let appUser: User | null = null

  try {
    const authResult = await resolveAuthCookies(context)
    if (authResult.ok) {
      const payload: AccessTokenPayload = authResult.good

      const props = payload.properties
      const email = props && 'email' in props ? props.email : null
      const name = props && 'name' in props ? props.name : null

      if (!email) {
        throw new Error('Access token did not include an email claim')
      }

      session = {
        user: {
          email,
          name: name ?? email,
        },
      }

      const existing = await db().query.users.findFirst({
        where: eq(users.email, email),
      })

      if (existing) {
        appUser = existing
      } else {
        const displayName = name || email.split('@')[0] || 'User'
        const inserted = await db()
          .insert(users)
          .values({ email, displayName })
          .returning()
        appUser = inserted[0] ?? null
      }
    }
  } catch (err) {
    console.warn(
      'Monster Auth session resolution failed; proceeding without session',
      err,
    )
  }

  return {
    session,
    appUser,
    context,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
