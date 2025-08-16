import { useState, useRef, useEffect } from "react";
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
import {
  Settings, FolderOpen, Code2, Info, HelpCircle,
  Loader2, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [isValidatingPath, setIsValidatingPath] = useState(false);
  const [pathValidation, setPathValidation] = useState<any>(null);

  // Simplified - no automatic Claude Code project detection

  // Generate suggested Claude Project ID from repo path
  const suggestedProjectId = localRepoPath
    ? '-' + localRepoPath.replace(/^\//g, '').replace(/\//g, '-')
    : '';

  // Validate path when it changes
  useEffect(() => {
    if (localRepoPath && localRepoPath.length > 2) {
      const timer = setTimeout(async () => {
        setIsValidatingPath(true);
        try {
          // Path validation removed for now
          const response = { valid: true, exists: true, projectId: '', inClaude: false, displayName: '' };
          setPathValidation(response);

          // Auto-select Claude project if found
          if (response.inClaude && !claudeProjectId) {
            setClaudeProjectId(response.projectId);
          }
        } catch (error) {
          setPathValidation(null);
        } finally {
          setIsValidatingPath(false);
        }
      }, 500); // Debounce

      return () => clearTimeout(timer);
    } else {
      setPathValidation(null);
    }
  }, [localRepoPath]);

  // Simplified - manual path entry only

  const updateProject = useMutation(
    orpc.projects.update.mutationOptions({
      onSuccess: () => {
        toast.success("Claude Code integration configured successfully");
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        onSuccess?.();
        onOpenChange(false);
      },
      onError: (error: any) => {
        toast.error(`Failed to update project: ${error.message}`);
      },
    })
  );

  const handleSave = () => {
    updateProject.mutate({
      id: project.id,
      name: project.name,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
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

            {false ? ( // isDiscovering disabled in simplified architecture
              <div className="flex items-center justify-center h-10 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Discovering Claude projects...</span>
              </div>
            ) : false ? ( // claudeProjects discovery disabled
              <Select value={claudeProjectId || "manual"} onValueChange={(value) => {
                setClaudeProjectId(value === "manual" ? "" : value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Claude project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">
                    <span className="text-muted-foreground">Manual entry</span>
                  </SelectItem>
                  {claudeProjects.projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{proj.displayName}</span>
                          {proj.exists ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-yellow-600" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {proj.path}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                  {suggestedProjectId && !claudeProjects.projects.find(p => p.id === suggestedProjectId) && (
                    <SelectItem value={suggestedProjectId}>
                      <div className="flex items-center">
                        <span className="text-blue-600">Create new: {suggestedProjectId}</span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="claude-project"
                placeholder="-home-user-repos-project-name"
                value={claudeProjectId}
                onChange={(e) => setClaudeProjectId(e.target.value)}
              />
            )}

            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                {claudeProjects?.projects && claudeProjects.projects.length > 0 ? (
                  <>
                    <strong>Auto-discovered {claudeProjects.projects.length} Claude project{claudeProjects.projects.length !== 1 ? 's' : ''}!</strong>
                    <p className="mt-1">
                      Select from the dropdown above or enter manually. Projects are automatically discovered from your Claude Code installation.
                    </p>
                  </>
                ) : (
                  <>
                    <strong>How Claude Project IDs work:</strong>
                    <p className="mt-1">
                      Claude Code automatically creates a project ID from your repository path by replacing slashes with hyphens.
                      For example: <code className="px-1 py-0.5 bg-blue-100 rounded">/home/user/repos/myproject</code> becomes
                      <code className="px-1 py-0.5 bg-blue-100 rounded ml-1">-home-user-repos-myproject</code>
                    </p>
                  </>
                )}

                {!claudeProjectId && suggestedProjectId && pathValidation?.exists && (
                  <p className="mt-2">
                    <strong>Suggested ID:</strong>{' '}
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

          <div className="space-y-2">
            <Label htmlFor="repo-path" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Local Repository Path
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  ref={folderInputRef}
                  id="repo-path"
                  type="text"
                  placeholder="/path/to/your/repo"
                  value={localRepoPath}
                  readOnly
                  className={pathValidation ? (
                    pathValidation.exists ? "pr-8" : "pr-8 border-red-500"
                  ) : ""}
                />
                {isValidatingPath && (
                  <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!isValidatingPath && pathValidation && (
                  pathValidation.exists ? (
                    <CheckCircle className="absolute right-2 top-2.5 h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="absolute right-2 top-2.5 h-4 w-4 text-red-600" />
                  )
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Local repository path is detected from the Claude project and cannot be edited here.
              </p>
              {pathValidation && !pathValidation.exists && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-sm text-red-800">
                    Directory does not exist. Please check the path.
                  </AlertDescription>
                </Alert>
              )}
              {pathValidation && pathValidation.exists && pathValidation.inClaude && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800">
                    <strong>Claude project found!</strong> This repository is already configured in Claude Code.
                  </AlertDescription>
                </Alert>
              )}
            </div>
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
            disabled={updateProject.isPending || (pathValidation && !pathValidation.exists)}
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
