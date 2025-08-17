import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Pause, Play, Activity, AlertCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CreateRepoAgentModal } from "./create-repo-agent-modal";

interface ProjectSettingsProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Helper component for repo agent status
function RepoAgentCard({ repoAgent, onTogglePause }: { repoAgent: any; onTogglePause: (id: string, paused: boolean) => void }) {
  const [isToggling, setIsToggling] = useState(false);

  const handleTogglePause = async () => {
    setIsToggling(true);
    try {
      await onTogglePause(repoAgent.id, !repoAgent.isPaused);
    } finally {
      setIsToggling(false);
    }
  };

  const getStatusBadge = () => {
    if (repoAgent.isPaused) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
          <Pause className="h-3 w-3 mr-1" />
          Paused
        </Badge>
      );
    }

    // Check agent client state for other statuses
    const state = repoAgent.agentClient?.state;
    if (state?.rateLimitedUntil && new Date(state.rateLimitedUntil) > new Date()) {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Rate Limited
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
        <Activity className="h-3 w-3 mr-1" />
        Active
      </Badge>
    );
  };

  return (
    <Card className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{repoAgent.name}</h4>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              Path: {repoAgent.repoPath}
            </p>
            <p className="text-xs text-muted-foreground">
              Client: {repoAgent.agentClient?.type || 'Unknown'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={repoAgent.isPaused ? "default" : "outline"}
                    size="sm"
                    onClick={handleTogglePause}
                    disabled={isToggling}
                    className={cn(
                      "h-8 w-8 p-0",
                      repoAgent.isPaused && "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    {isToggling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : repoAgent.isPaused ? (
                      <Play className="h-3 w-3" />
                    ) : (
                      <Pause className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{repoAgent.isPaused ? "Resume agent" : "Pause agent"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectSettings({
  project,
  open,
  onOpenChange,
  onSuccess,
}: ProjectSettingsProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(project.name || "");
  const [description, setDescription] = useState(project.description || "");
  const [createRepoAgentModalOpen, setCreateRepoAgentModalOpen] = useState(false);

  // Fetch repo agents for this project
  const { data: repoAgents, isLoading: loadingRepoAgents } = useQuery(
    orpc.repoAgents.list.queryOptions({
      input: { projectId: project.id },
      enabled: open
    })
  );

  const updateProject = useMutation(
    orpc.projects.update.mutationOptions({
      onSuccess: () => {
        toast.success("Project settings updated successfully");
        // Only invalidate projects list - no need for broad invalidation
        queryClient.invalidateQueries({ 
          queryKey: ["projects"],
          exact: true 
        });
        onSuccess?.();
      },
      onError: (error: any) => {
        toast.error(`Failed to update project: ${error.message}`);
      },
    })
  );

  const pauseRepoAgent = useMutation(
    orpc.repoAgents.pause.mutationOptions({
      onSuccess: () => {
        toast.success("Repo agent status updated successfully");
        // Only invalidate specific repo agent list and project data
        queryClient.invalidateQueries({ 
          queryKey: ["repoAgents", "list", { input: { projectId: project.id } }],
          exact: true 
        });
        queryClient.invalidateQueries({ 
          queryKey: ["projects", "getWithTasks", { input: { id: project.id } }],
          exact: true 
        });
      },
      onError: (error: any) => {
        toast.error(`Failed to update repo agent: ${error.message}`);
      },
    })
  );

  const handleSave = () => {
    updateProject.mutate({
      id: project.id,
      name: name,
      description: description,
    });
  };

  const handleTogglePause = async (repoAgentId: string, paused: boolean) => {
    await pauseRepoAgent.mutateAsync({
      id: repoAgentId,
      paused: paused
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Project Settings
          </DialogTitle>
          <DialogDescription>
            Manage project details and repo agent configurations
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-1">
          <div className="space-y-6 py-4">
            {/* Project Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Project Details</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="Project name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-description">Description (optional)</Label>
                  <Input
                    id="project-description"
                    placeholder="Project description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Repo Agents Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Repo Agents</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {repoAgents?.length || 0} agents
                  </Badge>
                  <Button 
                    size="sm" 
                    onClick={() => setCreateRepoAgentModalOpen(true)}
                    className="h-8"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Repo Agent
                  </Button>
                </div>
              </div>
              
              {loadingRepoAgents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2 text-muted-foreground">Loading repo agents...</span>
                </div>
              ) : repoAgents && repoAgents.length > 0 ? (
                <div className="space-y-3">
                  {repoAgents.map((repoAgent: any) => (
                    <RepoAgentCard
                      key={repoAgent.id}
                      repoAgent={repoAgent}
                      onTogglePause={handleTogglePause}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No repo agents configured</p>
                      <p className="text-xs">Add repo agents to enable AI task automation</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Paused agents will not receive new task assignments. 
                  Active tasks on paused agents will continue to completion.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateProject.isPending || !name.trim()}
          >
            {updateProject.isPending ? "Saving..." : "Save Project Details"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Create Repo Agent Modal */}
      <CreateRepoAgentModal
        projectId={project.id}
        open={createRepoAgentModalOpen}
        onOpenChange={setCreateRepoAgentModalOpen}
      />
    </Dialog>
  );
}

export function ProjectSettingsButton({ project }: { project: any }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Project Settings</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {open && (
        <ProjectSettings
          project={project}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
