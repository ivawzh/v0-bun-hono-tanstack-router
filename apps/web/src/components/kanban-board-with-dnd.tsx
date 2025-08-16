import { useState, useEffect } from "react";
import {
  Plus, MoreHorizontal, Clock, Play, CheckCircle, Settings, AlertCircle, GripVertical, ExternalLink, RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProjectSettings } from "@/components/project-settings";
import { TaskDrawer } from "@/components/task-drawer";
import { TaskStageSelector } from "@/components/task-stage-selector";
import { AIActivityBadge } from "@/components/ai-activity-badge";
import { AttachmentDropzone } from "@/components/attachment-dropzone";
import { DeleteTaskDialog } from "@/components/delete-task-dialog";
import { ResetAgentModal } from "@/components/reset-agent-modal";
import type { AttachmentFile } from "@/hooks/use-task-draft";
import { useWebSocket } from "@/hooks/use-websocket";
import { useTaskDraft } from "@/hooks/use-task-draft";
import { getPriorityColors, getPriorityDisplay, getPriorityOptions, comparePriority, type Priority } from "@/utils/priority";

// Drag and drop imports
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface KanbanBoardProps {
  projectId: string;
}

// Simplified 3-column structure
const statusColumns = [
  { id: "todo", label: "Todo", icon: Clock, color: "bg-slate-500" },
  { id: "doing", label: "Doing", icon: Play, color: "bg-blue-500" },
  { id: "done", label: "Done", icon: CheckCircle, color: "bg-green-500" },
];

const stageColors = {
  refine: "bg-purple-100 text-purple-800 border-purple-200",
  plan: "bg-pink-100 text-pink-800 border-pink-200",
  execute: "bg-blue-100 text-blue-800 border-blue-200",
};

// Priority colors are now handled by the priority utility

// Helper function to check if task is stuck (5+ minutes of AI working)
function isTaskStuck(task: any): boolean {
  if (!task.isAiWorking || !task.aiWorkingSince) {
    return false;
  }
  
  const workingSince = new Date(task.aiWorkingSince);
  const now = new Date();
  const minutesWorking = (now.getTime() - workingSince.getTime()) / (1000 * 60);
  
  return minutesWorking >= 5;
}

interface TaskCardProps {
  task: any;
  onTaskClick: (taskId: string) => void;
  onToggleReady: (taskId: string, ready: boolean) => void;
  onStageChange: (taskId: string, stage: string | null) => void;
  onDeleteTask: (task: any) => void;
  onResetAgent: (task: any) => void;
}

