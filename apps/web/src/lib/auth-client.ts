import { createAuthClient } from "better-auth/react";
import { toast } from "sonner";

const defaultServerUrl = "http://localhost:8500";
const baseURL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? defaultServerUrl;

console.log(`🔐 Auth Client initialized with baseURL: ${baseURL}`);

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: "include",
    onRequest: () => {
      console.log(`🔐 Auth Request`, {
        timestamp: new Date().toISOString(),
      });
    },
    onResponse: (context) => {
      if (!context.response.ok) {
        console.error(`🔐❌ Auth Error: ${context.response.status} ${context.response.statusText}`, {
          status: context.response.status,
          statusText: context.response.statusText,
          timestamp: new Date().toISOString()
        });
        
        toast.error(`Authentication Error (${context.response.status})`, {
          description: `Failed to authenticate with server at ${baseURL}`,
          action: {
            label: "View Details",
            onClick: () => console.log('Full auth error details logged to console')
          }
        });

        if (context.response.status === 401) {
          // Redirect unauthenticated users to login
          setTimeout(() => {
            window.location.href = "/login";
          }, 300);
        }
      } else {
        console.log(`🔐✅ Auth Success: ${context.response.status}`, {
          status: context.response.status,
          timestamp: new Date().toISOString()
        });
      }
    },
    onError: (context) => {
      console.error(`🔐💥 Auth Connection Failed:`, {
        error: context.error.message,
        stack: context.error.stack,
        timestamp: new Date().toISOString(),
        baseURL
      });
      
      toast.error(`Auth Connection Failed: ${context.error.message}`, {
        description: `Unable to reach auth server at ${baseURL}. Check if the server is running.`,
        action: {
          label: "Retry",
          onClick: () => window.location.reload()
        }
      });
    }
  }
});
