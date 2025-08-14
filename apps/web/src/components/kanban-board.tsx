import { useState, useEffect } from "react";
import {
  Plus, MoreHorizontal, Clock, Play, CheckCircle, Settings, AlertCircle
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
import { ProjectSettingsComprehensive } from "@/components/project-settings-comprehensive";

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
  kickoff: "bg-pink-100 text-pink-800 border-pink-200",
  execute: "bg-blue-100 text-blue-800 border-blue-200",
};

const priorityColors = {
  P1: "bg-red-100 text-red-800 border-red-200",
  P2: "bg-orange-100 text-orange-800 border-orange-200",
  P3: "bg-yellow-100 text-yellow-800 border-yellow-200",
  P4: "bg-blue-100 text-blue-800 border-blue-200",
  P5: "bg-gray-100 text-gray-800 border-gray-200",
};

export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskColumn, setNewTaskColumn] = useState<string>("todo");
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [newTask, setNewTask] = useState({
    rawTitle: "",
    rawDescription: "",
    priority: "P3" as keyof typeof priorityColors,
    repoAgentId: "",
    actorId: ""
  });

  const queryClient = useQueryClient();

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

  // Auto-select repo agent and actor when there's only one choice
  useEffect(() => {
    if (repoAgents?.length === 1 && !newTask.repoAgentId) {
      setNewTask(prev => ({ ...prev, repoAgentId: repoAgents[0].id }));
    }
  }, [repoAgents, newTask.repoAgentId]);

  useEffect(() => {
    if (actors && !newTask.actorId) {
      if (actors.length === 1) {
        // Auto-select if there's only one actor
        setNewTask(prev => ({ ...prev, actorId: actors[0].id }));
      } else {
        // Auto-select default actor if there's one
        const defaultActor = actors.find((actor: any) => actor.isDefault);
        if (defaultActor) {
          setNewTask(prev => ({ ...prev, actorId: defaultActor.id }));
        }
      }
    }
  }, [actors, newTask.actorId]);

  // Create task mutation
  const createTask = useMutation(
    orpc.tasks.create.mutationOptions({
      onSuccess: () => {
        toast.success("Task created successfully");
        setShowNewTaskDialog(false);
        setNewTask({
          rawTitle: "",
          rawDescription: "",
          priority: "P3",
          repoAgentId: "",
          actorId: ""
        });
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to create task: ${error.message}`);
      },
    })
  );

  // Update task mutation
  const updateTask = useMutation(
    orpc.tasks.update.mutationOptions({
      onSuccess: () => {
        toast.success("Task updated successfully");
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to update task: ${error.message}`);
      },
    })
  );

  // Toggle ready mutation
  const toggleReady = useMutation(
    orpc.tasks.toggleReady.mutationOptions({
      onSuccess: () => {
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to toggle ready status: ${error.message}`);
      },
    })
  );

  // Delete task mutation
  const deleteTask = useMutation(
    orpc.tasks.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Task deleted successfully");
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to delete task: ${error.message}`);
      },
    })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Project not found</div>
      </div>
    );
  }

  const tasks = project.tasks || [];
  const tasksByStatus = statusColumns.reduce((acc, column) => {
    acc[column.id] = tasks.filter((task: any) => task.status === column.id);
    return acc;
  }, {} as Record<string, any[]>);

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
    if (!taskId) return;

    const task = tasks.find((t: any) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    updateTask.mutate({
      id: taskId,
      status: newStatus as any,
      stage: newStatus === "doing" ? "refine" : undefined
    });
  };

  const defaultActor = actors?.find((actor: any) => actor.isDefault);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">{project.name}</h2>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProjectSettings(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Warning if no repo agents */}
      {(!repoAgents || repoAgents.length === 0) && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800">
              No repo agents configured. Tasks won't be able to run until you add at least one repo agent.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProjectSettings(true)}
            className="bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-800"
          >
            Configure Repo Agents
          </Button>
        </div>
      )}

      {/* Kanban columns */}
      <ScrollArea className="flex-1">
        <div className="grid gap-4 h-[calc(100vh-12rem)] min-w-full grid-cols-3">
          {statusColumns.map((column) => (
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
                      onDragOver={handleDragOver}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-sm font-medium line-clamp-2 pr-2">
                            {task.refinedTitle || task.rawTitle}
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
                                  toggleReady.mutate({
                                    id: task.id,
                                    ready: !task.ready
                                  });
                                }}
                              >
                                Mark as {task.ready ? "Not Ready" : "Ready"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this task?")) {
                                    deleteTask.mutate({ id: task.id });
                                  }
                                }}
                                className="text-red-600"
                              >
                                Delete Task
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        {/* Priority and Stage */}
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={cn("text-xs border", priorityColors[task.priority as keyof typeof priorityColors])}
                          >
                            {task.priority}
                          </Badge>
                          {task.stage && (
                            <Badge
                              variant="secondary"
                              className={cn("text-xs border", stageColors[task.stage as keyof typeof stageColors])}
                            >
                              {task.stage}
                            </Badge>
                          )}
                        </div>

                        {/* Ready status */}
                        <div className="flex items-center gap-2 mb-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={task.ready}
                              size="sm"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                toggleReady.mutate({
                                  id: task.id,
                                  ready: !task.ready
                                });
                              }}
                            />
                            <span className="text-muted-foreground">
                              {task.ready ? "Ready" : "Not Ready"}
                            </span>
                          </div>
                        </div>

                        {/* Repo Agent and Actor info */}
                        {task.repoAgent && (
                          <div className="text-xs text-muted-foreground mb-1">
                            Repo: {task.repoAgent.name}
                          </div>
                        )}
                        {task.actor && (
                          <div className="text-xs text-muted-foreground mb-1">
                            Actor: {task.actor.name}
                          </div>
                        )}

                        {/* Attachments count */}
                        {task.attachments && task.attachments.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {task.attachments.length} attachment(s)
                          </div>
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

      {/* New Task Dialog */}
      <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to the {statusColumns.find(c => c.id === newTaskColumn)?.label} column
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="Task title"
                value={newTask.rawTitle}
                onChange={(e) => setNewTask({ ...newTask, rawTitle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Task description (optional)"
                value={newTask.rawDescription}
                onChange={(e) => setNewTask({ ...newTask, rawDescription: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask({ ...newTask, priority: value as any })}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P1">P1 - Highest</SelectItem>
                    <SelectItem value="P2">P2 - High</SelectItem>
                    <SelectItem value="P3">P3 - Medium</SelectItem>
                    <SelectItem value="P4">P4 - Low</SelectItem>
                    <SelectItem value="P5">P5 - Lowest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-repo-agent">Repo Agent</Label>
                <Select
                  value={newTask.repoAgentId}
                  onValueChange={(value) => setNewTask({ ...newTask, repoAgentId: value })}
                >
                  <SelectTrigger id="task-repo-agent">
                    <SelectValue placeholder="Select repo agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {repoAgents?.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.clientType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-actor">Actor (Optional)</Label>
              <Select
                value={newTask.actorId}
                onValueChange={(value) => setNewTask({ ...newTask, actorId: value })}
              >
                <SelectTrigger id="task-actor">
                  <SelectValue placeholder="Select actor (or use default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Use default actor</SelectItem>
                  {actors?.map((actor: any) => (
                    <SelectItem key={actor.id} value={actor.id}>
                      {actor.name} {actor.isDefault ? "(Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTaskDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newTask.rawTitle && newTask.repoAgentId) {
                  createTask.mutate({
                    projectId,
                    rawTitle: newTask.rawTitle,
                    rawDescription: newTask.rawDescription || undefined,
                    priority: newTask.priority,
                    repoAgentId: newTask.repoAgentId,
                    actorId: newTask.actorId === "__default__" ? undefined : newTask.actorId || undefined
                  });
                } else {
                  toast.error("Please fill in title and select a repo agent");
                }
              }}
              disabled={!newTask.rawTitle || !newTask.repoAgentId || createTask.isPending}
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Settings Dialog */}
      <ProjectSettingsComprehensive
        project={project}
        open={showProjectSettings}
        onOpenChange={setShowProjectSettings}
      />
    </div>
  );
}
