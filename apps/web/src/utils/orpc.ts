import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { RpcRouterClient } from '../../../server/src/routers/rpc'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Skip toast for AbortError - these are normal request cancellations
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        return
      }
      toast.error(`Error: ${error.message}`, {
        action: {
          label: 'retry',
          onClick: () => {
            queryClient.invalidateQueries()
          },
        },
      })
    },
  }),
})

export const link = new RPCLink({
  url: `${import.meta.env.VITE_SERVER_URL}/rpc`,
  fetch: (request, init) => {
    return globalThis.fetch(request, {
      ...init,
      credentials: 'include', // Include cookies for cross-origin requests
    })
  },
})

export const client: RpcRouterClient = createORPCClient(link)

export const orpc = createTanstackQueryUtils(client)
