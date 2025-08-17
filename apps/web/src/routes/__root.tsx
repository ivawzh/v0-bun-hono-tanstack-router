import Header from "@/components/header";
import Loader from "@/components/loader";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { MobileTestHelper } from "@/components/mobile-test-helper";
import { link, orpc } from "@/utils/orpc";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { appRouter } from "../../../server/src/routers";
import { createORPCClient } from "@orpc/client";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: ({ error, reset }) => {
    const err: any = error;
    const rawStack: string = (err && err.stack) || '';
    const stackLines = rawStack
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const isFrameworkFrame = (line: string) => /node_modules|\(internal\)|\(native\)|node:|vite|webpack|react-dom|@tanstack|@orpc/i.test(line);
    const isFrame = (line: string) => line.startsWith('at ');
    const firstAppIndex = stackLines.findIndex((l) => isFrame(l) && !isFrameworkFrame(l));
    const copyDetails = () => {
      const text = `${(err && err.name) || 'Error'}: ${(err && err.message) || ''}\n${rawStack}`;
      if (navigator && 'clipboard' in navigator) {
        void navigator.clipboard.writeText(text).catch(() => {});
      }
    };
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Oops!</h1>
            <p className="text-xl text-muted-foreground">
              Something went wrong
            </p>
          </div>

          <div className="bg-muted rounded-lg p-4 text-left">
            <div className="font-mono text-sm text-muted-foreground">
              <div className="font-semibold">{(err && err.name) || 'Error'}</div>
              <div className="mt-1">{(err && err.message) || 'An unexpected error occurred'}</div>
            </div>
          </div>

          {rawStack ? (
            <details className="bg-muted rounded-lg p-4 text-left" open={!import.meta.env.PROD}>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Stack trace
              </summary>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Highlighted frames are likely from your app.</p>
                <button
                  onClick={copyDetails}
                  className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
                >
                  Copy
                </button>
              </div>
              <ul className="mt-2 max-h-72 overflow-auto font-mono text-xs leading-5 space-y-1 pr-2">
                {stackLines.map((line, idx) => {
                  const appFrame = isFrame(line) && !isFrameworkFrame(line);
                  const isPrimary = idx === firstAppIndex && appFrame;
                  const base = appFrame ? 'text-foreground' : 'text-muted-foreground';
                  const primary = isPrimary ? ' bg-destructive/10 ring-1 ring-destructive/30 rounded' : '';
                  return (
                    <li key={idx} className={`${base}${primary} break-all px-2 py-1`}>
                      {line}
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = "/"}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  },
  head: () => ({
    meta: [
      {
        title: "solo-unicorn",
      },
      {
        name: "description",
        content: "solo-unicorn is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  const isFetching = useRouterState({
    select: (s) => s.isLoading,
  });

  const [client] = useState<RouterClient<typeof appRouter>>(() => createORPCClient(link));
  const [orpcUtils] = useState(() => createTanstackQueryUtils(client));

  return (
    <>
      <HeadContent />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          storageKey="vite-ui-theme"
        >
          <div className="grid grid-rows-[auto_1fr] h-svh">
            <Header />
            {isFetching ? <Loader /> : <Outlet />}
          </div>
          <Toaster richColors />
          <MobileTestHelper />
        </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
