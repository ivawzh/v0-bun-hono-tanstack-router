import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/kanban-board";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectBoardPage,
});

function ProjectBoardPage() {
  const { projectId } = Route.useParams();

  return (
    <div className="container mx-auto p-6">
      <KanbanBoard projectId={projectId} />
    </div>
  );
}
