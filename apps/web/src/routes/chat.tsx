import { createFileRoute } from "@tanstack/react-router";
import { ProjectChat } from "@/components/project-chat";
import { orpc } from "@/utils/orpc";
import { useSession } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { data: session } = useSession();

  // Get the first project for now
  const { data: projects } = useQuery(
    orpc.projects.list.queryOptions({ input: {}, enabled: !!session })
  );

  const firstProject = Array.isArray(projects) ? projects[0] : undefined;

  if (!firstProject) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    );
  }

  return <ProjectChat projectId={firstProject.id} />;
}
