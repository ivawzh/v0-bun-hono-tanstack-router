import { publicProcedure } from '../lib/orpc'
import type { RouterClient } from '@orpc/server'
import { authRouter } from './rpc/auth'

export const rpcRouter = {
  healthCheck: publicProcedure.handler(() => {
    return 'OK'
  }),
  auth: authRouter,
}
export type RpcRouter = typeof rpcRouter
export type RpcRouterClient = RouterClient<typeof rpcRouter>
