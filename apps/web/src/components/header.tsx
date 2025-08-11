import { Link, useParams } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { ProjectSwitcher } from "./project-switcher";
import { useSession } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Plus, Pause, Play, Search } from "lucide-react";
import { Input } from "./ui/input";
import { orpc } from "@/utils/orpc";

export default function Header() {
  const { data: session } = useSession();
  const params = useParams({ strict: false });
  const projectId = (params as any)?.projectId;

  // Get current project if we're in project context
  const { data: project } = orpc.projects.get.useQuery(
    { projectId: projectId as string },
    { enabled: !!projectId }
  );

  const { mutate: toggleProjectPause } = orpc.projects.update.useMutation();

  const links = [
    { to: "/", label: "Board" },
    { to: "/chat", label: "Chat" },
    { to: "/search", label: "Search" },
  ];

  return (
    <div className="border-b">
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-semibold text-lg">
            Solo Unicorn
          </Link>
          {session && (
            <>
              <ProjectSwitcher />
              {projectId && (
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Task
                </Button>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8 w-48"
            />
          </div>

          {/* Agent Status - only show when in project context */}
          {projectId && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Agents: <span className="text-foreground">2 online</span> • Running <span className="text-foreground">1</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (project) {
                    toggleProjectPause({
                      projectId: projectId as string,
                      updates: { agentPaused: !project.agentPaused }
                    });
                  }
                }}
              >
                {project?.agentPaused ? (
                  <><Play className="h-4 w-4" /> Resume All</>  
                ) : (
                  <><Pause className="h-4 w-4" /> Pause All Agents</>
                )}
              </Button>
            </div>
          )}

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
