import { createClient } from '@openauthjs/openauth/client'
import { getEnv } from 'env'

const { monsterAuthUrl } = getEnv()

export const openauth = createClient({
  issuer: monsterAuthUrl,
  clientID: 'solo-unicorn',
})

export interface AccessTokenPayload {
  // Primary shape from Monster Auth (subject.properties.*)
  subject?: {
    properties?: GoogleUser | PasswordUser
  }
}
export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

type GoogleUser = {
  provider: 'google'
  email: string
  googleUserId: string
  name?: string
  avatar?: string
  emailVerified?: boolean
  givenName?: string
  familyName?: string
}

type PasswordUser = {
  provider: 'password'
  email: string
}