function TaskCard({ task, onTaskClick, onToggleReady, onStageChange, onDeleteTask, onResetAgent }: TaskCardProps) {
  const [showMore, setShowMore] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const column = statusColumns.find(col => col.id === task.status);
  const Icon = column?.icon || Clock;
  
  const description = task.refinedDescription || task.rawDescription;
  const shouldTruncate = description && description.length > 150;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-pointer hover:shadow-md transition-all duration-200 kanban-card",
        isDragging && "opacity-50 cursor-grabbing"
      )}
      onClick={(e) => {
        // Only trigger click if not clicking on interactive elements
        const target = e.target as HTMLElement;
        if (!target.closest('button, [role="switch"], [data-radix-collection-item]')) {
          e.preventDefault();
          onTaskClick(task.id);
        }
      }}
      {...attributes}
      {...listeners}
    >
      <CardHeader className="pb-2">
        <div className="kanban-card-header-content">
          <div className="kanban-card-title-wrapper">
            <CardTitle className="text-sm font-medium kanban-card-title">
              {task.refinedTitle || task.rawTitle}
            </CardTitle>
          </div>
          <div className="kanban-card-actions">
            {/* Task menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onTaskClick(task.id)}>
                  View Details
                </DropdownMenuItem>
                {(task as any)?.agentSessionId && (
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      const base = 'http://localhost:8303';
                      window.open(`${base}/session/${(task as any).agentSessionId}`, "_blank");
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Claude Code
                  </DropdownMenuItem>
                )}
                {isTaskStuck(task) && (
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      onResetAgent(task);
                    }}
                    className="text-orange-600"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Agent
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task);
                  }}
                >
                  Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Priority, Author, AI Activity, and Stage badges */}
        <div className="kanban-card-badges">
          <Badge variant="outline" className={getPriorityColors(task.priority)}>
            {getPriorityDisplay(task.priority)}
          </Badge>
          {task.author === "ai" && (
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
              AI
            </Badge>
          )}
          <AIActivityBadge
            ready={task.ready}
            isAiWorking={task.isAiWorking}
            status={task.status}
          />
          <TaskStageSelector
            stage={task.stage}
            status={task.status}
            onStageChange={(stage) => onStageChange(task.id, stage)}
            size="sm"
          />
        </div>

        {/* Description preview with truncation */}
        {description && (
          <div className="mb-2">
            <div className={cn(
              "text-xs text-muted-foreground kanban-card-text relative",
              !showMore && shouldTruncate && "max-h-16 overflow-hidden"
            )}>
              <p className="whitespace-pre-wrap">
                {!showMore && shouldTruncate ? description.slice(0, 150) + '...' : description}
              </p>
              {!showMore && shouldTruncate && (
                <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-background to-transparent" />
              )}
            </div>
            {shouldTruncate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMore(!showMore);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 mt-1 transition-colors"
              >
                {showMore ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Ready toggle - only show for non-completed tasks */}
        {task.status !== 'done' && (
          <div className="kanban-card-status">
            <div className="kanban-card-ready-toggle">
              <Switch
                id={`ready-${task.id}`}
                checked={task.ready}
                onCheckedChange={(checked) => {
                  onToggleReady(task.id, checked);
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-muted-foreground">
                {task.ready ? "Ready" : "Not Ready"}
              </span>
            </div>
          </div>
        )}

        {/* Repo Agent and Actor info */}
        {task.repoAgent && (
          <div className="text-xs text-muted-foreground mt-1 kanban-card-text">
            Repo: {task.repoAgent.name}
          </div>
        )}
        {task.actor && (
          <div className="text-xs text-muted-foreground kanban-card-text">
            Actor: {task.actor.name}
          </div>
        )}

        {/* Dependencies */}
        {task.dependencies && task.dependencies.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            <span className="text-orange-600">
              Depends on: {task.dependencies
                .map((dep: any) => dep.refinedTitle || dep.rawTitle)
                .join(", ")}
            </span>
          </div>
        )}

        {/* Attachments count */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            {task.attachments.length} attachment(s)
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KanbanBoardWithDnd({ projectId }: KanbanBoardProps) {
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskColumn, setNewTaskColumn] = useState<string>("todo");
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [resetTaskId, setResetTaskId] = useState<string | null>(null);
  const [taskToReset, setTaskToReset] = useState<any>(null);
  // Use task draft hook for auto-save functionality
  const { draft: newTask, updateDraft, clearDraft, hasDraft } = useTaskDraft();

  const queryClient = useQueryClient();

  // WebSocket connection for real-time updates
  const { isConnected: wsConnected, connectionStatus } = useWebSocket({
    projectId,
    onMessage: (message) => {
      // Handle specific message types with custom logic if needed
      if (message.type === 'task.order.updated') {
        // Log the message, but don't invalidate here - the hook handles it
        console.log('Real-time order update received:', message);
      }
    }
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch project with tasks
  const { data: project, isLoading, refetch } = useQuery(
    orpc.projects.getWithTasks.queryOptions({
      input: { id: projectId },
    })
  );

  // Fetch repo agents for this project
  const { data: repoAgents } = useQuery(
    orpc.repoAgents.list.queryOptions({
      input: { projectId },
      enabled: !!projectId
    })
  );

  // Fetch actors for this project
  const { data: actors } = useQuery(
    orpc.actors.list.queryOptions({
      input: { projectId },
      enabled: !!projectId
    })
  );

  // Auto-select repo agent when only one is available
  useEffect(() => {
    if (repoAgents && repoAgents.length === 1 && !newTask.repoAgentId) {
      updateDraft({ repoAgentId: repoAgents[0].id });
    }
  }, [repoAgents, newTask.repoAgentId, updateDraft]);

  // Create task mutation
  const createTaskMutation = useMutation(orpc.tasks.create.mutationOptions({
    onSuccess: () => {
      toast.success("Task created successfully");
      setShowNewTaskDialog(false);
      clearDraft(); // Clear the auto-saved draft
      queryClient.invalidateQueries({ queryKey: ["projects", "getWithTasks", { input: { id: projectId } }] });
    },
    onError: (error) => {
      toast.error("Failed to create task: " + error.message);
    }
  }));

  // Toggle ready mutation
  const toggleReadyMutation = useMutation(orpc.tasks.toggleReady.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", "getWithTasks", { input: { id: projectId } }] });
    },
    onError: (error) => {
      toast.error("Failed to update task: " + error.message);
    }
  }));

  // Update stage mutation
  const updateStageMutation = useMutation(orpc.tasks.updateStage.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", "getWithTasks", { input: { id: projectId } }] });
    },
    onError: (error) => {
      toast.error("Failed to update task stage: " + error.message);
    }
  }));

  // Delete task mutation
  const deleteTaskMutation = useMutation(orpc.tasks.delete.mutationOptions({
    onSuccess: () => {
      toast.success("Task deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["projects", "getWithTasks", { input: { id: projectId } }] });
      setDeleteTaskId(null);
      setTaskToDelete(null);
    },
    onError: (error) => {
      toast.error("Failed to delete task: " + error.message);
    }
  }));

  // Reset agent mutation
  const resetAgentMutation = useMutation(orpc.tasks.resetAgent.mutationOptions({
    onSuccess: () => {
      toast.success("AI agent status reset successfully");
      queryClient.invalidateQueries({ queryKey: ["projects", "getWithTasks", { input: { id: projectId } }] });
      setResetTaskId(null);
      setTaskToReset(null);
    },
    onError: (error) => {
      toast.error("Failed to reset agent: " + error.message);
    }
  }));

  // Update task order mutation
  const updateOrderMutation = useMutation(orpc.tasks.updateOrder.mutationOptions({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({
        queryKey: ["projects", "getWithTasks", { input: { id: projectId } }]
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(
        ["projects", "getWithTasks", { input: { id: projectId } }]
      );

      // Optimistically update to the new value
      if (previousData) {
        queryClient.setQueryData(
          ["projects", "getWithTasks", { input: { id: projectId } }],
          (old: any) => {
          if (!old?.tasks) return old;

          const updatedTasks = old.tasks.map((task: any) => {
            const update = variables.tasks.find((u: any) => u.id === task.id);
            if (update) {
              return {
                ...task,
                columnOrder: update.columnOrder,
                status: update.status || task.status
              };
            }
            return task;
          });

          return { ...old, tasks: updatedTasks };
        });
      }

      // Return a context object with the snapshotted value
      return { previousData };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          ["projects", "getWithTasks", { input: { id: projectId } }],
          context.previousData
        );
      }
      toast.error("Failed to update task order: " + error.message);
    },
    onSuccess: () => {
      // Don't invalidate immediately - let optimistic update persist
      // Real-time updates via WebSocket will sync if needed
      console.log('✅ Task order updated successfully');
    }
  }));

  // Group tasks by status and sort them with proper columnOrder initialization
  const groupedTasks = statusColumns.reduce((acc, column) => {
    let columnTasks = (project?.tasks || [])
      .filter((task: any) => task.status === column.id);

    // First sort by priority and creation date to establish proper initial order
    columnTasks = columnTasks.sort((a: any, b: any) => {
      // Sort by priority first (higher numbers = higher priority: 5 > 4 > 3 > 2 > 1)
      const priorityComparison = comparePriority(a.priority, b.priority);
      if (priorityComparison !== 0) {
        return priorityComparison;
      }

      // Then by creation date (newer first within same priority)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Ensure all tasks have proper columnOrder values based on their sorted position
    columnTasks = columnTasks.map((task: any, index: number) => {
      // Only reassign columnOrder if it's missing or has the problematic default value
      if (!task.columnOrder || task.columnOrder === "1000") {
        return {
          ...task,
          columnOrder: ((index + 1) * 1000).toString()
        };
      }
      return task;
    });

    // Final sort by columnOrder now that all tasks have proper values
    columnTasks = columnTasks.sort((a: any, b: any) => {
      // Sort by priority first
      const priorityComparison = comparePriority(a.priority, b.priority);
      if (priorityComparison !== 0) {
        return priorityComparison;
      }

      // Then sort by column order
      const aOrder = parseFloat(a.columnOrder);
      const bOrder = parseFloat(b.columnOrder);
      return aOrder - bOrder;
    });

    acc[column.id] = columnTasks;
    return acc;
  }, {} as Record<string, any[]>);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the active task
    const activeTask = project?.tasks?.find((t: any) => t.id === activeId);
    if (!activeTask) return;

    // Determine target status and position
    let targetStatus = activeTask.status;
    let targetTasks = groupedTasks[targetStatus];

    // Check if dropped on a different column
    if (statusColumns.some(col => col.id === overId)) {
      targetStatus = overId;
      targetTasks = groupedTasks[targetStatus];
    } else {
      // Find which column the target task belongs to
      for (const column of statusColumns) {
        if (groupedTasks[column.id].some((t: any) => t.id === overId)) {
          targetStatus = column.id;
          targetTasks = groupedTasks[column.id];
          break;
        }
      }
    }

    // Calculate new positions
    const updates: Array<{ id: string; columnOrder: string; status?: string }> = [];

    if (targetStatus !== activeTask.status) {
      // Moving to a different column
      const targetIndex = targetTasks.findIndex((t: any) => t.id === overId);
      const insertIndex = targetIndex >= 0 ? targetIndex : targetTasks.length;

      // Calculate new order for the moved task
      let newOrder: string;
      
      if (targetTasks.length === 0) {
        // Empty column
        newOrder = "1000";
      } else if (insertIndex === 0) {
        // Insert at beginning
        const firstTask = targetTasks[0];
        const firstOrder = parseFloat(firstTask.columnOrder);
        newOrder = Math.max(firstOrder - 1000, 100).toString();
      } else if (insertIndex >= targetTasks.length) {
        // Insert at end
        const lastTask = targetTasks[targetTasks.length - 1];
        const lastOrder = parseFloat(lastTask.columnOrder);
        newOrder = (lastOrder + 1000).toString();
      } else {
        // Insert between tasks
        const prevTask = targetTasks[insertIndex - 1];
        const nextTask = targetTasks[insertIndex];
        const prevOrder = parseFloat(prevTask.columnOrder);
        const nextOrder = parseFloat(nextTask.columnOrder);
        newOrder = ((prevOrder + nextOrder) / 2).toString();
      }

      updates.push({
        id: activeId,
        columnOrder: newOrder,
        status: targetStatus
      });
    } else {
      // Reordering within the same column
      const activeIndex = targetTasks.findIndex((t: any) => t.id === activeId);
      const overIndex = targetTasks.findIndex((t: any) => t.id === overId);

      if (activeIndex !== overIndex && activeIndex >= 0 && overIndex >= 0) {
        // Respect priority - don't allow lower priority to move above higher priority
        const activeTask = targetTasks[activeIndex];
        const overTask = targetTasks[overIndex];

        // Only allow reordering within the same priority level
        if (activeTask.priority === overTask.priority) {
          // Calculate new positions for reordering
          const isMovingDown = overIndex > activeIndex;
          let newOrder: string;

          if (isMovingDown) {
            // Moving down: insert after the target
            const nextTask = targetTasks[overIndex + 1];
            const overOrder = parseFloat(overTask.columnOrder);
            
            if (nextTask) {
              const nextOrder = parseFloat(nextTask.columnOrder);
              newOrder = ((overOrder + nextOrder) / 2).toString();
            } else {
              // Moving to the end of the list
              newOrder = (overOrder + 1000).toString();
            }
          } else {
            // Moving up: insert before the target
            const prevTask = targetTasks[overIndex - 1];
            const overOrder = parseFloat(overTask.columnOrder);
            
            if (prevTask) {
              const prevOrder = parseFloat(prevTask.columnOrder);
              newOrder = ((prevOrder + overOrder) / 2).toString();
            } else {
              // Moving to the beginning of the list
              newOrder = Math.max(overOrder - 1000, 100).toString();
            }
          }

          updates.push({
            id: activeId,
            columnOrder: newOrder
          });
        } else {
          // Show message that you can't reorder across priorities
          toast.info("Tasks can only be reordered within the same priority level");
          return;
        }
      }
    }

    // Apply updates
    if (updates.length > 0) {
      updateOrderMutation.mutate({
        projectId,
        tasks: updates as Array<{ id: string; columnOrder: string; status?: "todo" | "doing" | "done" }>
      });
    }
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleToggleReady = (taskId: string, ready: boolean) => {
    toggleReadyMutation.mutate({ id: taskId, ready });
  };

  const handleStageChange = (taskId: string, stage: string | null) => {
    updateStageMutation.mutate({ id: taskId, stage: stage as "refine" | "plan" | "execute" | null });
  };

  const handleDeleteTask = (task: any) => {
    setTaskToDelete(task);
    setDeleteTaskId(task.id);
  };

  const handleConfirmDelete = () => {
    if (deleteTaskId) {
      deleteTaskMutation.mutate({ id: deleteTaskId });
    }
  };

  const handleResetAgent = (task: any) => {
    setTaskToReset(task);
    setResetTaskId(task.id);
  };

  const handleConfirmReset = () => {
    if (resetTaskId) {
      resetAgentMutation.mutate({ id: resetTaskId });
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.rawTitle || !newTask.repoAgentId) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Calculate columnOrder for new task (place at end of column)
    const columnTasks = groupedTasks[newTaskColumn] || [];
    const newOrder = columnTasks.length > 0 
      ? (parseFloat(columnTasks[columnTasks.length - 1].columnOrder) + 1000).toString()
      : "1000";

    // For now, create task without attachments - will be implemented in next step
    createTaskMutation.mutate({
      projectId,
      ...newTask,
      // Convert __default__ back to undefined for the API
      actorId: newTask.actorId === "__default__" ? undefined : newTask.actorId,
      attachments: [] // TODO: Implement file upload after task creation
    });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const activeTask = activeId ? project?.tasks?.find((t: any) => t.id === activeId) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{project?.name}</h1>
          {/* WebSocket connection status */}
          <div className="flex items-center gap-1 text-xs">
            <div className={cn(
              "w-2 h-2 rounded-full",
              connectionStatus === 'connected' ? "bg-green-500" :
              connectionStatus === 'connecting' ? "bg-yellow-500" :
              connectionStatus === 'error' ? "bg-red-500" : "bg-gray-500"
            )} />
            <span className="text-muted-foreground">
              {connectionStatus === 'connected' ? 'Live' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'error' ? 'Connection Error' : 'Offline'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowProjectSettings(true)} variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Kanban Board with Drag and Drop */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {statusColumns.map((column) => {
              const columnTasks = groupedTasks[column.id] || [];
              const Icon = column.icon;

              return (
                <div key={column.id} className="kanban-column">
                  <div className="bg-muted/50 rounded-lg kanban-column-content">
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", column.color)} />
                        <h3 className="font-semibold">{column.label}</h3>
                        <Badge variant="secondary">{columnTasks.length}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setNewTaskColumn(column.id);
                          setShowNewTaskDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Tasks */}
                    <ScrollArea className="h-[calc(100vh-250px)]">
                      <SortableContext items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        <div className="kanban-tasks-container">
                          {columnTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onTaskClick={handleTaskClick}
                              onToggleReady={handleToggleReady}
                              onStageChange={handleStageChange}
                              onDeleteTask={handleDeleteTask}
                              onResetAgent={handleResetAgent}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </ScrollArea>
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              onTaskClick={() => {}}
              onToggleReady={() => {}}
              onStageChange={() => {}}
              onDeleteTask={() => {}}
              onResetAgent={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* New Task Dialog */}
      <Dialog 
        open={showNewTaskDialog} 
        onOpenChange={(open) => {
          setShowNewTaskDialog(open);
          // Don't clear draft when closing - preserve for later
        }}
      >
        <DialogContent className="max-w-[700px] w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to the {statusColumns.find(c => c.id === newTaskColumn)?.label} column
              {hasDraft && (
                <span className="text-xs text-muted-foreground block mt-1">
                  📝 Draft restored from previous session
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="Task title"
                value={newTask.rawTitle}
                onChange={(e) => updateDraft({ rawTitle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Task description (optional)"
                value={newTask.rawDescription}
                onChange={(e) => updateDraft({ rawDescription: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={newTask.priority.toString()}
                  onValueChange={(value) => updateDraft({ priority: parseInt(value) as Priority })}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getPriorityOptions().map(option => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-repo-agent">Repo Agent</Label>
                {repoAgents && repoAgents.length === 1 ? (
                  // Auto-selected single repo agent - show read-only field
                  <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {repoAgents[0].name} ({repoAgents[0].agentClient.type})
                    <span className="ml-auto text-xs text-green-600">Auto-selected</span>
                  </div>
                ) : (
                  // Multiple repo agents - show dropdown
                  <Select
                    value={newTask.repoAgentId}
                    onValueChange={(value) => updateDraft({ repoAgentId: value })}
                  >
                    <SelectTrigger id="task-repo-agent">
                      <SelectValue placeholder="Select repo agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {repoAgents?.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name} ({agent.agentClient.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-actor">Actor (Optional)</Label>
              <Select
                value={newTask.actorId}
                onValueChange={(value) => updateDraft({ actorId: value })}
              >
                <SelectTrigger id="task-actor">
                  <SelectValue placeholder="Select actor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">None (Use Default)</SelectItem>
                  {actors?.map((actor: any) => (
                    <SelectItem key={actor.id} value={actor.id}>
                      {actor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* File Attachments */}
            <div className="space-y-2">
              <Label>Attachments (Optional)</Label>
              <AttachmentDropzone
                attachments={newTask.attachments}
                onAttachmentsChange={(attachments) => updateDraft({ attachments })}
                disabled={createTaskMutation.isPending}
              />
            </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-4 border-t bg-background/50">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewTaskDialog(false);
                // Don't clear draft on cancel - let user return to their work later
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Drawer */}
      <TaskDrawer
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId(null);
          }
        }}
      />

      {/* Project Settings Dialog */}
      {showProjectSettings && project && (
        <ProjectSettings
          project={project}
          open={showProjectSettings}
          onOpenChange={setShowProjectSettings}
        />
      )}

      {/* Delete Task Confirmation Dialog */}
      <DeleteTaskDialog
        open={!!deleteTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTaskId(null);
            setTaskToDelete(null);
          }
        }}
        taskTitle={taskToDelete?.refinedTitle || taskToDelete?.rawTitle || ""}
        onConfirm={handleConfirmDelete}
        loading={deleteTaskMutation.isPending}
      />

      {/* Reset Agent Modal */}
      <ResetAgentModal
        open={!!resetTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setResetTaskId(null);
            setTaskToReset(null);
          }
        }}
        taskTitle={taskToReset?.refinedTitle || taskToReset?.rawTitle || ""}
        onConfirm={handleConfirmReset}
        loading={resetAgentMutation.isPending}
      />
    </div>
  );
}
