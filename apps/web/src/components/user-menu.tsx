import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, useLogout, useLogin } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession();
  const { logout } = useLogout();
  const { login, isPending } = useLogin();

  if (isLoading) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Button 
        variant="outline" 
        onClick={() => login()}
        disabled={isPending}
      >
        {isPending ? "Redirecting..." : "Sign In"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{session.user.name}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>{String(session.user.email)}</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => logout()}
          >
            Sign Out
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
