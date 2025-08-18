import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  // Get the first project
  const { data: projects, refetch: refetchProjects } = useQuery(
    orpc.projects.list.queryOptions({ input: {}, enabled: !!session })
  );

  const firstProject = Array.isArray(projects) ? projects[0] : undefined;
  const hasProjects = Array.isArray(projects) && projects.length > 0;

  const createProject = useMutation(
    orpc.projects.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Project created successfully");
        setNewProjectName("");
        setNewProjectDescription("");
        refetchProjects();
        // Navigate to the newly created project
        navigate({ to: "/projects/$projectId", params: { projectId: data.id } });
      },
      onError: (error: any) => {
        toast.error(`Failed to create project: ${error.message}`);
      },
    })
  );

  useEffect(() => {
    if (firstProject) {
      // Navigate directly to the first project (simplified - no boards)
      navigate({ to: "/projects/$projectId", params: { projectId: firstProject.id } });
    }
  }, [firstProject, navigate]);

  // If not signed in, show welcome screen
  if (!session) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Solo Unicorn</h1>
          <p className="text-muted-foreground">Sign in to continue</p>
        </div>
      </div>
    );
  }

  // If no projects, show forced create project dialog
  if (session && !hasProjects) {
    return (
      <>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Solo Unicorn</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>

        {/* Forced Create Project Dialog - cannot be closed */}
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Create Your First Project</DialogTitle>
              <DialogDescription>
                Welcome to Solo Unicorn! Let's create your first project to get started.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="My Awesome Project"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description (optional)</Label>
                <Textarea
                  id="project-description"
                  placeholder="Describe your project..."
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (newProjectName) {
                    createProject.mutate({
                      name: newProjectName,
                      description: newProjectDescription || undefined,
                    } as any);
                  }
                }}
                disabled={!newProjectName || createProject.isPending}
                className="w-full"
              >
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Default loading state (while checking projects)
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Solo Unicorn</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
