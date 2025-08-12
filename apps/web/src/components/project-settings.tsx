import { useState, useRef } from "react";
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
import { Settings, FolderOpen, Code2, Info, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  onSuccess?: () => void;
}

export function ProjectSettings({
  project,
  open,
  onOpenChange,
  onSuccess,
}: ProjectSettingsProps) {
  const queryClient = useQueryClient();
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const [localRepoPath, setLocalRepoPath] = useState(project.localRepoPath || "");
  const [claudeProjectId, setClaudeProjectId] = useState(project.claudeProjectId || "");

  // Generate suggested Claude Project ID from repo path
  const suggestedProjectId = localRepoPath 
    ? localRepoPath.replace(/^\//g, '').replace(/\//g, '-')
    : '';

  const updateProject = useMutation({
    mutationFn: orpc.projects.updateIntegration.mutate,
    onSuccess: () => {
      toast.success("Claude Code integration configured successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update project: ${error.message}`);
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
            <div className="flex gap-2">
              <Input
                ref={folderInputRef}
                id="repo-path"
                type="text"
                placeholder="/path/to/your/repo"
                value={localRepoPath}
                onChange={(e) => {
                  setLocalRepoPath(e.target.value);
                  // Auto-suggest Claude Project ID if empty
                  if (!claudeProjectId && e.target.value) {
                    const suggested = '-' + e.target.value.replace(/^\//g, '').replace(/\//g, '-');
                    setClaudeProjectId(suggested);
                  }
                }}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled
                      title="Folder selection not available in browser"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Please type the path manually</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter the absolute path to your local git repository (e.g., <code className="px-1 py-0.5 bg-muted rounded">/home/user/repos/myproject</code>)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="claude-project" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Claude Project ID
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Claude Code creates a project ID based on your repository path. It's stored in ~/.claude/projects/</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              id="claude-project"
              placeholder="-home-user-repos-project-name"
              value={claudeProjectId}
              onChange={(e) => setClaudeProjectId(e.target.value)}
            />
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                <strong>How to find your Claude Project ID:</strong>
                <ol className="mt-2 ml-4 space-y-1 list-decimal">
                  <li>Open Claude Code CLI and navigate to your project</li>
                  <li>Check <code className="px-1 py-0.5 bg-blue-100 rounded">~/.claude/projects/</code> directory</li>
                  <li>Your project ID is the folder name (e.g., <code className="px-1 py-0.5 bg-blue-100 rounded">-home-user-repos-myproject</code>)</li>
                </ol>
                {suggestedProjectId && (
                  <p className="mt-2">
                    <strong>Suggested ID based on your path:</strong>{' '}
                    <button
                      type="button"
                      onClick={() => setClaudeProjectId(suggestedProjectId)}
                      className="text-blue-600 underline hover:text-blue-700"
                    >
                      {suggestedProjectId}
                    </button>
                  </p>
                )}
              </AlertDescription>
            </Alert>
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