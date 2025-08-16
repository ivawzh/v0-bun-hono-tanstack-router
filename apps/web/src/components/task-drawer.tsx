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
        queryClient.invalidateQueries({
          queryKey: ["projects", "getWithTasks"]
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
      onSuccess: () => {
        toast.success("Task deleted successfully");
        onOpenChange(false);
        queryClient.invalidateQueries({
          queryKey: ["projects", "getWithTasks"]
        });
      },
      onError: (error) => {
        toast.error("Failed to delete task: " + error.message);
      }
    })
  );

  // Update stage mutation
  const updateStageMutation = useMutation(
    orpc.tasks.updateStage.mutationOptions({
      onSuccess: () => {
        toast.success("Task stage updated successfully");
        queryClient.invalidateQueries({
          queryKey: ["projects", "getWithTasks"]
        });
      },
      onError: (error) => {
        toast.error("Failed to update task stage: " + error.message);
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

  if (!taskId) return null;

  const currentStatus = statusOptions.find(s => s.value === task?.status);
  const currentStage = stageOptions.find(s => s.value === task?.stage);
  const StatusIcon = currentStatus?.icon || Clock;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[40vw] sm:min-w-[500px] sm:max-w-[800px] p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading task details...</div>
          </div>
        ) : task ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-3">
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
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto">
                          <MoreVertical className="h-4 w-4" />
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
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold flex-1">
                        {task.refinedTitle || task.rawTitle}
                      </h2>
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
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-3 gap-4 text-sm">
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

            {/* Content Tabs */}
            <Tabs defaultValue="overview" className="flex-1 flex flex-col">
              <TabsList className="px-6 w-full justify-start rounded-none border-b h-12">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="plan">Plan</TabsTrigger>
                <TabsTrigger value="attachments">
                  Attachments
                  {task.attachments && task.attachments.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {task.attachments.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <div className="p-6">
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
                            onClick={() => {
                              if (editingDescription) {
                                handleSaveDescription();
                              } else {
                                setTempDescription(task.rawDescription || "");
                                setEditingDescription(true);
                              }
                            }}
                          >
                            {editingDescription ? "Save" : <Edit3 className="h-4 w-4" />}
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
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveDescription}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingDescription(false)}>
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

                      {/* Refined Information (if available) */}
                      {(task.refinedTitle || task.refinedDescription) && (
                        <div>
                          <Label>Refined by AI</Label>
                          <Card className="mt-2">
                            <CardContent className="p-4">
                              {task.refinedTitle && task.refinedTitle !== task.rawTitle && (
                                <div className="mb-2">
                                  <Label className="text-xs text-muted-foreground">Refined Title</Label>
                                  <p className="font-medium">{task.refinedTitle}</p>
                                </div>
                              )}
                              {task.refinedDescription && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Refined Description</Label>
                                  <p className="text-sm whitespace-pre-wrap">{task.refinedDescription}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )}

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
                      {task.plan && Object.keys(task.plan).length > 0 ? (
                        <div>
                          <Label>Agent Plan</Label>
                          <Card className="mt-2">
                            <CardContent className="p-4">
                              <pre className="text-sm whitespace-pre-wrap font-mono">
                                {JSON.stringify(task.plan, null, 2)}
                              </pre>
                            </CardContent>
                          </Card>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No plan available yet</p>
                          <p className="text-xs mt-1">Plan will be generated when the AI agent picks up this task</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Attachments Tab */}
                  <TabsContent value="attachments" className="mt-0">
                    <AttachmentList
                      attachments={(task.attachments as any[]) || []}
                      showDelete={false}
                      compact={false}
                    />
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

                      <Separator />

                      <div className="pt-4">
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteTask}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Task
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        ) : (
          <div className="text-muted-foreground p-6">Task not found</div>
        )}
      </SheetContent>
    </Sheet>
  );
}