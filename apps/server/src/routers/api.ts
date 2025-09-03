import { publicProcedure } from '../lib/orpc'
import { ORPCError, os } from '@orpc/server'
import * as z from 'zod'
import type { IncomingHttpHeaders } from 'node:http'

/**
 * API router is used for non-bundled-deployment integrations where requires backward compatibility.
 * For bundled applications such as web app where deployment is bundled with server
 * app and allow breaking changes, use `rpcRouter` instead.
 * @see https://orpc.unnoq.com/docs/openapi/getting-started
 */

const PingPongSchema = z.object({
  id: z.number().int().min(1),
  echo: z.string(),
  description: z.string().optional(),
})

export const pingPong = os
  .$context<{ headers: IncomingHttpHeaders }>()
  .use(({ context, next }) => {
    const user = {
      authenticatedBy: 'mock-jwt',
      token: context.headers.authorization?.split(' ')[1] ?? 'mock-token',
    }

    if (user) {
      return next({ context: { user } })
    }

    throw new ORPCError('UNAUTHORIZED')
  })
  .route({ method: 'POST', path: '/ping/{id}' })
  .input(z.object({ id: z.coerce.number().int().min(1), echo: z.string() }))
  .output(PingPongSchema)
  .handler(async ({ input }) => {
    return { id: 1, echo: input.echo }
  })

export const apiRouter = {
  healthCheck: publicProcedure.handler(() => {
    return 'OK'
  }),
}
export type ApiRouter = typeof apiRouter
