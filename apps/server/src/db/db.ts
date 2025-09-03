import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import ws from 'ws'
import { getEnv } from 'env'
import { match } from 'ts-pattern'
import { drizzle as drizzleBun } from 'drizzle-orm/bun-sql'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { PGlite } from '@electric-sql/pglite'
import { SQL } from 'bun'
import * as schema from './schema'

type Schema = typeof schema

const { databaseUrl, stage } = getEnv()

/**
 * Drizzle ORM client for database.
 * `db()` is a function in order to make ease of test mocking.
 */
export const db = () => match(stage)
  .with('alpha', () => {
    // To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
    // neonConfig.poolQueryViaFetch = true

    /**
     * Choose WebSocket if:
     *  - You have an app server or long-running client needing transactions, low-latency interactions, or real-time features.
     *  - You batch many queries or maintain session state for performance.
     */
    // neonConfig.webSocketConstructor = ws
    return drizzleNeon<Schema>(neon(databaseUrl))
  })
  .with('test', () => {
    /**
     * Use in-memory database for testing
     * If persist to local file, use `new PGlite('path/to/file.db')`
     */
    const client = new PGlite()
    return drizzlePglite<Schema>({ client })
  })
  .otherwise(() => {
    const client = new SQL(databaseUrl)
    return drizzleBun<Schema>({ client })
  })
