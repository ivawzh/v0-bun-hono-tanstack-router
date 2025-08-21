/**
 * Dedicated task page route
 * Accessible via /projects/{projectId}/tasks/{taskId}
 * Reuses TaskContent component for consistent UI
 */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { orpc } from "@/utils/orpc";
import { TaskPopup } from "@/components/v2/task-popup";
import { TaskContent } from "@/components/v2/task-content";
import type { TaskV2, DependencyData, AvailableTask } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Edit3, MoreVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriorityColors, getPriorityDisplay } from "@/utils/priority";
import { AIActivityBadge } from "@/components/ai-activity-badge";
import { toast } from "sonner";
import { useCacheUtils } from "@/hooks/use-cache-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskPageSearch {
  popup?: boolean;
}

export const Route = createFileRoute("/projects/$projectId/tasks/$taskId")({
  validateSearch: (search: Record<string, unknown>): TaskPageSearch => {
    return {
      popup: Boolean(search.popup),
    };
  },
  component: TaskPage,
  head: ({ params }) => ({
    meta: [
      {
        title: `Task ${params.taskId.slice(0, 8)} - Solo Unicorn`,
      },
      {
        name: "description",
        content: "Task details and management",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Task Not Found</h1>
          <p className="text-xl text-muted-foreground">
            The task you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => reset()}>Try Again</Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  ),
});

function TaskPage() {
  const { projectId, taskId } = Route.useParams();
  const { popup } = Route.useSearch();
  const router = useRouter();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [tempDescription, setTempDescription] = useState("");

  const queryClient = useQueryClient();
  const cache = useCacheUtils();

  // Fetch task to verify it exists
  const { data: rawTask, isLoading, error } = useQuery(
    orpc.tasks.get.queryOptions({
      input: { id: taskId },
      retry: false,
    })
  );

  // Transform null to undefined for TypeScript compatibility
  const task = rawTask as TaskV2;

  // Fetch available repositories, agents, actors and dependencies (same as TaskPopup)
  const { data: repositories = [] } = useQuery(
    orpc.repositories.list.queryOptions({
      input: { projectId: task?.projectId || '' },
      enabled: !!task?.projectId
    })
  );

  const { data: agents = [] } = useQuery(
    orpc.agents.list.queryOptions({
      input: { projectId: task?.projectId || '', includeTaskCounts: false },
      enabled: !!task?.projectId
    })
  );

  const { data: actors = [] } = useQuery(
    orpc.actors.list.queryOptions({
      input: { projectId: task?.projectId || '' },
      enabled: !!task?.projectId
    })
  );

  const { data: rawDependencyData } = useQuery(
    orpc.tasks.getDependencies.queryOptions({
      input: { taskId: taskId! },
      enabled: !!taskId
    })
  );

  // Transform dependency data for TypeScript compatibility
  const dependencyData = rawDependencyData as DependencyData;

  const { data: rawAvailableTasks = [] } = useQuery(
    orpc.tasks.getAvailableDependencies.queryOptions({
      input: {
        projectId: task?.projectId || '',
        excludeTaskId: taskId || undefined
      },
      enabled: !!task?.projectId && !!taskId
    })
  );

  // Transform available tasks for TypeScript compatibility
  const availableTasks = rawAvailableTasks as AvailableTask[];

  // Mutations (same as TaskPopup)
  const updateTaskMutation = useMutation(orpc.tasks.update.mutationOptions({
    onSuccess: () => {
      toast.success("Task updated successfully");
      setEditingTitle(false);
      setEditingDescription(false);
      if (task?.projectId) {
        cache.invalidateProject(task.projectId);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to update task: ${error.message}`);
    }
  }));

  const deleteTaskMutation = useMutation(orpc.tasks.delete.mutationOptions({
    onSuccess: () => {
      toast.success("Task deleted successfully");
      handleNavigateToBoard();
      if (task?.projectId) {
        cache.invalidateProject(task.projectId);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to delete task: ${error.message}`);
    }
  }));

  const deleteAttachmentMutation = useMutation(orpc.tasks.deleteAttachment.mutationOptions({
    onSuccess: async () => {
      toast.success("Attachment deleted successfully");
      if (task?.id && task?.projectId) {
        await Promise.all([
          cache.invalidateAttachments(task.id, task.projectId),
          cache.invalidateTask(task.id, task.projectId),
          cache.invalidateProject(task.projectId)
        ]);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to delete attachment: ${error.message}`);
    }
  }));

  // Verify task belongs to the correct project
  const isValidTask = task && task.projectId === projectId;

  useEffect(() => {
    if (popup) {
      setIsPopupOpen(true);
    }
  }, [popup]);

  const handlePopupClose = () => {
    if (popup) {
      router.navigate({
        to: "/projects/$projectId",
        params: { projectId },
      });
    } else {
      setIsPopupOpen(false);
    }
  };

  const handleNavigateToBoard = () => {
    router.navigate({
      to: "/projects/$projectId",
      params: { projectId },
    });
  };

  const handleOpenPopup = () => {
    router.navigate({
      to: "/projects/$projectId/tasks/$taskId",
      params: { projectId, taskId },
      search: { popup: true },
    });
  };

  // Task update handlers (same as TaskPopup)
  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      updateTaskMutation.mutate({
        id: taskId!,
        rawTitle: tempTitle.trim()
      });
    } else {
      setEditingTitle(false);
    }
  };

  const handleDeleteTask = () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate({ id: taskId! });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading task...</div>
      </div>
    );
  }

  if (error || !isValidTask) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Task Not Found</h1>
            <p className="text-xl text-muted-foreground">
              The task you're looking for doesn't exist or you don't have access to it.
            </p>
          </div>
          <div className="flex gap-4 justify-center">
            <Button onClick={handleNavigateToBoard}>
              Back to Project
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show popup overlay mode
  if (popup) {
    return (
      <TaskPopup
        taskId={taskId}
        open={isPopupOpen}
        onOpenChange={handlePopupClose}
      />
    );
  }

  // Full page mode - render task content in a card layout
  const modeOptions = [
    { value: "clarify", label: "clarify", color: "bg-purple-100 text-purple-800 border-purple-200" },
    { value: "plan", label: "Plan", color: "bg-pink-100 text-pink-800 border-pink-200" },
    { value: "execute", label: "Execute", color: "bg-blue-100 text-blue-800 border-blue-200" },
  ];

  const currentMode = modeOptions.find(s => s.value === task?.mode);

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNavigateToBoard}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Board
            </Button>
            <div className="h-4 border-l border-border" />
            <h1 className="font-semibold text-lg">
              Task {taskId.slice(0, 8)}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenPopup}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open in Popup
          </Button>
        </div>
      </div>

      {/* Task content */}
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            {/* Header with badges and metadata */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={getPriorityColors(task.priority)}>
                  {getPriorityDisplay(task.priority)}
                </Badge>
                <AIActivityBadge
                  ready={task.ready}
                  agentSessionStatus={task.agentSessionStatus as "INACTIVE" | "PUSHING" | "ACTIVE" | null | undefined}
                  list={task.list}
                />
                {currentMode && (
                  <Badge variant="outline" className={currentMode.color}>
                    {currentMode.label}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  TASK-{task.id.slice(0, 8)}
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDeleteTask} className="text-red-600">
                    <X className="h-4 w-4 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Title */}
            <div className="mb-4">
              {editingTitle ? (
                <div className="space-y-3">
                  <input
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveTitle();
                      } else if (e.key === 'Escape') {
                        setEditingTitle(false);
                      }
                    }}
                    className="w-full text-lg font-semibold bg-transparent border-0 outline-0 focus:ring-0"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveTitle}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingTitle(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <h1 className="text-xl font-semibold flex-1">
                    {task.refinedTitle || task.rawTitle}
                  </h1>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTempTitle(task.rawTitle);
                      setEditingTitle(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <TaskContent
              task={task}
              repositories={repositories}
              agents={agents}
              actors={actors}
              dependencyData={dependencyData}
              availableTasks={availableTasks}
              editingDescription={editingDescription}
              tempDescription={tempDescription}
              onEditingDescriptionChange={setEditingDescription}
              onTempDescriptionChange={setTempDescription}
              onSaveDescription={() => {
                updateTaskMutation.mutate({
                  id: taskId!,
                  rawDescription: tempDescription
                });
              }}
              onSaveRefinedTitle={async (newValue: string) => {
                return new Promise<void>((resolve, reject) => {
                  updateTaskMutation.mutate({
                    id: taskId!,
                    refinedTitle: newValue
                  }, {
                    onSuccess: () => resolve(),
                    onError: (error) => reject(error)
                  });
                });
              }}
              onSaveRefinedDescription={async (newValue: string) => {
                return new Promise<void>((resolve, reject) => {
                  updateTaskMutation.mutate({
                    id: taskId!,
                    refinedDescription: newValue
                  }, {
                    onSuccess: () => resolve(),
                    onError: (error) => reject(error)
                  });
                });
              }}
              onSavePlan={async (newValue: string) => {
                return new Promise<void>((resolve, reject) => {
                  let planValue;
                  try {
                    planValue = JSON.parse(newValue);
                  } catch {
                    planValue = newValue;
                  }

                  updateTaskMutation.mutate({
                    id: taskId!,
                    plan: planValue
                  }, {
                    onSuccess: () => resolve(),
                    onError: (error) => reject(error)
                  });
                });
              }}
              onListChange={(list: string) => {
                updateTaskMutation.mutate({
                  id: taskId!,
                  list: list as 'todo' | 'doing' | 'done'
                });
              }}
              onPriorityChange={(priority: string) => {
                updateTaskMutation.mutate({
                  id: taskId!,
                  priority: parseInt(priority) as any
                });
              }}
              onModeChange={(mode: string | null) => {
                updateTaskMutation.mutate({
                  id: taskId!,
                  mode: mode as "execute" | "plan" | "clarify" | undefined
                });
              }}
              onMainRepositoryChange={(repositoryId: string) => {
                updateTaskMutation.mutate({
                  id: taskId!,
                  mainRepositoryId: repositoryId
                });
              }}
              onAdditionalRepositoriesChange={(repositoryIds: string[]) => {
                updateTaskMutation.mutate({
                  id: taskId!,
                  additionalRepositoryIds: repositoryIds
                });
              }}
              onAssignedAgentsChange={(agentIds: string[]) => {
                updateTaskMutation.mutate({
                  id: taskId!,
                  assignedAgentIds: agentIds
                });
              }}
              onActorChange={(actorId: string) => {
                updateTaskMutation.mutate({
                  id: taskId!,
                  actorId: actorId || undefined
                });
              }}
              onDependencySelectionChange={(selectedIds: string[]) => {
                // Handle dependency changes - implementation similar to TaskPopup
              }}
              onDeleteAttachment={(attachmentId: string) => {
                deleteAttachmentMutation.mutate({
                  taskId: task.id,
                  attachmentId
                });
              }}
              onDeleteTask={handleDeleteTask}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
