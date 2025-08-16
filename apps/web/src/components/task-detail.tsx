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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Edit2,
  Save,
  X,
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPriorityOptions } from "@/utils/priority";

interface TaskDetailProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "todo", label: "Todo" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

const stageOptions = [
  { value: "refine", label: "Refine" },
  { value: "plan", label: "Plan" }, 
  { value: "execute", label: "Execute" },
];

export function TaskDetail({ taskId, open, onOpenChange }: TaskDetailProps) {
  const queryClient = useQueryClient();
  const [editingRawDescription, setEditingRawDescription] = useState(false);
  const [rawDescription, setRawDescription] = useState("");

  const { data: taskDetails, isLoading } = useQuery(
    orpc.tasks.get.queryOptions({
      input: { id: taskId! },
      enabled: !!taskId,
    })
  );

  const updateTask = useMutation(
    orpc.tasks.update.mutationOptions({
      onSuccess: () => {
        toast.success("Task updated");
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      },
      onError: (error: any) => {
        toast.error(`Failed to update task: ${error.message}`);
      },
    })
  );

  if (!taskId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading task details...</div>
          </div>
        ) : taskDetails ? (
          <div className="space-y-6">
            {/* Header */}
            <SheetHeader>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">
                  {taskDetails.status === "todo" ? "Todo" : 
                   taskDetails.status === "doing" ? "Doing" : "Done"}
                </Badge>
                {taskDetails.stage && (
                  <Badge variant="secondary">
                    {taskDetails.stage === "refine" ? "Refine" : 
                     taskDetails.stage === "plan" ? "Plan" : "Execute"}
                  </Badge>
                )}
                <Badge variant="outline">
                  Priority {taskDetails.priority}
                </Badge>
              </div>
              <SheetTitle className="text-left">
                {taskDetails.refinedTitle || taskDetails.rawTitle}
              </SheetTitle>
              <SheetDescription className="text-left">
                Created {format(new Date(taskDetails.createdAt), "PPP")}
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="plan">Plan</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* Raw Content */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Raw Title</Label>
                    <p className="text-sm text-muted-foreground">{taskDetails.rawTitle}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Raw Description</Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (editingRawDescription) {
                            updateTask.mutate({
                              id: taskId,
                              rawDescription: rawDescription
                            });
                            setEditingRawDescription(false);
                          } else {
                            setRawDescription(taskDetails.rawDescription || "");
                            setEditingRawDescription(true);
                          }
                        }}
                      >
                        {editingRawDescription ? <Save className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                      </Button>
                    </div>
                    {editingRawDescription ? (
                      <Textarea
                        value={rawDescription}
                        onChange={(e) => setRawDescription(e.target.value)}
                        placeholder="Enter raw description..."
                        rows={4}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {taskDetails.rawDescription || "No description"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Refined Content (Agent Generated) */}
                {(taskDetails.refinedTitle || taskDetails.refinedDescription) && (
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="text-sm font-medium text-green-700">Refined (Agent Generated)</Label>
                    {taskDetails.refinedTitle && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Refined Title</Label>
                        <p className="text-sm">{taskDetails.refinedTitle}</p>
                      </div>
                    )}
                    {taskDetails.refinedDescription && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Refined Description</Label>
                        <p className="text-sm whitespace-pre-wrap">{taskDetails.refinedDescription}</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="plan" className="space-y-4">
                {taskDetails.plan ? (
                  <div className="p-4 bg-muted/50 rounded-md">
                    <Label className="text-sm font-medium">Plan Data</Label>
                    <pre className="text-xs mt-2 whitespace-pre-wrap">
                      {JSON.stringify(taskDetails.plan, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No plan data yet</p>
                    <p className="text-xs">Plan will be generated during the plan stage</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                {/* Status Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Status</Label>
                    <Select
                      value={taskDetails.status}
                      onValueChange={(value) => updateTask.mutate({ id: taskId, status: value as "todo" | "doing" | "done" })}
                    >
                      <SelectTrigger>
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
                    <Label className="text-sm">Stage</Label>
                    <Select
                      value={taskDetails.stage || ""}
                      onValueChange={(value) => updateTask.mutate({ id: taskId, stage: (value || null) as "refine" | "plan" | "execute" | null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No stage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No stage</SelectItem>
                        {stageOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <Label className="text-sm">Priority</Label>
                  <Select
                    value={String(taskDetails.priority)}
                    onValueChange={(value) => updateTask.mutate({ id: taskId, priority: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getPriorityOptions().map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.display}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ready Toggle */}
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <Label className="text-sm font-medium">Ready for Agent</Label>
                    <p className="text-xs text-muted-foreground">Mark ready when task can be picked up by agents</p>
                  </div>
                  <Switch
                    checked={taskDetails.ready || false}
                    onCheckedChange={(checked) => updateTask.mutate({ id: taskId, ready: checked })}
                  />
                </div>

                {/* Repo Agent & Actor Info */}
                {taskDetails.repoAgent && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Assignment</Label>
                    <div className="p-3 bg-muted/50 rounded-md space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Repo Agent:</span> {taskDetails.repoAgent.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Path: {taskDetails.repoAgent.repoPath}
                      </p>
                      {taskDetails.actor && (
                        <p className="text-sm">
                          <span className="font-medium">Actor:</span> {taskDetails.actor.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {(() => {
                  const attachments = taskDetails.attachments as any[];
                  return attachments && Array.isArray(attachments) && attachments.length > 0 ? (
                    <div>
                      <Label className="text-sm font-medium">Attachments</Label>
                      <div className="mt-2 space-y-2">
                        {attachments.map((attachment: any, idx: number) => (
                          <div key={idx} className="p-2 border rounded text-xs">
                            {attachment.filename || `Attachment ${idx + 1}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-muted-foreground p-6">Task not found</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
