import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { useEffect } from "react";

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

  useEffect(() => {
    if (firstProject) {
      // Navigate directly to the first project (simplified - no boards)
      navigate({ to: "/projects/$projectId", params: { projectId: firstProject.id } });
    }
  }, [firstProject, navigate]);

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
