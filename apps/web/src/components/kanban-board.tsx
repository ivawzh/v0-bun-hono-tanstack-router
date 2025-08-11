import { useState } from "react";
import { 
  Plus, MoreHorizontal, Clock, Play, CheckCircle, Pause, 
  AlertTriangle, Paperclip, MessageSquare, HelpCircle, 
  ExternalLink, User, Bot, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TaskDetail } from "./task-detail";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface KanbanBoardProps {
  boardId: string;
}

// Updated column structure based on requirements
const statusColumns = [
  { id: "todo", label: "Todo", icon: Clock, color: "bg-slate-500" },
  { id: "in_progress", label: "In Progress", icon: Play, color: "bg-blue-500" },
  { id: "qa", label: "QA", icon: CheckCircle, color: "bg-purple-500" },
  { id: "done", label: "Done", icon: CheckCircle, color: "bg-green-500" },
];

// Optional collapsed column
const pausedColumn = { id: "paused", label: "Paused", icon: Pause, color: "bg-yellow-500" };

const stageColors = {
  kickoff: "bg-purple-100 text-purple-800 border-purple-200",
  spec: "bg-pink-100 text-pink-800 border-pink-200",
  design: "bg-indigo-100 text-indigo-800 border-indigo-200",
  dev: "bg-blue-100 text-blue-800 border-blue-200",
  qa: "bg-orange-100 text-orange-800 border-orange-200",
  done: "bg-green-100 text-green-800 border-green-200",
};

const priorityColors = {
  1: "bg-red-100 text-red-800 border-red-200",
  2: "bg-orange-100 text-orange-800 border-orange-200",
  3: "bg-yellow-100 text-yellow-800 border-yellow-200",
  4: "bg-blue-100 text-blue-800 border-blue-200",
  5: "bg-gray-100 text-gray-800 border-gray-200",
};

