/**
 * RejectTaskModal Component
 * Modal for collecting rejection feedback when sending a task back from check mode
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { useCacheUtils } from "@/hooks/use-cache-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RejectTaskModalProps {
  taskId: string | null;
  taskTitle?: string;
  projectId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RejectTaskModal({
  taskId,
  taskTitle,
  projectId,
  open,
  onOpenChange,
}: RejectTaskModalProps) {
  const [feedbackReason, setFeedbackReason] = useState("");
  const cache = useCacheUtils();

  const rejectTask = useMutation(
    orpc.tasks.rejectTask.mutationOptions({
      onSuccess: () => {
        toast.success("Task sent back for revision with feedback");
        setFeedbackReason("");
        onOpenChange(false);
        // Invalidate project data for immediate UI updates
        if (projectId) {
          cache.invalidateProject(projectId);
        }
      },
      onError: (error: any) => {
        toast.error(`Failed to reject task: ${error.message}`);
      }
    })
  );

  const handleReject = () => {
    if (!taskId || !feedbackReason.trim()) return;
    rejectTask.mutate({ 
      id: taskId, 
      feedbackReason: feedbackReason.trim() 
    });
  };

  const handleClose = () => {
    if (rejectTask.isPending) return;
    setFeedbackReason("");
    onOpenChange(false);
  };

  const isFormValid = feedbackReason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <MessageCircle className="h-5 w-5" />
            Send Task Back for Revision
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Task <strong className="font-semibold">"{taskTitle || "Untitled"}"</strong> will be 
              sent back to the Todo list for revision.
            </p>
            <p className="text-amber-600 dark:text-amber-500 font-medium">
              Please provide clear feedback to help the agent understand what needs to be changed.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-reason" className="text-sm font-medium">
              Feedback Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="feedback-reason"
              placeholder="Explain what needs to be changed or improved..."
              value={feedbackReason}
              onChange={(e) => setFeedbackReason(e.target.value)}
              className={cn(
                "min-h-[120px] resize-none",
                feedbackReason.trim() && feedbackReason.trim().length < 10 && "border-amber-300 focus:border-amber-400"
              )}
              disabled={rejectTask.isPending}
              maxLength={2000}
              autoFocus
            />
            <div className="flex items-center justify-between text-xs">
              <div className="text-muted-foreground">
                {feedbackReason.trim().length < 10 && feedbackReason.length > 0 && (
                  <span className="text-amber-600">Please provide more detailed feedback</span>
                )}
              </div>
              <span className="text-muted-foreground">
                {feedbackReason.length}/2000
              </span>
            </div>
          </div>

          {/* Helpful suggestions */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <Label className="text-xs font-medium text-blue-700 dark:text-blue-300">
              💡 Good feedback examples:
            </Label>
            <ul className="text-xs text-blue-600 dark:text-blue-400 mt-1 space-y-1 list-disc list-inside">
              <li>The button styling doesn't match the design system</li>
              <li>Missing error handling for edge cases</li>
              <li>Tests are failing - please fix the validation logic</li>
              <li>Code doesn't follow the project's naming conventions</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={rejectTask.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleReject}
            disabled={!isFormValid || rejectTask.isPending || feedbackReason.trim().length < 10}
            className="min-w-[140px] bg-amber-600 hover:bg-amber-700 text-white"
          >
            {rejectTask.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Back...
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 mr-2" />
                Send Back with Feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}