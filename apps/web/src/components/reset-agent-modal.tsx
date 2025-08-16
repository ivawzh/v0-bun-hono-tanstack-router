import { useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ResetAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function ResetAgentModal({
  open,
  onOpenChange,
  taskTitle,
  onConfirm,
  loading = false
}: ResetAgentModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-left">
                Reset AI Agent Status
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-left">
            <div className="space-y-3 mt-3">
              <p>
                <strong>"{taskTitle}"</strong> appears to be stuck in an AI working state.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <p className="font-medium mb-1">What might have happened:</p>
                <ul className="space-y-1 text-xs">
                  <li>• The Solo Unicorn server went offline while the AI was working</li>
                  <li>• The AI agent lost connection during task processing</li>
                  <li>• There was a communication error between systems</li>
                </ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">What resetting will do:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Clear the "AI Working" status from this task</li>
                  <li>• Allow agents to pick up this task again</li>
                  <li>• Any work in progress may be lost if not committed</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                This action is safe and will not delete your task or any committed work.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {loading ? "Resetting..." : "Reset Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}