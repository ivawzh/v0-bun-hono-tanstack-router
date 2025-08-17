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
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { getPriorityColors, getPriorityDisplay, getPriorityOptions, type Priority } from "@/utils/priority";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TaskStageSelector } from "@/components/task-stage-selector";
import { AIActivityBadge } from "@/components/ai-activity-badge";
import { AttachmentList } from "@/components/attachment-list";
import { EditableField } from "@/components/editable-field";
import { ClaudeCodeSessionLink } from "@/components/claude-code-session-link";
import { TaskAttachmentUpload } from "@/components/task-attachment-upload";

interface TaskDrawerProps {
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
  { value: "refine", label: "Refine", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "plan", label: "Plan", color: "bg-pink-100 text-pink-800 border-pink-200" },
  { value: "execute", label: "Execute", color: "bg-blue-100 text-blue-800 border-blue-200" },
];

// Priority options and colors are now handled by the priority utility

export function TaskDrawer({ taskId, open, onOpenChange }: TaskDrawerProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [tempDescription, setTempDescription] = useState("");

  const queryClient = useQueryClient();

  // Fetch task details
  const { data: task, isLoading } = useQuery(
    orpc.tasks.get.queryOptions({
      input: { id: taskId! },
      enabled: !!taskId,
    })
  );

  // Update task mutation
  const updateTaskMutation = useMutation(
    orpc.tasks.update.mutationOptions({
      onSuccess: () => {
        toast.success("Task updated successfully");
        setEditingTitle(false);
        setEditingDescription(false);
        // Only invalidate specific project's data
        queryClient.invalidateQueries({
          queryKey: ["projects", "getWithTasks", { input: { id: task?.projectId } }],
          exact: true
        });
      },
      onError: (error) => {
        toast.error("Failed to update task: " + error.message);
      }
    })
  );

  // Delete task mutation
  const deleteTaskMutation = useMutation(
    orpc.tasks.delete.mutationOptions({
      onMutate: async (variables) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: ["projects", "getWithTasks", { input: { id: task?.projectId } }]
        });

        // Snapshot the previous value
        const previousData = queryClient.getQueryData(
          ["projects", "getWithTasks", { input: { id: task?.projectId } }]
        );

        // Optimistically remove the task from the UI
        if (previousData && task?.projectId) {
          queryClient.setQueryData(
            ["projects", "getWithTasks", { input: { id: task.projectId } }],
            (old: any) => {
              if (!old?.tasks) return old;
              
              // Remove the deleted task from the tasks array
              const updatedTasks = old.tasks.filter((t: any) => t.id !== variables.id);
              
              return { ...old, tasks: updatedTasks };
            }
          );
        }

        return { previousData };
      },
      onError: (error, variables, context) => {
        // Roll back on error
        if (context?.previousData && task?.projectId) {
          queryClient.setQueryData(
            ["projects", "getWithTasks", { input: { id: task.projectId } }],
            context.previousData
          );
        }
        toast.error("Failed to delete task: " + error.message);
      },
      onSuccess: () => {
        toast.success("Task deleted successfully");
        onOpenChange(false);
        console.log('✅ Task deleted successfully from drawer');
      }
    })
  );

  // Update stage mutation
  const updateStageMutation = useMutation(
    orpc.tasks.updateStage.mutationOptions({
      onSuccess: () => {
        toast.success("Task stage updated successfully");
        // Only invalidate specific project's data
        queryClient.invalidateQueries({
          queryKey: ["projects", "getWithTasks", { input: { id: task?.projectId } }],
          exact: true
        });
      },
      onError: (error) => {
        toast.error("Failed to update task stage: " + error.message);
      }
    })
  );

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation(
    orpc.tasks.deleteAttachment.mutationOptions({
      onSuccess: () => {
        toast.success("Attachment deleted successfully");
        queryClient.invalidateQueries({
          queryKey: ["projects", "getWithTasks", { input: { id: task?.projectId } }],
          exact: true
        });
      },
      onError: (error) => {
        toast.error("Failed to delete attachment: " + error.message);
      }
    })
  );

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
      status: status as any
    });
  };

  const handlePriorityChange = (priority: string) => {
    updateTaskMutation.mutate({
      id: taskId!,
      priority: parseInt(priority) as Priority
    });
  };

  const handleStageChange = (stage: string | null) => {
    updateStageMutation.mutate({
      id: taskId!,
      stage: stage as "refine" | "plan" | "execute" | null
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
        // Try to parse as JSON first
        planValue = JSON.parse(newValue);
      } catch {
        // If not valid JSON, store as string
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

  if (!taskId) return null;

  const currentStatus = statusOptions.find(s => s.value === task?.status);
  const currentStage = stageOptions.find(s => s.value === task?.stage);
  const StatusIcon = currentStatus?.icon || Clock;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full h-full sm:w-[40vw] sm:min-w-[500px] sm:max-w-[800px] sm:h-auto p-0 sm:max-h-[90vh]">
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
                      isAiWorking={task.isAiWorking}
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-6 sm:w-6 ml-auto">
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
                        className="text-lg font-semibold"
                        autoFocus
                      />
                      <div className="flex gap-2 flex-col sm:flex-row">
                        <Button size="sm" onClick={handleSaveTitle} className="h-9 text-sm">
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTitle(false)} className="h-9 text-sm">
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
                        className="h-8 w-8 sm:h-auto sm:w-auto p-1 sm:p-2"
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

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Repo Agent</Label>
                  <p className="font-medium">{task.repoAgent?.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Actor</Label>
                  <p className="font-medium">{task.actor?.name || "Default"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ready</Label>
                  <p className="font-medium">{task.ready ? "✓ Ready" : "⚪ Not Ready"}</p>
                </div>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="overview" className="flex flex-col h-full">
                <div className="flex-shrink-0">
                  <TabsList className="px-4 sm:px-6 w-full justify-start rounded-none border-b h-10 sm:h-12">
                    <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3">Overview</TabsTrigger>
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
                    <TabsTrigger value="settings" className="text-xs sm:text-sm px-2 sm:px-3">Settings</TabsTrigger>
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
                      <TaskAttachmentUpload taskId={task.id} />
                      
                      {/* Existing attachments */}
                      <AttachmentList
                        attachments={Array.isArray(task.attachments) ? task.attachments : []}
                        taskId={task.id}
                        showDelete={true}
                        compact={false}
                        onDelete={(attachmentId) => {
                          deleteAttachmentMutation.mutate({ taskId: task.id, attachmentId })
                        }}
                      />
                    </div>
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="mt-0">
                    <div className="space-y-4">
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

                      <div className="space-y-2">
                        <ClaudeCodeSessionLink
                          taskId={task.id}
                          activeSession={task.activeSession}
                          repoAgentClientType={task.repoAgent?.agentClient?.type}
                        />
                      </div>

                      <Separator />

                      <div className="pt-4">
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteTask}
                          className="w-full h-10"
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

            {/* Fixed Footer for Settings Tab Actions */}
            {(() => {
              // Only show fixed footer when on settings tab and there are critical actions
              return null; // For now, keeping it simple without fixed footer
            })()}
          </div>
        ) : (
          <div className="text-muted-foreground p-6">Task not found</div>
        )}
      </SheetContent>
    </Sheet>
  );
}