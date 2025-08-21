import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface TodoColumnSectionsProps {
  normalTasks: any[];
  loopTasks: any[];
  onTaskClick: (taskId: string) => void;
  onToggleReady: (taskId: string, ready: boolean) => void;
  onStageChange: (taskId: string, stage: string | null) => void;
  onDeleteTask: (task: any) => void;
  onResetAgent: (task: any) => void;
  TaskCardComponent: React.ComponentType<{
    task: any;
    onTaskClick: (taskId: string) => void;
    onToggleReady: (taskId: string, ready: boolean) => void;
    onStageChange: (taskId: string, stage: string | null) => void;
    onDeleteTask: (task: any) => void;
    onResetAgent: (task: any) => void;
  }>;
}

export function TodoColumnSections({
  normalTasks,
  loopTasks,
  onTaskClick,
  onToggleReady,
  onStageChange,
  onDeleteTask,
  onResetAgent,
  TaskCardComponent,
}: TodoColumnSectionsProps) {
  const [normalSectionCollapsed, setNormalSectionCollapsed] = useState(false);
  const [loopSectionCollapsed, setLoopSectionCollapsed] = useState(true);

  const totalTasks = normalTasks.length + loopTasks.length;

  // Calculate heights for sections when both are open (50/50 split)
  const getContentHeight = (isCollapsed: boolean, isOtherCollapsed: boolean) => {
    if (isCollapsed) return "h-0";
    if (isOtherCollapsed) return "h-[calc(100vh-320px)]"; // Full height when other is collapsed
    return "h-[calc(50vh-200px)]"; // Half height when both open
  };

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] max-sm:h-[calc(100vh-200px)]">
      {/* Normal Tasks Section */}
      <div className={cn(
        "flex flex-col border-b border-border/40 transition-all duration-300",
        normalSectionCollapsed ? "flex-shrink-0" : "flex-1 min-h-0"
      )}>
        {/* Normal Section Header */}
        <div className="flex items-center justify-between p-2 bg-muted/30 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNormalSectionCollapsed(!normalSectionCollapsed)}
              className="h-6 w-6 p-0 hover:bg-accent"
            >
              {normalSectionCollapsed ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </Button>
            <span className="text-sm font-medium text-muted-foreground">Normal</span>
            <Badge variant="outline" className="h-5 text-xs">
              {normalTasks.length}
            </Badge>
          </div>
        </div>

        {/* Normal Tasks Content */}
        <div className={cn(
          "transition-all duration-300 overflow-hidden",
          getContentHeight(normalSectionCollapsed, loopSectionCollapsed)
        )}>
          <ScrollArea className="h-full">
            <SortableContext items={normalTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="p-2 space-y-2">
                {normalTasks.map((task) => (
                  <TaskCardComponent
                    key={task.id}
                    task={task}
                    onTaskClick={onTaskClick}
                    onToggleReady={onToggleReady}
                    onStageChange={onStageChange}
                    onDeleteTask={onDeleteTask}
                    onResetAgent={onResetAgent}
                  />
                ))}
                {normalTasks.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4 italic">
                    No normal tasks
                  </div>
                )}
              </div>
            </SortableContext>
          </ScrollArea>
        </div>
      </div>

      {/* Loop Tasks Section */}
      <div className={cn(
        "flex flex-col transition-all duration-300",
        loopSectionCollapsed ? "flex-shrink-0" : "flex-1 min-h-0"
      )}>
        {/* Loop Section Header */}
        <div className="flex items-center justify-between p-2 bg-muted/30 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLoopSectionCollapsed(!loopSectionCollapsed)}
              className="h-6 w-6 p-0 hover:bg-accent"
            >
              {loopSectionCollapsed ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </Button>
            <span className="text-sm font-medium text-muted-foreground">Loop</span>
            <Badge variant="outline" className="h-5 text-xs">
              {loopTasks.length}
            </Badge>
          </div>
        </div>

        {/* Loop Tasks Content */}
        <div className={cn(
          "transition-all duration-300 overflow-hidden",
          getContentHeight(loopSectionCollapsed, normalSectionCollapsed)
        )}>
          <ScrollArea className="h-full">
            <SortableContext items={loopTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="p-2 space-y-2">
                {loopTasks.map((task) => (
                  <TaskCardComponent
                    key={task.id}
                    task={task}
                    onTaskClick={onTaskClick}
                    onToggleReady={onToggleReady}
                    onStageChange={onStageChange}
                    onDeleteTask={onDeleteTask}
                    onResetAgent={onResetAgent}
                  />
                ))}
                {loopTasks.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4 italic">
                    No loop tasks
                  </div>
                )}
              </div>
            </SortableContext>
          </ScrollArea>
        </div>
      </div>

      {/* Summary at bottom when both sections have content */}
      {totalTasks > 0 && (
        <div className="flex-shrink-0 px-2 py-1 text-xs text-muted-foreground bg-muted/20 border-t border-border/20 text-center">
          Total: {totalTasks} tasks ({normalTasks.length} normal, {loopTasks.length} loop)
        </div>
      )}
    </div>
  );
}