export function KanbanBoard({ boardId }: KanbanBoardProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showPausedColumn, setShowPausedColumn] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState<string>("todo");
  const [newTask, setNewTask] = useState({
    title: "",
    bodyMd: "",
    stage: "kickoff",
    priority: 0,
    qaRequired: false,
    agentReady: false,
  });

  const { data: boardData, isLoading, refetch } = useQuery(
    orpc.boards.getWithTasks.queryOptions({ input: { id: boardId } })
  );
  
  const { data: projectData } = useQuery(
    orpc.projects.get.queryOptions({ 
      input: { id: (boardData as any)?.projectId },
      enabled: !!(boardData as any)?.projectId 
    })
  );
  
  const createTask = useMutation(
    orpc.tasks.create.mutationOptions({
      onSuccess: () => {
        toast.success("Task created successfully");
        setShowNewTaskDialog(false);
        setNewTask({ title: "", bodyMd: "", stage: "kickoff", priority: 0, qaRequired: false, agentReady: false });
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to create task: ${error.message}`);
      },
    })
  );
  
  const updateTask = useMutation(
    orpc.tasks.update.mutationOptions({
      onSuccess: () => {
        toast.success("Task updated");
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to update task: ${error.message}`);
      },
    })
  );

  const toggleProjectAgentPause = useMutation(
    orpc.projects.update.mutationOptions({
      onSuccess: () => {
        toast.success(projectData?.agentPaused ? "Agents resumed" : "All agents paused");
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to update project: ${error.message}`);
      },
    })
  );

  // Get active columns (including paused if shown)
  const activeColumns = showPausedColumn ? [...statusColumns, pausedColumn] : statusColumns;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading board...</div>
      </div>
    );
  }

  if (!boardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Board not found</div>
      </div>
    );
  }

  const tasksByStatus = activeColumns.reduce((acc, column) => {
    acc[column.id] = (boardData as any)?.tasks?.filter((task: any) => task.status === column.id) || [];
    return acc;
  }, {} as Record<string, any[]>);

  // Check if there are any paused tasks
  const pausedTaskCount = (boardData as any)?.tasks?.filter((task: any) => task.status === "paused").length || 0;

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      const task = (boardData as any)?.tasks?.find((t: any) => t.id === taskId);
      
      // If moving to QA and qaRequired is false, ask for confirmation
      if (newStatus === "qa" && task && !task.qaRequired) {
        if (!confirm("This task doesn't require QA. Move to QA anyway?")) {
          return;
        }
      }
      
      updateTask.mutate({ id: taskId, status: newStatus as any });
    }
  };

  // Count online agents (mock data for now)
  const onlineAgents = 2;
  const runningAgents = 1;

  return (
    <div className="h-full flex flex-col">
      {/* Header with project controls */}
      <div className="mb-4 flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">{(boardData as any)?.name}</h2>
          {(boardData as any)?.purpose && (
            <p className="text-muted-foreground">{(boardData as any)?.purpose}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Agent status */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span>Agents: {onlineAgents} online • Running {runningAgents}</span>
          </div>
          
          {/* Pause All Agents button */}
          <Button
            variant={projectData?.agentPaused ? "destructive" : "outline"}
            size="sm"
            onClick={() => {
              if (projectData?.id) {
                toggleProjectAgentPause.mutate({
                  id: projectData.id,
                  agentPaused: !projectData.agentPaused,
                } as any);
              }
            }}
          >
            {projectData?.agentPaused ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume All Agents
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause All Agents
              </>
            )}
          </Button>

          {/* Toggle paused column */}
          {pausedTaskCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPausedColumn(!showPausedColumn)}
            >
              <ChevronRight className={cn("h-4 w-4 mr-1 transition-transform", showPausedColumn && "rotate-90")} />
              Paused ({pausedTaskCount})
            </Button>
          )}
        </div>
      </div>

      {/* Kanban columns - with horizontal scroll on mobile */}
      <ScrollArea className="flex-1">
        <div className={cn(
          "grid gap-4 h-[calc(100vh-12rem)] min-w-full",
          activeColumns.length === 4 ? "grid-cols-4" : "grid-cols-5",
          "md:grid-cols-" + activeColumns.length
        )}>
          {activeColumns.map((column) => (
            <div
              key={column.id}
              className="flex flex-col min-w-[280px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", column.color)} />
                  <h3 className="font-semibold">{column.label}</h3>
                  <span className="text-sm text-muted-foreground">
                    ({tasksByStatus[column.id]?.length || 0})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setNewTaskColumn(column.id);
                    setShowNewTaskDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-3">
                  {tasksByStatus[column.id]?.map((task: any) => (
                    <Card
                      key={task.id}
                      className="cursor-pointer hover:shadow-md transition-shadow group"
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-sm font-medium line-clamp-2 pr-2">
                            {task.title}
                          </CardTitle>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTask.mutate({
                                    id: task.id,
                                    isBlocked: !task.isBlocked,
                                  } as any);
                                }}
                              >
                                {task.isBlocked ? "Unblock" : "Mark as Blocked"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTask.mutate({
                                    id: task.id,
                                    status: task.status === "paused" ? "in_progress" : "paused",
                                  } as any);
                                }}
                              >
                                {task.status === "paused" ? "Resume" : "Pause"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskId(task.id);
                                }}
                              >
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        {/* Priority, Stage, and Assignee */}
                        <div className="flex items-center gap-2 mb-2">
                          {task.priority > 0 && (
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs border", 
                                task.priority <= 2 ? priorityColors[1] :
                                task.priority <= 4 ? priorityColors[2] :
                                task.priority <= 6 ? priorityColors[3] :
                                task.priority <= 8 ? priorityColors[4] :
                                priorityColors[5]
                              )}
                            >
                              P{task.priority}
                            </Badge>
                          )}
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs border", stageColors[task.stage as keyof typeof stageColors])}
                          >
                            {task.stage}
                          </Badge>
                        </div>

                        {/* Assignee */}
                        {(task.assignedActorType || task.assignedAgentId) && (
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px]">
                                {task.assignedActorType === "agent" ? "AI" : "H"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {task.assignedActorType === "agent" ? "Agent" : "Human"}
                            </span>
                          </div>
                        )}

                        {/* Agent controls */}
                        {task.assignedActorType === "agent" && (
                          <div className="flex items-center gap-2 mb-2 text-xs">
                            <div className="flex items-center gap-1">
                              <Switch 
                                checked={task.agentReady} 
                                className="scale-75"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  updateTask.mutate({
                                    id: task.id,
                                    agentReady: !task.agentReady,
                                  } as any);
                                }}
                              />
                              <span className="text-muted-foreground">Auto-Start</span>
                            </div>
                            {task.agentPaused && (
                              <Badge variant="outline" className="text-xs bg-yellow-50">
                                <Pause className="h-3 w-3 mr-1" />
                                Agent Paused
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Badges for blocked, attachments, comments, questions */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {task.isBlocked && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-1 text-red-600">
                                    <AlertTriangle className="h-3 w-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Blocked</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {task.attachmentCount > 0 && (
                            <div className="flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              <span>{task.attachmentCount}</span>
                            </div>
                          )}
                          
                          {task.messageCount > 0 && (
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              <span>{task.messageCount}</span>
                            </div>
                          )}
                          
                          {task.questionCount > 0 && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <HelpCircle className="h-3 w-3" />
                              <span>{task.questionCount}</span>
                            </div>
                          )}

                          {task.qaRequired && (
                            <Badge variant="outline" className="text-xs">
                              QA Required
                            </Badge>
                          )}
                        </div>

                        {/* Claude Code session link */}
                        {task.activeSessionId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`http://172.22.208.25:8888/session/${task.activeSessionId}`, "_blank");
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open in Claude Code
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Task Detail Drawer */}
      <TaskDetail
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
      />

      {/* New Task Dialog */}
      <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to the {activeColumns.find(c => c.id === newTaskColumn)?.label} column
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Task description (optional)"
                value={newTask.bodyMd}
                onChange={(e) => setNewTask({ ...newTask, bodyMd: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-stage">Stage</Label>
                <Select
                  value={newTask.stage}
                  onValueChange={(value) => setNewTask({ ...newTask, stage: value })}
                >
                  <SelectTrigger id="task-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kickoff">Kickoff</SelectItem>
                    <SelectItem value="spec">Specification</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="dev">Development</SelectItem>
                    <SelectItem value="qa">QA</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority (0-10)</Label>
                <Input
                  id="task-priority"
                  type="number"
                  min="0"
                  max="10"
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="qa-required"
                  checked={newTask.qaRequired}
                  onCheckedChange={(checked: boolean) => setNewTask({ ...newTask, qaRequired: checked })}
                />
                <Label htmlFor="qa-required">QA Required</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="agent-ready"
                  checked={newTask.agentReady}
                  onCheckedChange={(checked: boolean) => setNewTask({ ...newTask, agentReady: checked })}
                />
                <Label htmlFor="agent-ready">Auto-Start Agent</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTaskDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newTask.title) {
                  createTask.mutate({
                    boardId,
                    title: newTask.title,
                    bodyMd: newTask.bodyMd || undefined,
                    status: newTaskColumn as any,
                    stage: newTask.stage as any,
                    priority: newTask.priority,
                    metadata: {
                      qaRequired: newTask.qaRequired,
                      agentReady: newTask.agentReady,
                    },
                  } as any);
                }
              }}
              disabled={!newTask.title || createTask.isPending}
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}