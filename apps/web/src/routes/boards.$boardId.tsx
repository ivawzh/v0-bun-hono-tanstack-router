import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/kanban-board";

export const Route = createFileRoute("/boards/$boardId")({
  component: BoardPage,
});

function BoardPage() {
  const { boardId } = Route.useParams();
  
  return (
    <div className="container mx-auto p-6">
      <KanbanBoard boardId={boardId} />
    </div>
  );
}