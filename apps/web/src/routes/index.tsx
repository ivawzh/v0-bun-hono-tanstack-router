import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";
import { useSession } from "@/lib/auth-client";
import { useEffect } from "react";
import { KanbanBoard } from "@/components/kanban-board";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  
  // Get the first project if available
  const { data: projects } = orpc.projects.list.useQuery(
    {},
    { enabled: !!session }
  );

  const firstProject = projects?.[0];

  useEffect(() => {
    // If we have a project, navigate to its board
    if (firstProject) {
      navigate({ to: "/projects/$projectId/board", params: { projectId: firstProject.id } });
    }
  }, [firstProject, navigate]);

  // Show the board for the first project if available
  if (firstProject) {
    return <KanbanBoard projectId={firstProject.id} />;
  }

  // If no projects, show welcome screen
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Solo Unicorn</h1>
        <p className="text-muted-foreground">
          {session ? "Create a project to get started" : "Sign in to continue"}
        </p>
      </div>
    </div>
  );
}