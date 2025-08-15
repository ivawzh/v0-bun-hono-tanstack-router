import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoardWithDnd } from "@/components/kanban-board-with-dnd";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectBoardPage,
});

function ProjectBoardPage() {
  const { projectId } = Route.useParams();

  return (
    <div className="container mx-auto p-6">
      <KanbanBoardWithDnd projectId={projectId} />
    </div>
  );
}
