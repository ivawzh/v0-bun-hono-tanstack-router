import { useState } from "react";
import { Plus, MoreHorizontal, Clock, AlertCircle, CheckCircle, Pause, Play } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { TaskDetail } from "./task-detail";
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

interface KanbanBoardProps {
  boardId: string;
}

const statusColumns = [
  { id: "todo", label: "To Do", icon: Clock, color: "bg-slate-500" },
  { id: "in_progress", label: "In Progress", icon: Play, color: "bg-blue-500" },
  { id: "blocked", label: "Blocked", icon: AlertCircle, color: "bg-red-500" },
  { id: "paused", label: "Paused", icon: Pause, color: "bg-yellow-500" },
  { id: "done", label: "Done", icon: CheckCircle, color: "bg-green-500" },
];

const stageColors = {
  kickoff: "bg-purple-100 text-purple-800",
  spec: "bg-pink-100 text-pink-800",
  design: "bg-indigo-100 text-indigo-800",
  dev: "bg-blue-100 text-blue-800",
  qa: "bg-orange-100 text-orange-800",
  done: "bg-green-100 text-green-800",
};

export function KanbanBoard({ boardId }: KanbanBoardProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState<string>("todo");
  const [newTask, setNewTask] = useState({
    title: "",
    bodyMd: "",
    stage: "kickoff",
    priority: 0,
  });

  const { data: boardData, isLoading, refetch } = orpc.boards.getWithTasks.useQuery({ id: boardId });
  
  const createTask = orpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task created successfully");
      setShowNewTaskDialog(false);
      setNewTask({ title: "", bodyMd: "", stage: "kickoff", priority: 0 });
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });
  
  const updateTask = orpc.tasks.update.useMutation({
    onSuccess: () => {
      toast.success("Task updated");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update task: ${error.message}`);
    },
  });

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

  const tasksByStatus = statusColumns.reduce((acc, column) => {
    acc[column.id] = boardData.tasks?.filter((task) => task.status === column.id) || [];
    return acc;
  }, {} as Record<string, typeof boardData.tasks>);

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
      updateTask.mutate({ id: taskId, status: newStatus as any });
    }
  };

  return (
    <div className="h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{boardData.name}</h2>
          {boardData.purpose && (
            <p className="text-muted-foreground">{boardData.purpose}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 h-[calc(100vh-12rem)]">
        {statusColumns.map((column) => (
          <div
            key={column.id}
            className="flex flex-col"
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
                {tasksByStatus[column.id]?.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <CardHeader className="p-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-medium line-clamp-2">
                          {task.title}
                        </CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 -mt-1"
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
                                  status: task.status === "paused" ? "in_progress" : "paused",
                                });
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
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className={cn("text-xs", stageColors[task.stage as keyof typeof stageColors])}>
                          {task.stage}
                        </Badge>
                        {task.priority > 0 && (
                          <Badge variant="outline" className="text-xs">
                            P{task.priority}
                          </Badge>
                        )}
                        {task.assignedActorType && (
                          <Badge variant="outline" className="text-xs">
                            {task.assignedActorType}
                          </Badge>
                        )}
                      </div>
                      {task.bodyMd && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {task.bodyMd}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>

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
              Add a new task to the {statusColumns.find(c => c.id === newTaskColumn)?.label} column
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
                  });
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