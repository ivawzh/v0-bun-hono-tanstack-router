/**
 * TaskPopup Component
 * Mobile-optimized task modal using Dialog primitive for better mobile UX
 * Full-screen modal on mobile (< 768px), centered modal on desktop
 * Maintains complete feature parity with TaskDrawerV2
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  MoreVertical,
  Edit3,
  Trash2,
  FolderOpen,
  Bot,
  X,
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { getPriorityColors, getPriorityDisplay, type Priority } from "@/utils/priority";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCacheUtils } from "@/hooks/use-cache-utils";
import { AIActivityBadge } from "@/components/ai-activity-badge";
import { TaskContent } from "./task-content";
import { cn } from "@/lib/utils";

interface Repository {
  id: string;
  name: string;
  repoPath: string;
  isDefault?: boolean | null;
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number | null;
}

interface Agent {
  id: string;
  name: string;
  agentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE';
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number | null;
}

interface Actor {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean | null;
}

interface TaskV2 {
  id: string;
  projectId: string;
  rawTitle: string;
  rawDescription?: string;
  refinedTitle?: string;
  refinedDescription?: string;
  column: 'todo' | 'doing' | 'done';
  mode?: 'clarify' | 'plan' | 'execute';
  priority: number;
  ready: boolean;
  plan?: any;
  attachments?: any[];
  createdAt: string;
  agentSessionStatus?: 'INACTIVE' | 'PUSHING' | 'ACTIVE';

  // V2 specific fields
  mainRepositoryId: string;
  additionalRepositoryIds: string[];
  assignedAgentIds: string[];
  actorId?: string;

  // Populated relationships
  mainRepository?: Repository;
  additionalRepositories?: Repository[];
  assignedAgents?: Agent[];
  actor?: Actor;
  activeSession?: any;
  dependencies?: Array<{
    id: string;
    rawTitle: string;
    refinedTitle?: string;
    column: 'todo' | 'doing' | 'done' | 'loop';
    priority: number;
  }>;
}

interface TaskPopupProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskPopup({ taskId, open, onOpenChange }: TaskPopupProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [tempDescription, setTempDescription] = useState("");

  const queryClient = useQueryClient();
  const cache = useCacheUtils();

  // Fetch task details using oRPC
  const { data: task, isLoading } = useQuery(
    orpc.tasks.get.queryOptions({
      input: { id: taskId! },
      enabled: !!taskId
    })
  );

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
  const { data: dependencyData } = useQuery(
    orpc.tasks.getDependencies.queryOptions({
      input: { taskId: taskId! },
      enabled: !!taskId
    })
  );

  // Fetch available tasks for dependency selection
  const { data: availableTasks = [] } = useQuery(
    orpc.tasks.getAvailableDependencies.queryOptions({
      input: { 
        projectId: task?.projectId || '', 
        excludeTaskId: taskId || undefined 
      },
      enabled: !!task?.projectId && !!taskId
    })
  );

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

  const handleColumnChange = (column: string) => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          // Base styles
          "p-0 gap-0 rounded-lg border shadow-lg duration-200 flex flex-col",
          // Mobile: Full screen with minimal padding
          "max-md:fixed max-md:inset-2 max-md:w-auto max-md:h-auto max-md:max-w-none max-md:max-h-none max-md:translate-x-0 max-md:translate-y-0 max-md:top-2 max-md:left-2 max-md:right-2 max-md:bottom-2",
          // Desktop: Fixed height like Trello - 80% of viewport height
          "md:w-full md:max-w-4xl md:h-[80vh]"
        )}
        showCloseButton={false}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-muted-foreground">Loading task details...</div>
          </div>
        ) : task ? (
          <div className="flex flex-col h-full">
            {/* Mobile-optimized Header */}
            <div className="flex-shrink-0 p-4 md:p-6 border-b bg-background rounded-t-lg">
              {/* Header with close button */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
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
                  <span className="text-xs text-muted-foreground">
                    TASK-{task.id.slice(0, 8)}
                  </span>
                </div>
                
                {/* Mobile-friendly close and menu buttons */}
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDeleteTask} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Title Section */}
              <div className="mb-4">
                {editingTitle ? (
                  <div className="space-y-3">
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
                      className="text-lg font-semibold h-12 min-h-[48px] text-base"
                      style={{ fontSize: '16px' }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleSaveTitle} 
                        className="h-11 flex-1 min-h-[44px] touch-manipulation"
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setEditingTitle(false)} 
                        className="h-11 flex-1 min-h-[44px] touch-manipulation"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <DialogTitle className="text-lg md:text-xl font-semibold flex-1 leading-tight">
                      {task.refinedTitle || task.rawTitle}
                    </DialogTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 w-11 p-0 min-h-[44px] min-w-[44px] touch-manipulation flex-shrink-0"
                      onClick={() => {
                        setTempTitle(task.rawTitle);
                        setEditingTitle(true);
                      }}
                    >
                      <Edit3 className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Mobile-optimized Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Main Repository</Label>
                    <p className="font-medium text-sm">
                      {task.mainRepository?.name || "Not set"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Agents</Label>
                    <p className="font-medium text-sm">
                      {task.assignedAgents?.length || 0} agent(s)
                    </p>
                  </div>
                </div>
                <div className="md:col-span-1">
                  <Label className="text-xs text-muted-foreground">Actor</Label>
                  <p className="font-medium text-sm">{task.actor?.name || "Default"}</p>
                </div>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
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
      </DialogContent>
    </Dialog>
  );
}