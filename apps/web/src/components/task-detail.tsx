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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  FileText,
  CheckSquare,
  Activity,
  HelpCircle,
  Send,
  Paperclip,
  Play,
  Pause,
  AlertCircle,
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";

interface TaskDetailProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
];

const stageOptions = [
  { value: "kickoff", label: "Kickoff" },
  { value: "spec", label: "Spec" },
  { value: "design", label: "Design" },
  { value: "dev", label: "Development" },
  { value: "qa", label: "QA" },
  { value: "done", label: "Done" },
];

export function TaskDetail({ taskId, open, onOpenChange }: TaskDetailProps) {
  const [newMessage, setNewMessage] = useState("");
  const [newQuestion, setNewQuestion] = useState("");

  const { data: taskDetails, isLoading, refetch } = useQuery({
    ...orpc.tasks.getDetails.queryOptions({ id: taskId! }),
    enabled: !!taskId
  });

  const updateTask = useMutation(
    orpc.tasks.update.mutationOptions({
      onSuccess: () => {
        toast.success("Task updated");
        refetch();
      },
    })
  );

  const addMessage = useMutation(
    orpc.tasks.addMessage.mutationOptions({
      onSuccess: () => {
        toast.success("Message added");
        setNewMessage("");
        refetch();
      },
    })
  );

  const askQuestion = useMutation(
    orpc.tasks.askQuestion.mutationOptions({
      onSuccess: () => {
        toast.success("Question posted");
        setNewQuestion("");
        refetch();
      },
    })
  );

  const updateChecklistItem = useMutation(
    orpc.tasks.updateChecklistItem.mutationOptions({
      onSuccess: () => {
        refetch();
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
          <>
            <SheetHeader>
              <SheetTitle className="flex items-start justify-between">
                <span className="pr-4">{taskDetails.title}</span>
                <div className="flex gap-2">
                  <Badge variant="outline">{taskDetails.status}</Badge>
                  <Badge variant="secondary">{taskDetails.stage}</Badge>
                </div>
              </SheetTitle>
              <SheetDescription>
                Created {format(new Date(taskDetails.createdAt), "PPP")}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={taskDetails.status}
                    onValueChange={(value) =>
                      updateTask.mutate({ id: taskId, status: value as any })
                    }
                  >
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
                  <label className="text-sm font-medium">Stage</label>
                  <Select
                    value={taskDetails.stage}
                    onValueChange={(value) =>
                      updateTask.mutate({ id: taskId, stage: value as any })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {taskDetails.bodyMd && (
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {taskDetails.bodyMd}
                  </p>
                </div>
              )}

              <Tabs defaultValue="checklist" className="mt-6">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="checklist">
                    <CheckSquare className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="messages">
                    <MessageSquare className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="questions">
                    <HelpCircle className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="artifacts">
                    <Paperclip className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="activity">
                    <Activity className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="checklist" className="mt-4">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {taskDetails.checklistItems.map((item) => (
                        <div key={item.id} className="flex items-center space-x-2">
                          <Checkbox
                            checked={item.state === "done"}
                            onCheckedChange={(checked) =>
                              updateChecklistItem.mutate({
                                itemId: item.id,
                                state: checked ? "done" : "open",
                              })
                            }
                          />
                          <label className="text-sm flex-1">{item.title}</label>
                          <Badge variant="outline" className="text-xs">
                            {item.stage}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="messages" className="mt-4">
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-3">
                      {taskDetails.messages.map((message) => (
                        <Card key={message.id}>
                          <CardHeader className="py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{message.author}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(message.at), "PPp")}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="py-2">
                            <p className="text-sm">{message.contentMd}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="mt-3 flex gap-2">
                    <Textarea
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => {
                        if (newMessage) {
                          addMessage.mutate({
                            taskId,
                            contentMd: newMessage,
                          });
                        }
                      }}
                      disabled={!newMessage || addMessage.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="questions" className="mt-4">
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-3">
                      {taskDetails.questions.map((question) => (
                        <Card key={question.id}>
                          <CardHeader className="py-2">
                            <div className="flex items-center justify-between">
                              <Badge variant={question.status === "open" ? "destructive" : "default"}>
                                {question.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Asked by {question.askedBy}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="py-2">
                            <p className="text-sm font-medium">{question.text}</p>
                            {question.answer && (
                              <p className="text-sm text-muted-foreground mt-2">
                                Answer: {question.answer}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="mt-3 flex gap-2">
                    <Textarea
                      placeholder="Ask a question..."
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => {
                        if (newQuestion) {
                          askQuestion.mutate({
                            taskId,
                            text: newQuestion,
                          });
                        }
                      }}
                      disabled={!newQuestion || askQuestion.isPending}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="artifacts" className="mt-4">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {taskDetails.artifacts.map((artifact) => (
                        <Card key={artifact.id}>
                          <CardContent className="py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="text-sm">{artifact.uri}</span>
                              </div>
                              <Badge variant="outline">{artifact.kind}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {taskDetails.events.map((event) => (
                        <div key={event.id} className="flex items-start gap-2 text-sm">
                          <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium">{event.type}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(event.at), "PPp")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const newStatus = taskDetails.status === "paused" ? "in_progress" : "paused";
                    updateTask.mutate({ id: taskId, status: newStatus });
                  }}
                >
                  {taskDetails.status === "paused" ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
                {taskDetails.status !== "blocked" && (
                  <Button
                    variant="outline"
                    onClick={() => updateTask.mutate({ id: taskId, status: "blocked" })}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Mark Blocked
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">Task not found</div>
        )}
      </SheetContent>
    </Sheet>
  );
}