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
    return <Skeleton className="h-8 w-16 sm:h-9 sm:w-24" />;
  }

  if (!session) {
    return (
      <Button 
        variant="outline" 
        onClick={() => login()}
        disabled={isPending}
        className="h-8 px-3 text-sm sm:h-9 sm:px-4"
      >
        {isPending ? "Redirecting..." : "Sign In"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="h-8 px-3 text-sm sm:h-9 sm:px-4 max-w-[120px] sm:max-w-none truncate"
        >
          {session.user.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card w-48 sm:w-auto">
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
