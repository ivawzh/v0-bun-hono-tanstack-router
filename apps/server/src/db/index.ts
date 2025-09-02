import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import ws from "ws";
import { getEnv } from "env";
import { match } from "ts-pattern";
import { drizzle as drizzleBun } from 'drizzle-orm/bun-sql';
import { SQL } from 'bun';

const { databaseUrl, stage } = getEnv();

export const db = match(stage)
  .with("alpha", () => {
    // To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
    // neonConfig.poolQueryViaFetch = true
    neonConfig.poolQueryViaFetch = true;
    neonConfig.webSocketConstructor = ws;
    return drizzleNeon(neon(databaseUrl));
  })
  .otherwise(() => {
    const client = new SQL(databaseUrl);
    return drizzleBun({ client });
  });
