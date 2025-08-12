import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, FolderOpen, GitBranch, LayoutGrid } from "lucide-react";
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
  component: ProjectsPage,
});

function ProjectsPage() {
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showNewBoardDialog, setShowNewBoardDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardPurpose, setNewBoardPurpose] = useState("");

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

  // Fetch all boards in a single query
  const projectIds = (projects as any)?.map((p: any) => p.id) || [];
  const { data: allBoards, refetch: refetchBoards } = useQuery({
    queryKey: ['boards', 'all', projectIds],
    queryFn: async () => {
      if (!projectIds.length) return {};
      const boardsByProject: Record<string, any[]> = {};
      
      for (const projectId of projectIds) {
        try {
          const boards = await orpc.boards.list.query({ projectId });
          boardsByProject[projectId] = boards || [];
        } catch (error) {
          console.error(`Error fetching boards for project ${projectId}:`, error);
          boardsByProject[projectId] = [];
        }
      }
      
      return boardsByProject;
    },
    enabled: projectIds.length > 0,
  });

  const createBoard = useMutation(
    orpc.boards.create.mutationOptions({
      onSuccess: () => {
        toast.success("Board created successfully");
        setShowNewBoardDialog(false);
        setNewBoardName("");
        setNewBoardPurpose("");
        refetchBoards();
      },
      onError: (error: any) => {
        toast.error(`Failed to create board: ${error.message}`);
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
        {(projects as any)?.map((project: any) => {
          const boards = allBoards?.[project.id] || [];
          return (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>{project.name}</CardTitle>
                  </div>
                  <ProjectSettingsButton project={project} />
                </div>
                {project.description && (
                  <CardDescription>{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {boards.length} board{boards.length !== 1 ? "s" : ""}
                  </div>
                  
                  {boards.length > 0 && (
                    <div className="space-y-2">
                      {boards.slice(0, 3).map((board: any) => (
                        <Link
                          key={board.id}
                          to="/boards/$boardId"
                          params={{ boardId: board.id }}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{board.name}</span>
                        </Link>
                      ))}
                      {boards.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-2">
                          +{boards.length - 3} more boards
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setShowNewBoardDialog(true);
                    }}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Add Board
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
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

      {/* New Board Dialog */}
      <Dialog open={showNewBoardDialog} onOpenChange={setShowNewBoardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
            <DialogDescription>
              Add a new board to organize your tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="board-name">Board Name</Label>
              <Input
                id="board-name"
                placeholder="Sprint Board"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-purpose">Purpose (optional)</Label>
              <Textarea
                id="board-purpose"
                placeholder="What is this board for?"
                value={newBoardPurpose}
                onChange={(e) => setNewBoardPurpose(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBoardDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newBoardName && selectedProjectId) {
                  createBoard.mutate({
                    projectId: selectedProjectId,
                    name: newBoardName,
                    purpose: newBoardPurpose || undefined,
                  } as any);
                }
              }}
              disabled={!newBoardName || createBoard.isPending}
            >
              Create Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}