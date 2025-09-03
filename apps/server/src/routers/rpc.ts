import { publicProcedure } from '../lib/orpc'
import type { RouterClient } from '@orpc/server'

export const rpcRouter = {
  healthCheck: publicProcedure.handler(() => {
    return 'OK'
  }),
}
export type RpcRouter = typeof rpcRouter
export type RpcRouterClient = RouterClient<typeof rpcRouter>
