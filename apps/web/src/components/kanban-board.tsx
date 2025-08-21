import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Plus, MoreHorizontal, Clock, Play, CheckCircle, Settings, AlertCircle, GripVertical, ExternalLink, RotateCcw, ChevronDown, GitBranch, Lock
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProjectCache } from "@/hooks/use-cache-utils";
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
import { ProjectSettingsV2 } from "@/components/v2/project-settings-v2";
import { TaskStageSelector } from "@/components/task-stage-selector";
import { AIActivityBadge } from "@/components/ai-activity-badge";
import { AttachmentDropzone } from "@/components/attachment-dropzone";
import { DeleteTaskDialog } from "@/components/delete-task-dialog";
import { ResetAgentModal } from "@/components/reset-agent-modal";
import { TodoColumnSections } from "@/components/todo-column-sections";
import type { AttachmentFile } from "@/hooks/use-task-draft";
import { useWebSocket } from "@/hooks/use-websocket";
import { useTaskDraft } from "@/hooks/use-task-draft";
import { getPriorityColors, getPriorityDisplay, getPriorityOptions, comparePriority, type Priority } from "@/utils/priority";

// Drag and drop imports
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  MouseSensor,
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

// 4-column structure with Loop support
const statusColumns = [
  { id: "todo", label: "Todo", icon: Clock, color: "bg-slate-500" },
  { id: "doing", label: "Doing", icon: Play, color: "bg-blue-500" },
  { id: "done", label: "Done", icon: CheckCircle, color: "bg-green-500" },
  { id: "loop", label: "Loop", icon: RotateCcw, color: "bg-purple-500" },
];

const stageColors = {
  clarify: "bg-purple-100 text-purple-800 border-purple-200",
  plan: "bg-pink-100 text-pink-800 border-pink-200",
  execute: "bg-blue-100 text-blue-800 border-blue-200",
  loop: "bg-orange-100 text-orange-800 border-orange-200",
  talk: "bg-green-100 text-green-800 border-green-200",
};

// Priority colors are now handled by the priority utility

// Helper function to check if task is stuck (1+ minutes of AI working)
function isTaskStuck(task: any): boolean {
  if (task.agentSessionStatus !== 'ACTIVE' && task.agentSessionStatus !== 'PUSHING') {
    return false;
  }

  if (!task.lastAgentSessionStartedAt) {
    return true;
  }

  const workingSince = new Date(task.lastAgentSessionStartedAt);
  const now = new Date();
  const minutesWorking = (now.getTime() - workingSince.getTime()) / (1000 * 60);

  return minutesWorking >= 1;
}

