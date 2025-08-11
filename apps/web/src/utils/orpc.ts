import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppRouter } from "../../../server/src/routers/index";
import type { RouterClient } from "@orpc/server";

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

// @ts-ignore - Type constraint issue with mixed router structure (individual procedures + nested routers)
export const client = createORPCClient<AppRouter>(link) as any;

export const orpc = createTanstackQueryUtils(client) as any;
