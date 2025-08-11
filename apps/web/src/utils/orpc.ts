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

const defaultServerUrl = "http://localhost:8500";
const baseUrl = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? defaultServerUrl;

export const link = new RPCLink({
  url: `${baseUrl}/rpc`,
  fetch(url, options) {
    const urlString = typeof url === 'string' ? url : url.toString();
    const init = (options || {}) as RequestInit;
    const method = (init as any)?.method || 'GET';
    let parsedBody: unknown = undefined;
    if (typeof (init as any)?.body === 'string') {
      try {
        parsedBody = JSON.parse((init as any).body as string);
      } catch {
        parsedBody = (init as any).body;
      }
    }
    console.log(`🌐 API Request: ${method} ${urlString}`, {
      headers: (init as any)?.headers,
      body: parsedBody,
      timestamp: new Date().toISOString()
    });

    return fetch(url, {
      ...options,
      credentials: "include",
    }).then(async (response) => {
      const contentType = response.headers.get('content-type');
      let responseBody;

      try {
        if (contentType?.includes('application/json')) {
          responseBody = await response.clone().json();
        } else {
          responseBody = await response.clone().text();
        }
      } catch (e) {
        responseBody = '[Unable to parse response]';
      }

      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`, {
          url: urlString,
          method,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          timestamp: new Date().toISOString()
        });

        // 401 handling: navigate to login
        if (response.status === 401) {
          toast.error(`Unauthorized (401)`, {
            description: `Your session has expired. Redirecting to login...`,
          });
          const currentPath = window.location.pathname;
          if (currentPath !== "/login") {
            setTimeout(() => {
              window.location.href = "/login";
            }, 300);
          }
        } else {
          toast.error(`Network Error (${response.status}): ${response.statusText}`, {
            description: `Failed to connect to ${urlString}`,
          action: {
            label: "View Details",
            onClick: () => console.log('Full error details logged to console')
            }
          });
        }
      } else {
        console.log(`✅ API Success: ${response.status}`, {
          url: urlString,
          method,
          status: response.status,
          responseSize: JSON.stringify(responseBody).length,
          timestamp: new Date().toISOString()
        });
      }

      return response;
    }).catch((error) => {
      console.error(`💥 Network Connection Failed:`, {
        url: urlString,
        method,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        baseUrl,
        serverUrl: baseUrl
      });

      toast.error(`Connection Failed: ${error.message}`, {
        description: `Unable to reach server at ${baseUrl}. Check if the server is running.`,
        action: {
          label: "Retry",
          onClick: () => {
            queryClient.invalidateQueries();
          }
        }
      });

      throw error;
    });
  },
});

// @ts-ignore - Type constraint issue with mixed router structure (individual procedures + nested routers)
export const client = createORPCClient<AppRouter>(link) as any;

export const orpc = createTanstackQueryUtils(client) as any;
