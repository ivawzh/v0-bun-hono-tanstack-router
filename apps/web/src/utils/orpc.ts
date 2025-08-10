import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { appRouter } from "../../../server/src/routers/index";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(`Error: ${error.message}`, {
        action: {
          label: "retry",
          onClick: () => {
            queryClient.invalidateQueries();
          },
        },
      });
    },
  }),
});

const defaultServerUrl = "http://localhost:3000";
const baseUrl = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? defaultServerUrl;

export const link = new RPCLink({
  url: `${baseUrl}/rpc`,
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  },
});

export const client = createORPCClient<typeof appRouter>(link);

export const orpc = createTanstackQueryUtils(client, queryClient);
