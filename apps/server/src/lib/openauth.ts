import { createClient } from '@openauthjs/openauth/client';

const monsterAuthUrl = process.env.MONSTER_AUTH_URL || 'https://auth.monstermake.limited';

export const openauth = createClient({
  issuer: monsterAuthUrl,
  clientID: 'solo-unicorn',
});