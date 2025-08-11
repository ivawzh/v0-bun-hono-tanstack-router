import { createAuthClient } from "better-auth/react";
import { toast } from "sonner";

const defaultServerUrl = "http://localhost:8500";
const serverUrl = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? defaultServerUrl;
// better-auth endpoints are mounted at /api/auth on the server
const baseURL = `${serverUrl}/api/auth`;

console.log(`🔐 Auth Client initialized with baseURL: ${baseURL}`);

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: "include",
    onRequest: () => {
      // Silent on initial session checks to avoid noisy UX before login
      console.log(`🔐 Auth Request`, { timestamp: new Date().toISOString() });
    },
    onResponse: (context) => {
      if (!context.response.ok) {
        const url = (context.response as any)?.url as string | undefined;
        const isSessionCheck = url?.includes("/api/auth") ?? false;
        console.warn(`🔐 Auth non-OK response: ${context.response.status} ${context.response.statusText}`, {
          url,
          status: context.response.status,
          statusText: context.response.statusText,
          timestamp: new Date().toISOString(),
        });
        // Do not toast on 401 or background auth checks; forms handle their own errors
        if (context.response.status !== 401 && !isSessionCheck) {
          toast.error(`Authentication Error (${context.response.status})`, {
            description: `Auth server at ${baseURL} responded with an error.`,
          });
        }
      } else {
        console.log(`🔐✅ Auth Success: ${context.response.status}`, {
          status: context.response.status,
          timestamp: new Date().toISOString()
        });
      }
    },
    onError: (context) => {
      const message = context?.error?.message || "Unknown error";
      console.warn(`🔐 Auth fetch error (suppressed)`, {
        error: message,
        stack: context?.error?.stack,
        timestamp: new Date().toISOString(),
        baseURL,
      });
      // Suppress toast here; explicit flows (sign-in/up) already show errors
    }
  }
});
