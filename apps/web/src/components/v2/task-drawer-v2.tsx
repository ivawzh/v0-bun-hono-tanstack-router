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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  CheckSquare,
  Play,
  Pause,
  Clock,
  CheckCircle,
  AlertTriangle,
  MoreVertical,
  Edit3,
  Trash2,
  ExternalLink,
  Paperclip,
  Bot,
  User,
  FolderOpen,
  Settings2,
  GitBranch,
  Lock,
  Plus,
  X,
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { getPriorityColors, getPriorityDisplay, getPriorityOptions, type Priority } from "@/utils/priority";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCacheUtils } from "@/hooks/use-cache-utils";
import { cn } from "@/lib/utils";
import { TaskStageSelector } from "@/components/task-stage-selector";
import { AIActivityBadge } from "@/components/ai-activity-badge";
import { AttachmentList } from "@/components/attachment-list";
import { EditableField } from "@/components/editable-field";
import { ClaudeCodeSessionLink } from "@/components/claude-code-session-link";
import { TaskAttachmentUpload } from "@/components/task-attachment-upload";
import { MultiSelectAgents } from "./multi-select-agents";
import { MultiSelectRepositories } from "./multi-select-repositories";
import { TaskDependencySelector } from "./task-dependency-selector";
import { TaskDependencyGraph } from "./task-dependency-graph";

interface Repository {
  id: string;
  name: string;
  repoPath: string;
  isDefault?: boolean;
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number;
}

interface Agent {
  id: string;
  name: string;
  agentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE';
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number;
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
  status: 'todo' | 'doing' | 'done';
  stage?: 'clarify' | 'plan' | 'execute';
  priority: number;
  ready: boolean;
  plan?: any;
  attachments?: any[];
  createdAt: string;
  agentSessionStatus?: 'NON_ACTIVE' | 'PUSHING' | 'ACTIVE';

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
    status: 'todo' | 'doing' | 'done' | 'loop';
    priority: number;
  }>;
}

interface TaskDrawerV2Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "todo", label: "Todo", icon: Clock, color: "bg-slate-500" },
  { value: "doing", label: "Doing", icon: Play, color: "bg-blue-500" },
  { value: "done", label: "Done", icon: CheckCircle, color: "bg-green-500" },
];

const stageOptions = [
  { value: "clarify", label: "clarify", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "plan", label: "Plan", color: "bg-pink-100 text-pink-800 border-pink-200" },
  { value: "execute", label: "Execute", color: "bg-blue-100 text-blue-800 border-blue-200" },
];

