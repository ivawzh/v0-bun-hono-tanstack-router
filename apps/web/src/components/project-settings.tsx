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
import { Settings } from "lucide-react";
import { toast } from "sonner";
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
    description?: string | null;
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

  const [name, setName] = useState(project.name || "");
  const [description, setDescription] = useState(project.description || "");

  const updateProject = useMutation(
    orpc.projects.update.mutationOptions({
      onSuccess: () => {
        toast.success("Project settings updated successfully");
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
      name: name,
      description: description,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Project Settings
          </DialogTitle>
          <DialogDescription>
            Update project name and description
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateProject.isPending || !name.trim()}
          >
            {updateProject.isPending ? "Saving..." : "Save Settings"}
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
