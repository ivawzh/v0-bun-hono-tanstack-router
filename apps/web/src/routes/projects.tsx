import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Plus, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ProjectSettingsButton } from "@/components/project-settings";

export const Route = createFileRoute("/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const pathname = useLocation({
    select: (location) => location.pathname,
  });
  
  // If we're on a specific project route, render the child route
  if (pathname !== '/projects') {
    return <Outlet />;
  }
  
  // Otherwise render the projects list
  return <ProjectsPage />;
}

function ProjectsPage() {
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const { data: projects, isLoading, refetch: refetchProjects } = useQuery(orpc.projects.list.queryOptions({ input: {} }));

  const createProject = useMutation(
    orpc.projects.create.mutationOptions({
      onSuccess: () => {
        toast.success("Project created successfully");
        setShowNewProjectDialog(false);
        setNewProjectName("");
        setNewProjectDescription("");
        refetchProjects();
      },
      onError: (error: any) => {
        toast.error(`Failed to create project: ${error.message}`);
      },
    })
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading projects...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your projects and boards</p>
        </div>
        <Button onClick={() => setShowNewProjectDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(projects as any)?.map((project: any) => (
          <Link
            key={project.id}
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className="block"
          >
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>{project.name}</CardTitle>
                  </div>
                  <div onClick={(e) => e.preventDefault()}>
                    <ProjectSettingsButton project={project} />
                  </div>
                </div>
                {project.description && (
                  <CardDescription>{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Click to open project board
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project to manage your repositories and tasks.
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
            <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
              Cancel
            </Button>
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
            >
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
