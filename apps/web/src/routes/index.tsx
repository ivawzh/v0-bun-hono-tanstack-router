import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { useEffect } from "react";
import { KanbanBoard } from "@/components/kanban-board";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  // Get the first project
  const { data: projects } = useQuery(
    orpc.projects.list.queryOptions({ input: {}, enabled: !!session })
  );

  const firstProject = Array.isArray(projects) ? projects[0] : undefined;

  // Get the first board for the first project
  const { data: boards } = useQuery(
    orpc.boards.list.queryOptions({ input: { projectId: firstProject?.id }, enabled: !!firstProject?.id })
  );

  const firstBoard = Array.isArray(boards) ? boards[0] : undefined;

  useEffect(() => {
    if (firstBoard) {
      navigate({ to: "/boards/$boardId", params: { boardId: firstBoard.id } });
    }
  }, [firstBoard, navigate]);

  // Show the board for the first project if available
  if (firstBoard) {
    return <KanbanBoard boardId={firstBoard.id} />;
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
