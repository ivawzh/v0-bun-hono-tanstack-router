/**
 * TaskIterationHistory Component
 * Shows the history of rejections and iterations for check mode tasks
 */

import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskIteration } from "@/types/task";

interface TaskIterationHistoryProps {
  iterations: TaskIteration[];
  className?: string;
}

export function TaskIterationHistory({ iterations, className }: TaskIterationHistoryProps) {
  if (!iterations || iterations.length === 0) {
    return (
      <div className={cn("text-center py-6 text-muted-foreground", className)}>
        <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No iteration history yet</p>
        <p className="text-xs mt-1">Task hasn't been rejected from check mode</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Label className="text-sm font-medium">Iteration History ({iterations.length})</Label>
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {iterations
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((iteration, index) => (
          <Card
            key={iteration.id}
            className={cn(
              "border-l-4",
              index === 0
                ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
                : "border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10"
            )}
          >
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Iteration #{iteration.iterationNumber}
                  </Badge>
                  <span className="text-muted-foreground">
                    feedback provided
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(new Date(iteration.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="bg-muted/50 p-3 rounded-md">
                <Label className="text-xs text-muted-foreground font-medium">Feedback Reason:</Label>
                <p className="text-sm whitespace-pre-wrap mt-1">
                  {iteration.feedback}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
