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
    properties?: {
      email?: string
      name?: string
      provider?: 'google' | 'password'
      [key: string]: any
    }
  }
  // Common alternative shapes from other providers/versions
  properties?: { email?: string, name?: string, provider?: string, [key: string]: any }
  email?: string
  name?: string
  user?: { email?: string, name?: string, [key: string]: any }
  userinfo?: { email?: string, name?: string, [key: string]: any }
  claims?: { email?: string, name?: string, [key: string]: any }
  [key: string]: any
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
