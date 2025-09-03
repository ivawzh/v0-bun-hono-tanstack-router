import { createClient } from '@openauthjs/openauth/client'
import { getEnv } from 'env'

const { monsterAuthUrl } = getEnv()

export const openauth = createClient({
  issuer: monsterAuthUrl,
  clientID: 'solo-unicorn',
})

export interface AccessTokenPayload {
  mode: 'access'
  type: 'user'
  properties: AuthUserProperties
  aud: string
  iss: string
  sub: string
  exp: number
}
export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export type GoogleUser = {
  provider: 'google'
  email: string
  googleUserId: string
  name?: string
  avatar?: string
  emailVerified?: boolean
  givenName?: string
  familyName?: string
}

export type PasswordUser = {
  provider: 'password'
  email: string
}

export type AuthUserProperties = GoogleUser | PasswordUser