export function TaskDrawerV2({ taskId, open, onOpenChange }: TaskDrawerV2Props) {
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

  const handleStatusChange = (status: string) => {
    updateTaskMutation.mutate({
      id: taskId!,
      status: status as 'todo' | 'doing' | 'done'
    });
  };

  const handlePriorityChange = (priority: string) => {
    updateTaskMutation.mutate({
      id: taskId!,
      priority: parseInt(priority) as Priority
    });
  };

  const handleStageChange = (stage: string | null) => {
    updateTaskMutation.mutate({
      id: taskId!,
      stage: stage as "execute" | "plan" | "clarify" | undefined
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
    const currentDependencyIds = dependencyData?.dependencies?.map(d => d.id) || [];
    
    // Find dependencies to add
    const toAdd = selectedIds.filter(id => !currentDependencyIds.includes(id));
    // Find dependencies to remove
    const toRemove = currentDependencyIds.filter(id => !selectedIds.includes(id));

    // Add new dependencies
    toAdd.forEach(id => handleAddDependency(id));
    // Remove removed dependencies
    toRemove.forEach(id => handleRemoveDependency(id));
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

  const currentStatus = statusOptions.find(s => s.value === task?.status);
  const currentStage = stageOptions.find(s => s.value === task?.stage);
  const StatusIcon = currentStatus?.icon || Clock;

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
                      agentSessionStatus={task.agentSessionStatus as "NON_ACTIVE" | "PUSHING" | "ACTIVE" | null | undefined}
                      status={task.status}
                    />
                    {currentStage && (
                      <Badge variant="outline" className={currentStage.color}>
                        {currentStage.label}
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
              <Tabs defaultValue="overview" className="flex flex-col h-full">
                <div className="flex-shrink-0">
                  <TabsList className="px-4 sm:px-6 w-full justify-start rounded-none border-b h-10 sm:h-12">
                    <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3">Overview</TabsTrigger>
                    <TabsTrigger value="dependencies" className="text-xs sm:text-sm px-2 sm:px-3">
                      <GitBranch className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Dependencies</span>
                      <span className="sm:hidden">Deps</span>
                      {dependencyData?.dependencies && dependencyData.dependencies.length > 0 && (
                        <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                          {dependencyData.dependencies.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="plan" className="text-xs sm:text-sm px-2 sm:px-3">Plan</TabsTrigger>
                    <TabsTrigger value="attachments" className="text-xs sm:text-sm px-2 sm:px-3">
                      <span className="hidden sm:inline">Attachments</span>
                      <span className="sm:hidden">Files</span>
                      {(() => {
                        const attachments = task.attachments as any[];
                        return attachments && Array.isArray(attachments) && attachments.length > 0 ? (
                          <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                            {attachments.length}
                          </Badge>
                        ) : null;
                      })()}
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="text-xs sm:text-sm px-2 sm:px-3">
                      <Settings2 className="h-3 w-3 mr-1" />
                      Settings
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 sm:p-6">
                    {/* Overview Tab */}
                    <TabsContent value="overview" className="mt-0">
                      <div className="space-y-6">
                        {/* Raw Description */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>Description</Label>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-auto p-2"
                              onClick={() => {
                                if (editingDescription) {
                                  handleSaveDescription();
                                } else {
                                  setTempDescription(task.rawDescription || "");
                                  setEditingDescription(true);
                                }
                              }}
                            >
                              {editingDescription ? "Save" : <Edit3 className="h-5 w-5 sm:h-4 sm:w-4" />}
                            </Button>
                          </div>
                          {editingDescription ? (
                            <div className="space-y-2">
                              <Textarea
                                value={tempDescription}
                                onChange={(e) => setTempDescription(e.target.value)}
                                placeholder="Add a description..."
                                rows={6}
                              />
                              <div className="flex gap-2 flex-col sm:flex-row">
                                <Button size="sm" onClick={handleSaveDescription} className="h-9">
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingDescription(false)} className="h-9">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-muted/50 rounded-md min-h-[100px]">
                              <p className="text-sm whitespace-pre-wrap">
                                {task.rawDescription || "No description yet"}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Refined Information */}
                        <div>
                          <Label>Refined by AI</Label>
                          <Card className="mt-2">
                            <CardContent className="p-4 space-y-4">
                              <EditableField
                                type="input"
                                value={task.refinedTitle || ""}
                                onSave={handleSaveRefinedTitle}
                                label="Refined Title"
                                placeholder="AI will generate a refined title"
                                emptyText="Click to add a refined title"
                                maxLength={255}
                              />
                              <EditableField
                                type="textarea"
                                value={task.refinedDescription || ""}
                                onSave={handleSaveRefinedDescription}
                                label="Refined Description"
                                placeholder="AI will generate a refined description"
                                emptyText="Click to add a refined description"
                                rows={6}
                              />
                            </CardContent>
                          </Card>
                        </div>

                        {/* Creation Date */}
                        <div>
                          <Label>Created</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(task.createdAt), "PPP 'at' p")}
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Dependencies Tab */}
                    <TabsContent value="dependencies" className="mt-0">
                      <div className="space-y-6">
                        {/* Current Dependencies */}
                        {dependencyData?.dependencies && dependencyData.dependencies.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Current Dependencies ({dependencyData.dependencies.length})</Label>
                            <div className="mt-2 space-y-2">
                              {dependencyData.dependencies.map((dep) => {
                                const isCompleted = dep.status === 'done';
                                const isBlocking = !isCompleted;
                                
                                return (
                                  <Card key={dep.id} className={cn(
                                    "p-3",
                                    isCompleted ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                                  )}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {isBlocking ? (
                                          <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                                        ) : (
                                          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <p className="font-medium text-sm truncate">
                                            {dep.refinedTitle || dep.rawTitle}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                "text-xs",
                                                isCompleted 
                                                  ? "bg-green-100 text-green-700 border-green-300"
                                                  : "bg-amber-100 text-amber-700 border-amber-300"
                                              )}
                                            >
                                              {dep.status}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                              P{dep.priority}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleRemoveDependency(dep.id)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Blocked Status Warning */}
                        {dependencyData?.dependencies && dependencyData.dependencies.some(dep => dep.status !== 'done') && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-amber-700">
                              <Lock className="h-4 w-4" />
                              <span className="font-medium text-sm">Task is blocked</span>
                            </div>
                            <p className="text-xs text-amber-600 mt-1">
                              This task cannot start until all dependencies are completed
                            </p>
                          </div>
                        )}

                        {/* Add Dependencies */}
                        <div>
                          <Label className="text-sm font-medium">Manage Dependencies</Label>
                          <div className="mt-2">
                            <TaskDependencySelector
                              availableTasks={availableTasks}
                              selectedDependencyIds={dependencyData?.dependencies?.map(d => d.id) || []}
                              onSelectionChange={handleDependencySelectionChange}
                              placeholder="Select tasks that must be completed first..."
                              maxSelections={10}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Add or remove task dependencies. This task will be blocked until all dependencies are completed.
                          </p>
                        </div>

                        {/* Dependents */}
                        {dependencyData?.dependents && dependencyData.dependents.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Tasks Depending on This ({dependencyData.dependents.length})</Label>
                            <div className="mt-2 space-y-2">
                              {dependencyData.dependents.map((dependent) => (
                                <Card key={dependent.id} className="p-3 bg-blue-50 border-blue-200">
                                  <div className="flex items-center gap-2">
                                    <GitBranch className="h-4 w-4 text-blue-600 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm truncate">
                                        {dependent.refinedTitle || dependent.rawTitle}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                          {dependent.status}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          P{dependent.priority}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              These tasks are waiting for this task to be completed
                            </p>
                          </div>
                        )}

                        {/* Dependency Graph Visualization */}
                        {(dependencyData?.dependencies && dependencyData.dependencies.length > 0) ||
                         (dependencyData?.dependents && dependencyData.dependents.length > 0) ? (
                          <div>
                            <Label className="text-sm font-medium">Dependency Flow</Label>
                            <div className="mt-2 border rounded-lg p-4 bg-gray-50">
                              <TaskDependencyGraph
                                currentTask={{
                                  id: task.id,
                                  rawTitle: task.rawTitle,
                                  refinedTitle: task.refinedTitle,
                                  status: task.status as any,
                                  priority: task.priority
                                }}
                                dependencies={dependencyData?.dependencies}
                                dependents={dependencyData?.dependents}
                                onTaskClick={(taskId) => {
                                  // Could implement navigation to other tasks here
                                  console.log('Navigate to task:', taskId);
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          /* Empty State */
                          <div className="text-center py-8 text-muted-foreground">
                            <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No dependencies configured</p>
                            <p className="text-xs mt-1">Use the selector above to add task dependencies</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Plan Tab */}
                    <TabsContent value="plan" className="mt-0">
                      <div className="space-y-4">
                        <EditableField
                          type="textarea"
                          value={(() => {
                            if (!task.plan) return "";
                            if (typeof task.plan === 'string') return task.plan;
                            if (typeof task.plan === 'object') return JSON.stringify(task.plan, null, 2);
                            return String(task.plan);
                          })()}
                          onSave={handleSavePlan}
                          label="Agent Plan"
                          placeholder="AI will generate a plan when the task is picked up"
                          emptyText="Click to add a plan"
                          rows={12}
                          displayClassName="font-mono text-sm bg-muted/50"
                          editClassName="font-mono text-sm"
                        />
                      </div>
                    </TabsContent>

                    {/* Attachments Tab */}
                    <TabsContent value="attachments" className="mt-0">
                      <div className="space-y-6">
                        {/* Upload new attachments */}
                        <TaskAttachmentUpload taskId={task.id} projectId={task.projectId} />

                        {/* Existing attachments */}
                        <AttachmentList
                          attachments={Array.isArray(task.attachments) ? task.attachments : []}
                          taskId={task.id}
                          showDelete={true}
                          compact={false}
                          onDelete={(attachmentId) => {
                            deleteAttachmentMutation.mutate({
                              taskId: task.id,
                              attachmentId
                            });
                          }}
                        />
                      </div>
                    </TabsContent>

                    {/* V2 Enhanced Settings Tab */}
                    <TabsContent value="settings" className="mt-0">
                      <div className="space-y-6">
                        {/* Task Status and Priority */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Task Status</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label>Status</Label>
                                <Select value={task.status} onValueChange={handleStatusChange}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {statusOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Priority</Label>
                                <Select value={task.priority.toString()} onValueChange={handlePriorityChange}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getPriorityOptions().map((option) => (
                                      <SelectItem key={option.value} value={option.value.toString()}>
                                        {option.display}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {task.status === "doing" && (
                              <div>
                                <Label>Stage</Label>
                                <div className="mt-1">
                                  <TaskStageSelector
                                    stage={task.stage}
                                    status={task.status}
                                    onStageChange={handleStageChange}
                                    size="md"
                                  />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* V2 Repository Configuration */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <FolderOpen className="h-4 w-4" />
                              Repository Configuration
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <Label>Main Repository</Label>
                              <Select
                                value={task.mainRepositoryId || ""}
                                onValueChange={handleMainRepositoryChange}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select main repository" />
                                </SelectTrigger>
                                <SelectContent>
                                  {repositories.map((repo: any) => (
                                    <SelectItem key={repo.id} value={repo.id}>
                                      <div className="flex items-center gap-2">
                                        <FolderOpen className="h-3 w-3" />
                                        <span>{repo.name}</span>
                                        {repo.isDefault && (
                                          <Badge variant="outline" className="text-xs">Default</Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Primary working directory where agents will execute the task
                              </p>
                            </div>

                            <div>
                              <Label>Additional Repositories</Label>
                              <div className="mt-1">
                                <MultiSelectRepositories
                                  repositories={repositories.map(r => ({
                                    ...r,
                                    isDefault: r.isDefault ?? undefined,
                                    maxConcurrencyLimit: r.maxConcurrencyLimit ?? undefined,
                                  }))}
                                  selectedRepositoryIds={task.additionalRepositoryIds || []}
                                  mainRepositoryId={task.mainRepositoryId}
                                  onSelectionChange={handleAdditionalRepositoriesChange}
                                  placeholder="Select additional repositories..."
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* V2 Agent Assignment */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Bot className="h-4 w-4" />
                              Agent Assignment
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <Label>Assigned Agents</Label>
                              <div className="mt-1">
                                <MultiSelectAgents
                                  agents={agents.map(a => ({
                                    ...a,
                                    maxConcurrencyLimit: a.maxConcurrencyLimit ?? undefined,
                                  }))}
                                  selectedAgentIds={task.assignedAgentIds || []}
                                  onSelectionChange={handleAssignedAgentsChange}
                                  placeholder="Select agents to work on this task..."
                                />
                              </div>
                            </div>

                            <div>
                              <Label>Actor (Optional)</Label>
                              <Select
                                value={task.actorId || ""}
                                onValueChange={handleActorChange}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Use default actor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {actors.map((actor: Actor) => (
                                    <SelectItem key={actor.id} value={actor.id}>
                                      <div className="flex items-center gap-2">
                                        <User className="h-3 w-3" />
                                        <span>{actor.name}</span>
                                        {actor.isDefault && (
                                          <Badge variant="outline" className="text-xs">Default</Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Agent personality and methodology for this task
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Session Link */}
                        <div className="space-y-2">
                          <ClaudeCodeSessionLink
                            taskId={task.id}
                            activeSession={(task as any).activeSession}
                            repoAgentClientType={task.assignedAgents?.[0]?.agentType}
                          />
                        </div>

                        <Separator />

                        {/* Danger Zone */}
                        <div className="pt-4">
                          <Button
                            variant="destructive"
                            onClick={handleDeleteTask}
                            className="w-full h-11 min-h-[44px] touch-manipulation"
                          >
                            <Trash2 className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                            Delete Task
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </div>
              </Tabs>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground p-6">Task not found</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
