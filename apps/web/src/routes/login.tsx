import { createFileRoute } from "@tanstack/react-router";
import { useLogin } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const { login, isPending } = useLogin();

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6 text-center">
      <h1 className="mb-6 text-3xl font-bold">Authentication Required</h1>
      <p className="text-gray-600 mb-6">
        You need to be signed in to access this page. Please sign in with your Google account to continue.
      </p>

      <Button
        onClick={() => login()}
        className="w-full"
        disabled={isPending}
      >
        {isPending ? "Redirecting..." : "Sign in with Google"}
      </Button>
    </div>
  );
}
