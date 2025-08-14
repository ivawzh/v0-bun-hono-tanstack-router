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

  // Fetch agents for health status (single-user MVP)
  const { data: agents } = useQuery(
    orpc.agents.list.queryOptions({ input: {} })
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

          {/* Agent Status - only show when in project context */}
          {projectId && (
            <div className="flex items-center gap-3 text-sm">
              {/* Agent health chip per requirements */}
              {Array.isArray(agents) && agents.some((a: any) => a.state === 'rate_limited') ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-100 text-yellow-900 border border-yellow-300">
                  <AlertTriangle className="h-4 w-4" />
                  Agent rate limited
                  {(() => {
                    const rlAgent = (agents as any).find((a: any) => a.state === 'rate_limited');
                    const eta = rlAgent?.nextRetryAt ? new Date(rlAgent.nextRetryAt) : null;
                    if (eta) {
                      const mins = Math.max(1, Math.ceil((eta.getTime() - Date.now()) / 60000));
                      return <span className="ml-1">• auto-resumes in {mins}m</span>;
                    }
                    return null;
                  })()}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Agents: <span className="text-foreground">2 online</span> • Running <span className="text-foreground">1</span>
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (project) {
                    updateProject.mutate({ id: projectId as string, agentPaused: !(project as any).agentPaused } as any);
                  }
                }}
              >
                {(project as any)?.agentPaused ? (
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
