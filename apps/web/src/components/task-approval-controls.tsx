/**
 * TaskApprovalControls Component
 * Approval and rejection controls for tasks in check mode
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { useCacheUtils } from "@/hooks/use-cache-utils";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RejectTaskModal } from "@/components/reject-task-modal";
import type { TaskV2 } from "@/types/task";

interface TaskApprovalControlsProps {
  task: TaskV2;
  className?: string;
}

export function TaskApprovalControls({ task, className }: TaskApprovalControlsProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const cache = useCacheUtils();

  const approveTask = useMutation(
    orpc.tasks.approveTask.mutationOptions({
      onSuccess: () => {
        toast.success("Task approved and moved to Done!");
        // Invalidate project data for immediate UI updates
        if (task.projectId) {
          cache.invalidateProject(task.projectId);
        }
      },
      onError: (error: any) => {
        toast.error(`Failed to approve task: ${error.message}`);
      }
    })
  );

  const handleApprove = () => {
    if (window.confirm("Are you sure you want to approve this task? It will be moved to Done.")) {
      approveTask.mutate({ id: task.id });
    }
  };

  const handleReject = () => {
    setShowRejectModal(true);
  };

  // Only show controls if task is in check mode
  if (task.list !== 'check' || task.mode !== 'check') {
    return null;
  }

  const isLoading = approveTask.isPending;

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Status indicator */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Awaiting Review</span>
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
            This task has been completed by the agent and is ready for your approval or feedback.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleApprove}
            disabled={isLoading}
            className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve & Complete
              </>
            )}
          </Button>
          
          <Button
            onClick={handleReject}
            disabled={isLoading}
            variant="outline"
            className="flex-1 h-11 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/20"
            size="lg"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Send Back for Revision
          </Button>
        </div>

        {/* Helpful info */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
          <p className="mb-1">
            <strong>Approve:</strong> Task will be marked as completed and moved to Done.
          </p>
          <p>
            <strong>Send Back:</strong> Task will return to Todo for revision with your feedback.
          </p>
        </div>
      </div>

      {/* Reject modal */}
      <RejectTaskModal
        taskId={task.id}
        taskTitle={task.refinedTitle || task.rawTitle}
        projectId={task.projectId}
        open={showRejectModal}
        onOpenChange={setShowRejectModal}
      />
    </div>
  );
}