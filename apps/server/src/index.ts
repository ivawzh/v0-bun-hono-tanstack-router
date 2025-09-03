import { RPCHandler } from '@orpc/server/fetch'
import { createContext } from './lib/context'
import { appRouter } from './routers/index'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { getEnv, parseUrl } from 'env'

const env = getEnv()
const { port } = parseUrl(env.serverUrl)
const app = new Hono()

app.use(logger((str, ...rest) => {
  console.log(`${new Date().toISOString()} ${str}`, ...rest)
}))

app.use(
  '/*',
  cors({
    origin: [env.webUrl],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'x-forwarded-for',
      'x-forwarded-proto',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
)

const handler = new RPCHandler(appRouter)
app.use('/rpc/*', async (c, next) => {
  const context = await createContext({ context: c })
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: '/rpc',
    context,
  })

  if (matched) {
    return c.newResponse(response.body, response)
  }
  await next()
})

app.get('/', (c) => {
  return c.text('OK')
})

const server = Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`Solo Unicorn Server is running on ${server.url}`)
