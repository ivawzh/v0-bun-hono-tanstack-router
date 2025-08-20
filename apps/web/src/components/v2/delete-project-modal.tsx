/**
 * Delete Project Modal Component
 * Provides safe project deletion with name confirmation
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
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
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeleteProjectModalProps {
  project: {
    id: string;
    name: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProjectModal({
  project,
  open,
  onOpenChange,
}: DeleteProjectModalProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();

  const isNameMatched = confirmationInput === project.name;

  const deleteProject = useMutation(
    orpc.projects.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Project deleted successfully");
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        onOpenChange(false);
        // Redirect to projects list
        router.navigate({ to: "/projects" });
      },
      onError: (error: any) => {
        toast.error(`Failed to delete project: ${error.message}`);
      }
    })
  );

  const handleDelete = () => {
    if (!isNameMatched) return;
    deleteProject.mutate({ id: project.id });
  };

  const handleClose = () => {
    if (deleteProject.isPending) return;
    setConfirmationInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Project
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              This action cannot be undone. This will permanently delete the{" "}
              <strong className="font-semibold">"{project.name}"</strong> project and all of its data.
            </p>
            <p className="text-destructive font-medium">
              All tasks, repositories, agents, and project memory will be permanently removed.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirmation-input" className="text-sm font-medium">
              To confirm deletion, type the project name below:
            </Label>
            <div className="space-y-1">
              <p className="text-sm font-mono bg-muted px-2 py-1 rounded border">
                {project.name}
              </p>
              <Input
                id="confirmation-input"
                placeholder={`Type "${project.name}" to confirm`}
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                className={cn(
                  "font-mono",
                  confirmationInput && !isNameMatched && "border-destructive focus:border-destructive"
                )}
                disabled={deleteProject.isPending}
                autoComplete="off"
                spellCheck="false"
              />
              {confirmationInput && !isNameMatched && (
                <p className="text-xs text-destructive">
                  Project name does not match
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={deleteProject.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isNameMatched || deleteProject.isPending}
            className="min-w-[120px]"
          >
            {deleteProject.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Delete Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}