import { Link, useParams } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { ProjectSwitcher } from "./project-switcher";
import { useSession } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Pause, Play, AlertTriangle } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { useQuery, useMutation } from "@tanstack/react-query";

export default function Header() {
  const { data: session } = useSession();
  const params = useParams({ strict: false });
  const projectId = (params as any)?.projectId;

  // Get current project if we're in project context
  const { data: project } = useQuery(
    orpc.projects.get.queryOptions({ input: { id: projectId as string }, enabled: !!projectId })
  );


  const updateProject = useMutation(
    orpc.projects.update.mutationOptions({})
  );

  const links = [
    { to: "/projects", label: "Projects" },
  ];

  return (
    <div className="border-b">
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-semibold text-lg">
            Solo Unicorn
          </Link>
          {session && (
            <ProjectSwitcher />
          )}
        </div>

        <div className="flex items-center gap-4">

          {/* Agent controls removed from simplified architecture */}

          {/* Navigation */}
          <nav className="flex gap-4">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="text-sm hover:text-primary transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ModeToggle />
            <UserMenu />
          </div>
        </div>
      </div>
    </div>
  );
}
