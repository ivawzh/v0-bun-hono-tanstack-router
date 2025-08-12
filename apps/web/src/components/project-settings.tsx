import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Settings, FolderOpen, Code2 } from "lucide-react";
// import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProjectSettingsProps {
  project: {
    id: string;
    name: string;
    localRepoPath?: string | null;
    claudeProjectId?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSettings({
  project,
  open,
  onOpenChange,
}: ProjectSettingsProps) {
  // const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [localRepoPath, setLocalRepoPath] = useState(project.localRepoPath || "");
  const [claudeProjectId, setClaudeProjectId] = useState(project.claudeProjectId || "");

  const updateProject = useMutation({
    mutationFn: orpc.projects.updateIntegration.mutate,
    onSuccess: () => {
      // toast({
      //   title: "Project settings updated",
      //   description: "Claude Code integration configured successfully",
      // });
      console.log("Project settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
    },
    onError: (error) => {
      // toast({
      //   title: "Failed to update project",
      //   description: error.message,
      //   variant: "destructive",
      // });
      console.error("Failed to update project:", error.message);
    },
  });

  const handleSave = () => {
    updateProject.mutate({
      id: project.id,
      localRepoPath: localRepoPath || null,
      claudeProjectId: claudeProjectId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Project Settings
          </DialogTitle>
          <DialogDescription>
            Configure Claude Code integration for {project.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="repo-path" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Local Repository Path
            </Label>
            <Input
              id="repo-path"
              placeholder="/path/to/your/repo"
              value={localRepoPath}
              onChange={(e) => setLocalRepoPath(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              The absolute path to your local git repository
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="claude-project" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Claude Project ID
            </Label>
            <Input
              id="claude-project"
              placeholder="claude-project-id"
              value={claudeProjectId}
              onChange={(e) => setClaudeProjectId(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              The Claude Code project ID for linking tasks
            </p>
          </div>

          {localRepoPath && claudeProjectId && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Integration Ready:</strong> Tasks in this project will be automatically
                picked up by Claude Code when assigned to the Local Claude Code agent.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateProject.isPending}
          >
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
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