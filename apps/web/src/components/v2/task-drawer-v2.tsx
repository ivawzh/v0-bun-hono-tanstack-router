/**
 * V2 Task Drawer Component
 * Enhanced with separate repository and agent management for V2 architecture
 */

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  MoreVertical,
  Edit3,
  Trash2,
  FolderOpen,
  Bot,
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { getPriorityColors, getPriorityDisplay, type Priority } from "@/utils/priority";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCacheUtils } from "@/hooks/use-cache-utils";
import { AIActivityBadge } from "@/components/ai-activity-badge";
import { TaskContent } from "./task-content";
import type { TaskV2, DependencyData, Repository, Agent, Actor } from "@/types/task";


interface TaskDrawerV2Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function TaskDrawerV2({ taskId, open, onOpenChange }: TaskDrawerV2Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [tempDescription, setTempDescription] = useState("");

  const queryClient = useQueryClient();
  const cache = useCacheUtils();

  // Fetch task details using oRPC
  const { data: rawTask, isLoading } = useQuery(
    orpc.tasks.get.queryOptions({
      input: { id: taskId! },
      enabled: !!taskId
    })
  );

  // Transform null to undefined for TypeScript compatibility
  const task = rawTask as TaskV2;

  // Fetch available repositories
  const { data: repositories = [] } = useQuery(
    orpc.repositories.list.queryOptions({
      input: { projectId: task?.projectId || '' },
      enabled: !!task?.projectId
    })
  );

  // Fetch available agents
  const { data: agents = [] } = useQuery(
    orpc.agents.list.queryOptions({
      input: { projectId: task?.projectId || '', includeTaskCounts: false },
      enabled: open && !!task?.projectId
    })
  );

  // Fetch available actors using oRPC
  const { data: actors = [] } = useQuery(
    orpc.actors.list.queryOptions({
      input: { projectId: task?.projectId || '' },
      enabled: !!task?.projectId
    })
  );

  // Fetch task dependencies
  const { data: rawDependencyData } = useQuery(
    orpc.tasks.getDependencies.queryOptions({
      input: { taskId: taskId! },
      enabled: !!taskId
    })
  );

  // Transform dependency data for TypeScript compatibility
  const dependencyData = rawDependencyData as DependencyData;

  // Fetch available tasks for dependency selection
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
  const availableTasks = rawAvailableTasks as TaskV2[];

  // Update task mutation using oRPC
  const updateTaskMutation = useMutation(orpc.tasks.update.mutationOptions({
    onSuccess: () => {
      toast.success("Task updated successfully");
      setEditingTitle(false);
      setEditingDescription(false);
      // Use standardized project invalidation for immediate UI updates
      if (task?.projectId) {
        cache.invalidateProject(task.projectId);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to update task: ${error.message}`);
    }
  }));

  // Add dependency mutation
  const addDependencyMutation = useMutation(orpc.tasks.addDependency.mutationOptions({
    onSuccess: () => {
      toast.success("Dependency added successfully");
      if (task?.projectId) {
        cache.invalidateProject(task.projectId);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to add dependency: ${error.message}`);
    }
  }));

  // Remove dependency mutation
  const removeDependencyMutation = useMutation(orpc.tasks.removeDependency.mutationOptions({
    onSuccess: () => {
      toast.success("Dependency removed successfully");
      if (task?.projectId) {
        cache.invalidateProject(task.projectId);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to remove dependency: ${error.message}`);
    }
  }));

  // Delete task mutation using oRPC
  const deleteTaskMutation = useMutation(orpc.tasks.delete.mutationOptions({
    onSuccess: () => {
      toast.success("Task deleted successfully");
      onOpenChange(false);
      // Use standardized project task invalidation
      if (task?.projectId) {
        cache.invalidateProject(task.projectId);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to delete task: ${error.message}`);
    }
  }));

  // Delete attachment mutation using oRPC
  const deleteAttachmentMutation = useMutation(orpc.tasks.deleteAttachment.mutationOptions({
    onMutate: async (variables) => {
      if (!task) return null

      // Optimistically remove attachment from task data
      const taskQuery = cache.queryKeys.tasks.detail(task.id)
      const currentTaskData = cache.getCachedData(taskQuery)

      if (currentTaskData && (currentTaskData as any).attachments) {
        const updatedTask = {
          ...currentTaskData,
          attachments: (currentTaskData as any).attachments.filter(
            (att: any) => att.id !== variables.attachmentId
          )
        }
        cache.setCachedData(taskQuery, updatedTask)

        return { previousData: currentTaskData, queryKey: taskQuery }
      }

      return null
    },
    onSuccess: async () => {
      toast.success("Attachment deleted successfully");
      // Use comprehensive cache invalidation for immediate UI updates
      if (task?.id && task?.projectId) {
        await Promise.all([
          cache.invalidateAttachments(task.id, task.projectId),
          cache.invalidateTask(task.id, task.projectId),
          cache.invalidateProject(task.projectId)
        ]);
      }
    },
    onError: (error: any, variables, context) => {
      toast.error(`Failed to delete attachment: ${error.message}`);

      // Rollback optimistic update
      if (context?.previousData && context?.queryKey) {
        cache.setCachedData(context.queryKey, context.previousData)
      }
    }
  }));

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

  const handleSaveDescription = () => {
    updateTaskMutation.mutate({
      id: taskId!,
      rawDescription: tempDescription
    });
  };

  const handleColumnChange = (list: string) => {
    updateTaskMutation.mutate({
      id: taskId!,
      column: column as 'todo' | 'doing' | 'done'
    });
  };

  const handlePriorityChange = (priority: string) => {
    updateTaskMutation.mutate({
      id: taskId!,
      priority: parseInt(priority) as Priority
    });
  };

  const handleModeChange = (mode: string | null) => {
    updateTaskMutation.mutate({
      id: taskId!,
      mode: mode as "execute" | "plan" | "clarify" | undefined
    });
  };

  const handleDeleteTask = () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate({ id: taskId! });
    }
  };

  const handleSaveRefinedTitle = async (newValue: string) => {
    return new Promise<void>((resolve, reject) => {
      updateTaskMutation.mutate({
        id: taskId!,
        refinedTitle: newValue
      }, {
        onSuccess: () => resolve(),
        onError: (error) => reject(error)
      });
    });
  };

  const handleSaveRefinedDescription = async (newValue: string) => {
    return new Promise<void>((resolve, reject) => {
      updateTaskMutation.mutate({
        id: taskId!,
        refinedDescription: newValue
      }, {
        onSuccess: () => resolve(),
        onError: (error) => reject(error)
      });
    });
  };

  const handleSavePlan = async (newValue: string) => {
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
  };

  const handleAddDependency = (dependsOnTaskId: string) => {
    addDependencyMutation.mutate({
      taskId: taskId!,
      dependsOnTaskId
    });
  };

  const handleRemoveDependency = (dependsOnTaskId: string) => {
    removeDependencyMutation.mutate({
      taskId: taskId!,
      dependsOnTaskId
    });
  };

  const handleDependencySelectionChange = (selectedIds: string[]) => {
    const currentDependencyIds = dependencyData?.dependencies?.map((d: any) => d.id) || [];

    // Find dependencies to add
    const toAdd = selectedIds.filter((id: string) => !currentDependencyIds.includes(id));
    // Find dependencies to remove
    const toRemove = currentDependencyIds.filter((id: string) => !selectedIds.includes(id));

    // Add new dependencies
    toAdd.forEach((id: string) => handleAddDependency(id));
    // Remove removed dependencies
    toRemove.forEach((id: string) => handleRemoveDependency(id));
  };

  // V2 specific handlers
  const handleMainRepositoryChange = (repositoryId: string) => {
    updateTaskMutation.mutate({
      id: taskId!,
      mainRepositoryId: repositoryId
    });
  };

  const handleAdditionalRepositoriesChange = (repositoryIds: string[]) => {
    updateTaskMutation.mutate({
      id: taskId!,
      additionalRepositoryIds: repositoryIds
    });
  };

  const handleAssignedAgentsChange = (agentIds: string[]) => {
    updateTaskMutation.mutate({
      id: taskId!,
      assignedAgentIds: agentIds
    });
  };

  const handleActorChange = (actorId: string) => {
    updateTaskMutation.mutate({
      id: taskId!,
      actorId: actorId || undefined
    });
  };

  if (!taskId) return null;

  // Mode options for header display
  const modeOptions = [
    { value: "clarify", label: "Clarify", color: "bg-purple-100 text-purple-800 border-purple-200" },
    { value: "plan", label: "Plan", color: "bg-pink-100 text-pink-800 border-pink-200" },
    { value: "execute", label: "Execute", color: "bg-blue-100 text-blue-800 border-blue-200" },
  ];

  const currentMode = modeOptions.find(s => s.value === task?.mode);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[85vw] max-w-[400px] h-full sm:w-[40vw] sm:min-w-[500px] sm:max-w-[800px] sm:h-auto p-0 sm:max-h-[90vh]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading task details...</div>
          </div>
        ) : task ? (
          <div className="flex flex-col h-full">
            {/* Fixed Header */}
            <div className="flex-shrink-0 p-4 sm:p-6 border-b bg-background">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant="outline" className={getPriorityColors(task.priority)}>
                      {getPriorityDisplay(task.priority)}
                    </Badge>
                    <AIActivityBadge
                      ready={task.ready}
                      agentSessionStatus={task.agentSessionStatus as "INACTIVE" | "PUSHING" | "ACTIVE" | null | undefined}
                      column={task.column}
                    />
                    {currentMode && (
                      <Badge variant="outline" className={currentMode.color}>
                        {currentMode.label}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-2">
                      TASK-{task.id.slice(0, 8)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8 ml-auto min-h-[44px] min-w-[44px] touch-manipulation">
                          <MoreVertical className="h-5 w-5 sm:h-4 sm:w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDeleteTask} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Title */}
                  {editingTitle ? (
                    <div className="space-y-2">
                      <Input
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveTitle();
                          } else if (e.key === 'Escape') {
                            setEditingTitle(false);
                          }
                        }}
                        style={{ fontSize: '16px' }}
                        className="text-lg font-semibold h-11 min-h-[44px] touch-manipulation"
                        autoFocus
                      />
                      <div className="flex gap-2 flex-col sm:flex-row">
                        <Button size="sm" onClick={handleSaveTitle} className="h-11 text-sm min-h-[44px] touch-manipulation">
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTitle(false)} className="h-11 text-sm min-h-[44px] touch-manipulation">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold flex-1">
                        {task.refinedTitle || task.rawTitle}
                      </h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-11 w-11 sm:h-auto sm:w-auto p-1 sm:p-2 min-h-[44px] min-w-[44px] touch-manipulation"
                        onClick={() => {
                          setTempTitle(task.rawTitle);
                          setEditingTitle(true);
                        }}
                      >
                        <Edit3 className="h-5 w-5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* V2 Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Main Repository</Label>
                  <p className="font-medium flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />
                    {task.mainRepository?.name || "Not set"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Assigned Agents</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    {task.assignedAgents?.length || 0} agent(s)
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Actor</Label>
                  <p className="font-medium">{task.actor?.name || "Default"}</p>
                </div>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-hidden">
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
                onSaveDescription={handleSaveDescription}
                onSaveRefinedTitle={handleSaveRefinedTitle}
                onSaveRefinedDescription={handleSaveRefinedDescription}
                onSavePlan={handleSavePlan}
                onColumnChange={handleColumnChange}
                onPriorityChange={handlePriorityChange}
                onModeChange={handleModeChange}
                onMainRepositoryChange={handleMainRepositoryChange}
                onAdditionalRepositoriesChange={handleAdditionalRepositoriesChange}
                onAssignedAgentsChange={handleAssignedAgentsChange}
                onActorChange={handleActorChange}
                onDependencySelectionChange={handleDependencySelectionChange}
                onDeleteAttachment={(attachmentId) => {
                  deleteAttachmentMutation.mutate({
                    taskId: task.id,
                    attachmentId
                  });
                }}
                onDeleteTask={handleDeleteTask}
              />
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground p-6">Task not found</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