// Helper function to get reset button tooltip text
function getResetButtonTooltip(task: any): string {
  if (task.agentSessionStatus !== 'ACTIVE' && task.agentSessionStatus !== 'PUSHING') {
    return "Only available when AI is working on this task";
  }

  if (!task.lastAgentSessionStartedAt) {
    return "Only available when AI is working on this task";
  }

  const workingSince = new Date(task.lastAgentSessionStartedAt);
  const now = new Date();
  const millisecondsWorking = now.getTime() - workingSince.getTime();
  const millisecondsUntilStuck = (1 * 60 * 1000) - millisecondsWorking; // 1 minute in milliseconds

  if (millisecondsUntilStuck <= 0) {
    return "Reset the AI agent for this task";
  }

  const secondsRemaining = Math.ceil(millisecondsUntilStuck / 1000);
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  let timeString = "";
  if (minutes > 0) {
    timeString = `${minutes}m ${seconds}s`;
  } else {
    timeString = `${seconds}s`;
  }

  return `Available in ${timeString} (when AI has been working for 1 minute)`;
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
  // Use CSS breakpoint-aware truncation
  const shouldTruncate = description && description.length > 150;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-pointer hover:shadow-md transition-all duration-200 kanban-card",
        "touch-manipulation select-none",
        "max-sm:active:scale-[0.98] max-sm:hover:scale-[1.02]",
        "min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2",
        isDragging && "opacity-50 cursor-grabbing scale-105 shadow-xl z-50"
      )}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`Task: ${task.refinedTitle || task.rawTitle}. Priority: ${getPriorityDisplay(task.priority)}. Status: ${task.status}. ${task.ready ? 'Ready for AI' : 'Not ready'}`}
      aria-describedby={`task-${task.id}-description`}
      onClick={(e) => {
        // Only trigger click if not clicking on interactive elements
        const target = e.target as HTMLElement;
        if (!target.closest('button, [role="switch"], [data-radix-collection-item]')) {
          e.preventDefault();
          onTaskClick(task.id);
        }
      }}
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
                  className="h-8 w-8 p-0 min-h-[44px] min-w-[44px] max-sm:h-10 max-sm:w-10 touch-manipulation"
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isTaskStuck(task)) {
                              onResetAgent(task);
                            }
                          }}
                          disabled={!isTaskStuck(task)}
                          className={cn(
                            isTaskStuck(task)
                              ? "text-orange-600"
                              : "text-muted-foreground cursor-not-allowed opacity-50"
                          )}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset AI
                        </DropdownMenuItem>
                      </div>
                    </TooltipTrigger>
                                        <TooltipContent>
                      {getResetButtonTooltip(task)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
            agentSessionStatus={task.agentSessionStatus}
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
                {!showMore && shouldTruncate ? (
                  <>
                    <span className="sm:hidden">{description.slice(0, 100)}...</span>
                    <span className="hidden sm:inline">{description.slice(0, 150)}...</span>
                  </>
                ) : description}
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
                className="flex items-center gap-1 text-xs text-gray-300 hover:text-white hover:opacity-70 mt-1 transition-all duration-200 max-sm:py-2 max-sm:text-sm min-h-[44px] touch-manipulation select-none"
              >
                <span>{showMore ? 'Show less' : 'Show more'}</span>
                <ChevronDown className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  showMore && "rotate-180"
                )} />
              </button>
            )}
          </div>
        )}

        {/* Ready toggle - only show for non-completed and non-loop tasks */}
        {task.status !== 'done' && task.status !== 'loop' && (
          <div className="kanban-card-status">
            <div className="kanban-card-ready-toggle">
              <Switch
                id={`ready-${task.id}`}
                checked={task.ready}
                onCheckedChange={(checked) => {
                  onToggleReady(task.id, checked);
                }}
                onClick={(e) => e.stopPropagation()}
                className="data-[state=checked]:bg-green-600 data-[state=checked]:hover:bg-green-700"
              />
              <span className="text-xs text-muted-foreground">
                {task.ready ? "Ready" : "Not Ready"}
              </span>
            </div>
          </div>
        )}

        {/* Repository and Actor info */}
        {task.mainRepository && (
          <div className="text-xs text-muted-foreground mt-1 kanban-card-text">
            Repo: {task.mainRepository.name}
          </div>
        )}
        {task.assignedAgents && task.assignedAgents.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1 kanban-card-text">
            Agents: {task.assignedAgents.map((agent: any) => `${agent.agentType} (${agent.name})`).join(", ")}
          </div>
        )}
        {task.actor && (
          <div className="text-xs text-muted-foreground kanban-card-text">
            Actor: {task.actor.name}
          </div>
        )}

        {/* Dependencies - Enhanced Visual Display */}
        {task.dependencies && task.dependencies.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <GitBranch className="h-3 w-3" />
              <span className="font-medium">Dependencies ({task.dependencies.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {task.dependencies.map((dep: any) => {
                const isCompleted = dep.status === 'done';
                const isBlocking = !isCompleted;

                return (
                  <Badge
                    key={dep.id}
                    variant="outline"
                    className={cn(
                      "text-xs flex items-center gap-1",
                      isCompleted
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    )}
                  >
                    {isBlocking && <Lock className="h-2 w-2" />}
                    {isCompleted && <CheckCircle className="h-2 w-2" />}
                    <span className="truncate max-w-24">
                      {dep.refinedTitle || dep.rawTitle}
                    </span>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Show if task is blocked by dependencies */}
        {task.dependencies && task.dependencies.some((dep: any) => dep.status !== 'done') && (
          <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 bg-amber-50 p-1 rounded border border-amber-200">
            <Lock className="h-3 w-3" />
            <span className="font-medium">Blocked by dependencies</span>
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

export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const router = useRouter();
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState<string>("todo");
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [projectSettingsTab, setProjectSettingsTab] = useState<'repositories' | 'agents'>('repositories');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [resetTaskId, setResetTaskId] = useState<string | null>(null);
  const [taskToReset, setTaskToReset] = useState<any>(null);
  // Use task draft hook for auto-save functionality
  const { draft: newTask, updateDraft, clearDraft, hasDraft } = useTaskDraft(newTaskColumn);

  // Project-specific cache utilities
  const cache = useProjectCache(projectId);

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

  // Drag and drop sensors - optimized for touch and mouse
  const sensors = useSensors(
    // Touch sensor for mobile devices
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    }),
    // Mouse sensor for desktop
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    // Fallback pointer sensor
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch project with tasks using oRPC but with standardized cache management
  const { data: project, isLoading, refetch } = useQuery(
    orpc.projects.getWithTasks.queryOptions({
      input: { id: projectId },
    })
  );

  // Fetch repositories for this project
  const { data: repositories } = useQuery(
    orpc.repositories.list.queryOptions({
      input: { projectId },
      enabled: !!projectId
    })
  );

  // Fetch agents for current user
  const { data: agents } = useQuery(
    orpc.agents.list.queryOptions({
      input: { projectId: projectId!, includeTaskCounts: false },
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

  // Auto-select repository and agent when only one is available
  useEffect(() => {
    if (repositories && repositories.length === 1 && !newTask.mainRepositoryId) {
      updateDraft({ mainRepositoryId: repositories[0].id });
    }
    if (agents && agents.length === 1 && !newTask.assignedAgentIds?.length) {
      updateDraft({ assignedAgentIds: [agents[0].id] });
    }
  }, [repositories, agents, newTask.mainRepositoryId, newTask.assignedAgentIds, updateDraft]);

  // Create task mutation
  const createTaskMutation = useMutation(orpc.tasks.create.mutationOptions({
    onMutate: async (variables: any) => {
      // Cancel any outgoing refetches
      const queryKey = cache.queryKeys.projects.withTasks();
      await cache.cancelQueries(queryKey);

      // Use optimistic update to add task immediately
      const newTask = {
        id: 'temp-' + Date.now(), // Temporary ID that will be replaced by server
        ...variables,
        refinedTitle: variables.rawTitle,
        refinedDescription: variables.rawDescription,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agentSessionStatus: 'INACTIVE' as const,
        author: 'human' as const,
        ready: true, // Set ready by default for new tasks
        columnOrder: '1000', // Default order
      };

      const context = await cache.optimistic.addTaskToProject(projectId, newTask);
      return context;
    },
    onSuccess: (data: any) => {
      toast.success("Task created successfully");
      setShowNewTaskDialog(false);
      clearDraft(); // Clear the auto-saved draft
      // Update the optimistic task with real server data
      const queryKey = cache.queryKeys.projects.withTasks();
      const cachedData = cache.getCachedData(queryKey);
      if (cachedData) {
        // Find the temporary task and replace it with the real one
        const tasks = (cachedData as any).tasks || [];
        const tempTaskIndex = tasks.findIndex((task: any) =>
          task.id.startsWith('temp-') && task.rawTitle === data.rawTitle
        );

        if (tempTaskIndex >= 0) {
          // Replace temp task with real task data, preserving any display properties
          const tempTask = tasks[tempTaskIndex];
          const updatedTasks = [...tasks];
          updatedTasks[tempTaskIndex] = {
            ...data,
            // Preserve relationships that might have been included in optimistic update
            mainRepository: tempTask.mainRepository || (data as any).mainRepository,
            assignedAgents: tempTask.assignedAgents || (data as any).assignedAgents,
            actor: tempTask.actor || (data as any).actor
          };

          cache.setCachedData(queryKey, {
            ...cachedData,
            tasks: updatedTasks
          });
        } else {
          // Fallback: just add the new task if temp task not found
          cache.setCachedData(queryKey, {
            ...cachedData,
            tasks: [...tasks, data]
          });
        }
      }
      console.log('✅ Task created successfully');
    },
    onError: (error: any, variables: any, context: any) => {
      // Rollback optimistic update
      if (context?.previousData && context?.queryKey) {
        cache.optimistic.rollback(context.queryKey, context.previousData);
      }
      toast.error("Failed to create task: " + error.message);
    }
  }));

  // Toggle ready mutation
  const toggleReadyMutation = useMutation(orpc.tasks.toggleReady.mutationOptions({
    onMutate: async (variables: any) => {
      // Optimistically update the task's ready state
      const context = await cache.task.optimisticUpdate(variables.id, (task: any) => ({
        ...task,
        ready: variables.ready
      }));
      return context;
    },
    onSuccess: () => {
      // Don't invalidate immediately - optimistic update should persist
      console.log('\u2705 Task ready state updated successfully');
    },
    onError: (error: any, variables: any, context: any) => {
      // Rollback optimistic update
      if (context?.previousData && context?.queryKey) {
        cache.optimistic.rollback(context.queryKey, context.previousData);
      }
      toast.error("Failed to update task: " + error.message);
    }
  }));

  // Update stage mutation
  const updateStageMutation = useMutation(orpc.tasks.updateStage.mutationOptions({
    onMutate: async (variables: any) => {
      // Optimistically update the task's stage
      const context = await cache.task.optimisticUpdate(variables.id, (task: any) => ({
        ...task,
        stage: variables.stage
      }));
      return context;
    },
    onSuccess: () => {
      // Don't invalidate immediately - optimistic update should persist
      console.log('\u2705 Task stage updated successfully');
    },
    onError: (error: any, variables: any, context: any) => {
      // Rollback optimistic update
      if (context?.previousData && context?.queryKey) {
        cache.optimistic.rollback(context.queryKey, context.previousData);
      }
      toast.error("Failed to update task stage: " + error.message);
    }
  }));

  // Delete task mutation
  const deleteTaskMutation = useMutation(orpc.tasks.delete.mutationOptions({
    onMutate: async (variables: any) => {
      // Use standardized optimistic removal
      const context = await cache.task.optimisticRemove(variables.id);
      return context;
    },
    onError: (error: any, variables: any, context: any) => {
      // Use standardized rollback
      if (context?.previousData && context?.queryKey) {
        cache.optimistic.rollback(context.queryKey, context.previousData);
      }
      toast.error("Failed to delete task: " + error.message);
    },
    onSuccess: () => {
      toast.success("Task deleted successfully");
      // Clear the delete modal state
      setDeleteTaskId(null);
      setTaskToDelete(null);
      // Don't invalidate - optimistic update should persist unless there are server changes
      console.log('✅ Task deleted successfully');
    }
  }));

  // Reset agent mutation
  const resetAgentMutation = useMutation(orpc.tasks.resetAi.mutationOptions({
    onMutate: async (variables: any) => {
      // Optimistically update the task's agent session status
      const context = await cache.task.optimisticUpdate(variables.id, (task: any) => ({
        ...task,
        agentSessionStatus: 'INACTIVE',
        agentSessionId: null,
        lastAgentSessionStartedAt: null
      }));
      return context;
    },
    onSuccess: () => {
      toast.success("AI agent status reset successfully");
      setResetTaskId(null);
      setTaskToReset(null);
      // Don't invalidate - optimistic update should persist
      console.log('✅ Agent reset successfully');
    },
    onError: (error: any, variables: any, context: any) => {
      // Rollback optimistic update on error
      if (context?.previousData && context?.queryKey) {
        cache.optimistic.rollback(context.queryKey, context.previousData);
      }
      toast.error("Failed to reset agent: " + error.message);
    }
  }));

  // Update task order mutation
  const updateOrderMutation = useMutation(orpc.tasks.updateOrder.mutationOptions({
    onMutate: async (variables: any) => {
      const queryKey = cache.queryKeys.projects.withTasks();

      // Cancel any outgoing refetches
      await cache.cancelQueries(queryKey);

      // Snapshot the previous value
      const previousData = cache.getCachedData(queryKey);

      // Optimistically update to the new value
      if (previousData) {
        cache.setCachedData(queryKey, {
          ...previousData,
          tasks: (previousData as any).tasks.map((task: any) => {
            const update = variables.tasks.find((u: any) => u.id === task.id);
            if (update) {
              return {
                ...task,
                columnOrder: update.columnOrder,
                status: update.status || task.status
              };
            }
            return task;
          }),
        });
      }

      // Return context for rollback
      return { previousData, queryKey };
    },
    onError: (error: any, variables: any, context: any) => {
      // Use standardized rollback
      if (context?.previousData && context?.queryKey) {
        cache.optimistic.rollback(context.queryKey, context.previousData);
      }
      toast.error("Failed to update task order: " + error.message);
    },
    onSuccess: () => {
      // Don't invalidate - optimistic update should persist
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

    // Final sort - special handling for Done column
    if (column.id === 'done') {
      // Done column: always sort by completion time newest first (descending)
      // Use a more reliable completion time approach - combination of status and timestamps
      columnTasks = columnTasks.sort((a: any, b: any) => {
        // For done tasks, we'll use updatedAt as the best available completion indicator
        // since tasks get updatedAt set when they move to done status
        // But we'll also consider createdAt as a secondary sort for stability
        const aTime = new Date(a.updatedAt).getTime();
        const bTime = new Date(b.updatedAt).getTime();

        // If updatedAt times are very close (within 1 second), fall back to createdAt for stable sorting
        const timeDiff = Math.abs(aTime - bTime);
        if (timeDiff < 1000) {
          const aCreated = new Date(a.createdAt).getTime();
          const bCreated = new Date(b.createdAt).getTime();
          return bCreated - aCreated; // Newest first
        }

        return bTime - aTime; // Newest first (descending)
      });
    } else {
      // Other columns: sort by priority first, then columnOrder
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
    }

    acc[column.id] = columnTasks;
    return acc;
  }, {} as Record<string, any[]>);

  // Separate normal and loop tasks for Todo column
  const todoNormalTasks = groupedTasks.todo ? groupedTasks.todo.filter((task: any) => task.stage !== 'loop') : [];
  const todoLoopTasks = groupedTasks.todo ? groupedTasks.todo.filter((task: any) => task.stage === 'loop') : [];

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
      targetStatus = overId as "todo" | "doing" | "done" | "loop";
      // For Todo column, use combined tasks from both sections
      targetTasks = targetStatus === 'todo' ? [...todoNormalTasks, ...todoLoopTasks] : groupedTasks[targetStatus];
    } else {
      // Find which column the target task belongs to
      for (const column of statusColumns) {
        const columnTasks = column.id === 'todo' ? [...todoNormalTasks, ...todoLoopTasks] : groupedTasks[column.id];
        if (columnTasks.some((t: any) => t.id === overId)) {
          targetStatus = column.id as "todo" | "doing" | "done" | "loop";
          targetTasks = columnTasks;
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
        tasks: updates as Array<{ id: string; columnOrder: string; status?: "todo" | "doing" | "done" | "loop" }>
      });
    }
  };

  const handleTaskClick = (taskId: string) => {
    // Navigate to dedicated task page with popup mode based on screen size
    const shouldUsePopup = typeof window !== 'undefined' && window.innerWidth < 768;
    
    router.navigate({
      to: "/projects/$projectId/tasks/$taskId",
      params: { projectId, taskId },
      search: shouldUsePopup ? { popup: true } : {},
    });
  };

  const handleToggleReady = (taskId: string, ready: boolean) => {
    toggleReadyMutation.mutate({ id: taskId, ready });
  };

  const handleStageChange = (taskId: string, stage: string | null) => {
    updateStageMutation.mutate({ id: taskId, stage: stage as "clarify" | "plan" | "execute" | "loop" | null });
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
    // Check if project has required setup
    if (!repositories || repositories.length === 0) {
      toast.error("No repositories configured");
      setShowNewTaskDialog(false);
      setProjectSettingsTab('repositories');
      setShowProjectSettings(true);
      return;
    }

    if (!agents || agents.length === 0) {
      toast.error("No agents configured");
      setShowNewTaskDialog(false);
      setProjectSettingsTab('agents');
      setShowProjectSettings(true);
      return;
    }

    if (!newTask.rawTitle || !newTask.mainRepositoryId || !newTask.assignedAgentIds?.length) {
      toast.error("Please fill in all required fields (title, repository, and agent)");
      return;
    }

    createTaskMutation.mutate({
      projectId,
      ...newTask,
      // Convert __default__ back to undefined for the API
      actorId: newTask.actorId === "__default__" ? undefined : newTask.actorId,
      status: newTaskColumn as "todo" | "doing" | "done" | "loop", // Support creating tasks in loop column
      stage: newTask.stage as "clarify" | "plan" | "execute" | "loop" | null
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
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate">{project?.name}</h1>
          {/* WebSocket connection status */}
          <div className="flex items-center gap-1 text-xs hidden sm:flex">
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
          <Button
            onClick={() => setShowProjectSettings(true)}
            variant="outline"
            size="sm"
            className="max-sm:h-11 max-sm:w-11 max-sm:p-0 min-h-[44px] touch-manipulation hover:bg-accent focus-visible:ring-2"
          >
            <Settings className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Settings</span>
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="max-sm:h-11 max-sm:w-11 max-sm:p-0 max-sm:text-lg min-h-[44px] touch-manipulation hover:bg-accent focus-visible:ring-2"
          >
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">↻</span>
          </Button>
        </div>
      </div>

      {/* Kanban Board with Drag and Drop */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full whitespace-nowrap kanban-board-container">
          <div className="flex gap-2 sm:gap-3 md:gap-4 pb-4 px-1">
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
                        <Badge variant="secondary">
                          {column.id === 'todo' ? todoNormalTasks.length + todoLoopTasks.length : columnTasks.length}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Add task button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Check if project has required setup before opening dialog
                            if (!repositories || repositories.length === 0 || !agents || agents.length === 0) {
                              if (!repositories || repositories.length === 0) {
                                toast.error("Please configure repositories first");
                                setProjectSettingsTab('repositories');
                              } else if (!agents || agents.length === 0) {
                                toast.error("Please configure agents first");
                                setProjectSettingsTab('agents');
                              }
                              setShowProjectSettings(true);
                              return;
                            }

                            setNewTaskColumn(column.id);
                            setShowNewTaskDialog(true);
                          }}
                          className="h-10 w-10 p-0 min-h-[44px] min-w-[44px] touch-manipulation hover:bg-accent focus-visible:ring-2"
                          aria-label={`Add new task to ${column.label} column`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Tasks */}
                    {column.id === 'todo' ? (
                      <TodoColumnSections
                        normalTasks={todoNormalTasks}
                        loopTasks={todoLoopTasks}
                        onTaskClick={handleTaskClick}
                        onToggleReady={handleToggleReady}
                        onStageChange={handleStageChange}
                        onDeleteTask={handleDeleteTask}
                        onResetAgent={handleResetAgent}
                        TaskCardComponent={TaskCard}
                      />
                    ) : (
                      <ScrollArea className="h-[calc(100vh-250px)] max-sm:h-[calc(100vh-200px)]">
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
                    )}
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
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col sm:max-w-4xl sm:w-[95vw] max-sm:fixed max-sm:inset-4 max-sm:max-w-none max-sm:w-auto max-sm:h-auto max-sm:rounded-lg max-sm:max-h-[calc(100vh-2rem)]">
          <DialogHeader className="flex-shrink-0 pb-4 max-sm:p-4 max-sm:border-b">
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
          <div className="flex-1 overflow-y-auto px-6 min-h-0 max-sm:px-4 max-sm:py-2">
            <div className="space-y-3 pb-4 max-sm:space-y-4">
            <div className="space-y-2 max-sm:space-y-3">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="Task title"
                value={newTask.rawTitle}
                onChange={(e) => updateDraft({ rawTitle: e.target.value })}
                className="max-sm:text-base max-sm:h-12"
                autoComplete="off"
                autoCapitalize="sentences"
                spellCheck="true"
              />
            </div>
            <div className="space-y-2 max-sm:space-y-3">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Task description (optional)"
                value={newTask.rawDescription}
                onChange={(e) => updateDraft({ rawDescription: e.target.value })}
                rows={3}
                className="max-sm:text-base max-sm:min-h-20 resize-y"
                autoComplete="off"
                autoCapitalize="sentences"
                spellCheck="true"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-2 max-sm:space-y-3">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={newTask.priority.toString()}
                  onValueChange={(value) => updateDraft({ priority: parseInt(value) as Priority })}
                >
                  <SelectTrigger id="task-priority" className="max-sm:h-12 max-sm:text-base">
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
              <div className="space-y-2 max-sm:space-y-3">
                <Label htmlFor="task-repository">Main Repository</Label>
                {repositories && repositories.length === 1 ? (
                  // Auto-selected single repository - show read-only field
                  <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground max-sm:h-12 max-sm:text-base">
                    {repositories[0].name}
                    <span className="ml-auto text-xs text-green-600">Auto-selected</span>
                  </div>
                ) : (
                  // Multiple repositories - show dropdown
                  <Select
                    value={newTask.mainRepositoryId}
                    onValueChange={(value) => updateDraft({ mainRepositoryId: value })}
                  >
                    <SelectTrigger id="task-repository" className="max-sm:h-12 max-sm:text-base">
                      <SelectValue placeholder="Select main repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {repositories?.map((repo: any) => (
                        <SelectItem key={repo.id} value={repo.id}>
                          {repo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2 max-sm:space-y-3">
                <Label htmlFor="task-agents">Assigned Agents</Label>
                {agents && agents.length === 1 ? (
                  // Auto-selected single agent - show read-only field
                  <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground max-sm:h-12 max-sm:text-base">
                    {agents[0].agentType} ({agents[0].name})
                    <span className="ml-auto text-xs text-green-600">Auto-selected</span>
                  </div>
                ) : (
                  // Multiple agents - show dropdown (for now, we'll use a simple select instead of multi-select)
                  <Select
                    value={newTask.assignedAgentIds?.[0] || ""}
                    onValueChange={(value) => updateDraft({ assignedAgentIds: value ? [value] : [] })}
                  >
                    <SelectTrigger id="task-agents" className="max-sm:h-12 max-sm:text-base">
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents?.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.agentType} ({agent.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-2 max-sm:space-y-3">
              <Label htmlFor="task-actor">Actor (Optional)</Label>
              <Select
                value={newTask.actorId}
                onValueChange={(value) => updateDraft({ actorId: value })}
              >
                <SelectTrigger id="task-actor" className="max-sm:h-12 max-sm:text-base">
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
            <div className="space-y-2 max-sm:space-y-3">
              <Label htmlFor="task-stage">Stage (Optional)</Label>
              <div className="flex items-center gap-2">
                <TaskStageSelector
                  stage={newTask.stage}
                  status="doing" // Force showing stage selector in creation mode
                  onStageChange={(stage) => updateDraft({ stage })}
                  size="md"
                />
                <span className="text-xs text-muted-foreground">
                  Default: {newTaskColumn === 'loop' ? 'Loop' : 'clarify'}
                </span>
              </div>
            </div>

            {/* File Attachments */}
            <div className="space-y-2 max-sm:space-y-3">
              <Label>Attachments (Optional)</Label>
              <AttachmentDropzone
                attachments={newTask.attachments}
                onAttachmentsChange={(attachments) => updateDraft({ attachments })}
                disabled={createTaskMutation.isPending}
              />
            </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-4 border-t bg-background/50 max-sm:px-4 max-sm:py-4 max-sm:gap-2 max-sm:flex-col-reverse max-sm:sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setShowNewTaskDialog(false);
                // Don't clear draft on cancel - let user return to their work later
              }}
              className="max-sm:w-full min-h-[44px] touch-manipulation focus-visible:ring-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={createTaskMutation.isPending}
              className="max-sm:w-full min-h-[44px] touch-manipulation focus-visible:ring-2 disabled:opacity-50"
            >
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Project Settings Dialog */}
      {showProjectSettings && project && (
        <ProjectSettingsV2
          project={project}
          open={showProjectSettings}
          onOpenChange={setShowProjectSettings}
          defaultTab={projectSettingsTab}
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
