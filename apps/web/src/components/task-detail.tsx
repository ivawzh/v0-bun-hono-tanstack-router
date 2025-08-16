import { useState, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  AlertTriangle,
  Info,
  Lightbulb,
  List,
  Target,
  FileEdit,
  History,
  Mic,
  MicOff,
  Upload,
  Image as ImageIcon,
  File,
  X,
  ExternalLink,
  Bot,
  User,
  MoreVertical,
  Download,
  Eye,
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { getPriorityOptions } from "@/utils/priority";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TaskDetailProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "qa", label: "QA" },
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

// Priority options are now handled by the priority utility

export function TaskDetail({ taskId, open, onOpenChange }: TaskDetailProps) {
  const [newMessage, setNewMessage] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kickoff state
  const [kickoffChallenge, setKickoffChallenge] = useState("");
  const [kickoffOptions, setKickoffOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [kickoffSpec, setKickoffSpec] = useState("");

  // Voice recording state
  const { isRecording, startRecording, stopRecording, audioBlob } = useMediaRecorder();

  const { data: taskDetails, isLoading, refetch } = useQuery({
    ...orpc.tasks.getDetails.queryOptions({ input: { id: taskId! } }),
    enabled: !!taskId,
    refetchInterval: 5000, // Auto-refresh every 5 seconds for real-time updates
  });

  // Fetch available agents
  const { data: agents } = useQuery({
    ...orpc.agents.list.queryOptions({ input: {} }),
    enabled: !!taskId,
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
        toast.success("Question posted - Task marked as blocked");
        setNewQuestion("");
        refetch();
      },
    })
  );

  const answerQuestion = useMutation(
    orpc.tasks.answerQuestion.mutationOptions({
      onSuccess: () => {
        toast.success("Question answered - Task unblocked");
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

  const uploadAttachment = useMutation(
    orpc.tasks.uploadAttachment.mutationOptions({
      onSuccess: () => {
        toast.success("Attachment uploaded");
        refetch();
      },
    })
  );

  const startAgentSession = useMutation(
    orpc.agents.startSession.mutationOptions({
      onSuccess: () => {
        toast.success("Agent session started");
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to start agent: ${error.message}`);
      },
    })
  );

  const pauseAgentSession = useMutation(
    orpc.agents.pauseSession.mutationOptions({
      onSuccess: () => {
        toast.success("Agent session paused");
        refetch();
      },
    })
  );

  // Handle voice recording
  const handleVoiceInput = async (forField: 'description' | 'message' | 'question') => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        // TODO: Send to OpenAI Audio API for transcription
        toast.info("Voice transcription coming soon!");
      }
    } else {
      startRecording();
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            uploadAttachment.mutate({
              taskId: taskId!,
              file: file,
              kind: file.type.startsWith('image/') ? 'image' : 'file',
            } as any);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Save kickoff data
  const saveKickoffData = () => {
    const kickoffData = {
      challenge: kickoffChallenge,
      options: kickoffOptions.map((opt, idx) => ({
        text: opt,
        rank: idx === selectedOption ? 1 : idx + 2
      })),
      selectedOption: selectedOption !== null ? kickoffOptions[selectedOption] : null,
      spec: kickoffSpec,
    };

    updateTask.mutate({
      id: taskId!,
      metadata: {
        ...(taskDetails as any)?.metadata,
        kickoff: {
          ...(taskDetails as any)?.metadata?.kickoff,
          [Date.now()]: kickoffData, // Store with timestamp
        }
      }
    } as any);
  };

  if (!taskId) return null;

  // Extract assignment history from events
  const assignmentHistory = (taskDetails as any)?.events?.filter(
    (e: any) => ['assigned', 'unassigned', 'reassigned'].includes(e.type)
  ) || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[700px] sm:max-w-[700px] p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading task details...</div>
          </div>
        ) : taskDetails ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Select
                      value={(taskDetails as any)?.status}
                      onValueChange={(value) =>
                        updateTask.mutate({ id: taskId, status: value as any } as any)
                      }
                    >
                      <SelectTrigger className="w-32 h-8">
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

                    <Select
                      value={(taskDetails as any)?.stage}
                      onValueChange={(value) =>
                        updateTask.mutate({ id: taskId, stage: value as any } as any)
                      }
                    >
                      <SelectTrigger className="w-32 h-8">
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

                    <span className="text-sm text-muted-foreground">
                      TASK-{(taskDetails as any)?.id.slice(0, 8)}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Duplicate Task</DropdownMenuItem>
                        <DropdownMenuItem>Export as Markdown</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">Delete Task</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <h2 className="text-xl font-semibold">{(taskDetails as any)?.title}</h2>
                </div>
              </div>

              {/* Assignee and controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Assignee */}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Assignee:</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                          <Avatar className="h-5 w-5 mr-2">
                            <AvatarFallback className="text-[10px]">
                              {(taskDetails as any)?.assignedActorType === "agent" ? "AI" :
                               (taskDetails as any)?.assignedActorType === "human" ? "H" : "?"}
                            </AvatarFallback>
                          </Avatar>
                          {(() => {
                            if ((taskDetails as any)?.assignedActorType === "agent" && (taskDetails as any)?.assignedAgentId) {
                              const agent = (agents as any)?.find((a: any) => a.id === (taskDetails as any).assignedAgentId);
                              return agent ? agent.name : "Agent";
                            }
                            return (taskDetails as any)?.assignedActorType || "Unassigned";
                          })()}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => updateTask.mutate({
                          id: taskId,
                          assignedActorType: "human",
                          assignedAgentId: null
                        } as any)}>
                          <User className="h-4 w-4 mr-2" />
                          Human
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs">Agents</DropdownMenuLabel>
                        {(agents as any)?.length > 0 ? (
                          (agents as any).map((agent: any) => (
                            <DropdownMenuItem
                              key={agent.id}
                              onClick={() => updateTask.mutate({
                                id: taskId,
                                assignedActorType: "agent",
                                assignedAgentId: agent.id
                              } as any)}
                            >
                              <Bot className="h-4 w-4 mr-2" />
                              {agent.name} ({agent.role})
                            </DropdownMenuItem>
                          ))
                        ) : (
                          <DropdownMenuItem
                            onClick={() => {
                              toast.info("Please create an agent first", {
                                description: "Go to Agents page to create a new agent",
                                action: {
                                  label: "Go to Agents",
                                  onClick: () => window.location.href = "/agents"
                                }
                              });
                            }}
                          >
                            <span className="text-muted-foreground">No agents available - Create one first</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Auto-Start */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="auto-start"
                      checked={(taskDetails as any)?.agentReady || false}
                      onCheckedChange={(checked: boolean) => updateTask.mutate({
                        id: taskId,
                        agentReady: checked,
                      } as any)}
                    />
                    <Label htmlFor="auto-start" className="text-sm">Auto-Start</Label>
                  </div>

                  {/* Agent controls */}
                  {(taskDetails as any)?.assignedActorType === "agent" && (
                    <>
                      <Button
                        size="sm"
                        variant={(taskDetails as any)?.activeSessionId ? "destructive" : "default"}
                        onClick={() => {
                          if ((taskDetails as any)?.activeSessionId) {
                            pauseAgentSession.mutate({
                              sessionId: (taskDetails as any).activeSessionId
                            } as any);
                          } else {
                            startAgentSession.mutate({
                              taskId,
                              agentId: (taskDetails as any).assignedAgentId
                            } as any);
                          }
                        }}
                      >
                        {(taskDetails as any)?.activeSessionId ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause Agent
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Start Agent
                          </>
                        )}
                      </Button>

                      <Button size="sm" variant="outline">
                        Ask Human
                      </Button>
                    </>
                  )}

                  {/* QA Required */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="qa-required"
                      checked={(taskDetails as any)?.qaRequired || false}
                      onCheckedChange={(checked: boolean) => updateTask.mutate({
                        id: taskId,
                        qaRequired: checked,
                      } as any)}
                    />
                    <Label htmlFor="qa-required" className="text-sm">QA Required</Label>
                  </div>
                </div>

                {/* Claude Code link */}
                {(taskDetails as any)?.agentSessionId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const base = 'http://localhost:8303';
                      window.open(`${base}/session/${(taskDetails as any).agentSessionId}`, "_blank");
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Claude Code
                  </Button>
                )}
              </div>

              {/* Pipeline visualization */}
              <div className="flex items-center gap-1 mt-4">
                {stageOptions.map((stage, idx) => (
                  <div key={stage.value} className="flex items-center">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        (taskDetails as any)?.stage === stage.value
                          ? "bg-blue-500"
                          : stageOptions.findIndex(s => s.value === (taskDetails as any)?.stage) > idx
                          ? "bg-green-500"
                          : "bg-gray-300"
                      )}
                    />
                    {idx < stageOptions.length - 1 && (
                      <div
                        className={cn(
                          "h-0.5 w-8",
                          stageOptions.findIndex(s => s.value === (taskDetails as any)?.stage) > idx
                            ? "bg-green-500"
                            : "bg-gray-300"
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="flex-1 flex flex-col">
              <TabsList className="px-6 w-full justify-start rounded-none border-b h-12">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="kickoff">Kickoff</TabsTrigger>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <div className="p-6">
                  {/* Overview Tab */}
                  <TabsContent value="overview" className="mt-0">
                    <div className="space-y-6">
                      {/* Description */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Description</Label>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleVoiceInput('description')}
                            >
                              {isRecording ? (
                                <MicOff className="h-4 w-4 text-red-500" />
                              ) : (
                                <Mic className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (editingDescription) {
                                  updateTask.mutate({
                                    id: taskId,
                                    bodyMd: description,
                                  } as any);
                                } else {
                                  setDescription((taskDetails as any)?.bodyMd || "");
                                }
                                setEditingDescription(!editingDescription);
                              }}
                            >
                              {editingDescription ? "Save" : "Edit"}
                            </Button>
                          </div>
                        </div>
                        {editingDescription ? (
                          <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add a description..."
                            rows={6}
                          />
                        ) : (
                          <div className="p-3 bg-muted/50 rounded-md min-h-[100px]">
                            <p className="text-sm whitespace-pre-wrap">
                              {(taskDetails as any)?.bodyMd || "No description yet"}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Priority</Label>
                          <Select
                            value={String((taskDetails as any)?.priority || 3)}
                            onValueChange={(value) =>
                              updateTask.mutate({
                                id: taskId,
                                priority: parseInt(value)
                              } as any)
                            }
                          >
                            <SelectTrigger className="mt-1">
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

                        <div>
                          <Label>Created</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date((taskDetails as any)?.createdAt), "PPP")}
                          </p>
                        </div>
                      </div>

                      {/* Quick toggles */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium">Blocked</span>
                          </div>
                          <Switch
                            checked={(taskDetails as any)?.isBlocked || false}
                            onCheckedChange={(checked: boolean) => updateTask.mutate({
                              id: taskId,
                              isBlocked: checked,
                            } as any)}
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex items-center gap-2">
                            <Pause className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium">Paused</span>
                          </div>
                          <Switch
                            checked={(taskDetails as any)?.status === "paused"}
                            onCheckedChange={(checked: boolean) => updateTask.mutate({
                              id: taskId,
                              status: checked ? "paused" : "in_progress",
                            } as any)}
                          />
                        </div>
                      </div>

                      {/* Assignment History */}
                      {assignmentHistory.length > 0 && (
                        <div>
                          <Label>Assignment History</Label>
                          <div className="mt-2 space-y-2">
                            {assignmentHistory.map((event: any) => (
                              <div key={event.id} className="flex items-center gap-2 text-sm">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px]">
                                    {event.payload?.to === "agent" ? "AI" : "H"}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{event.type}</span>
                                <span className="text-muted-foreground">
                                  {format(new Date(event.at), "PPp")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Kickoff Tab */}
                  <TabsContent value="kickoff" className="mt-0">
                    <div className="space-y-6">
                      {/* Challenge the idea */}
                      <div>
                        <Label>Challenge the idea</Label>
                        <Textarea
                          value={kickoffChallenge}
                          onChange={(e) => setKickoffChallenge(e.target.value)}
                          placeholder="What assumptions should we challenge? What risks should we consider?"
                          rows={3}
                          className="mt-2"
                        />
                      </div>

                      {/* Options list & ranking */}
                      <div>
                        <Label>Options & Ranking</Label>
                        <div className="mt-2 space-y-2">
                          {kickoffOptions.map((option, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={selectedOption === idx ? "default" : "outline"}
                                onClick={() => setSelectedOption(idx)}
                              >
                                #{idx + 1}
                              </Button>
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...kickoffOptions];
                                  newOptions[idx] = e.target.value;
                                  setKickoffOptions(newOptions);
                                }}
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setKickoffOptions(kickoffOptions.filter((_, i) => i !== idx));
                                  if (selectedOption === idx) setSelectedOption(null);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input
                              value={newOption}
                              onChange={(e) => setNewOption(e.target.value)}
                              placeholder="Add new option..."
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && newOption) {
                                  setKickoffOptions([...kickoffOptions, newOption]);
                                  setNewOption("");
                                }
                              }}
                            />
                            <Button
                              onClick={() => {
                                if (newOption) {
                                  setKickoffOptions([...kickoffOptions, newOption]);
                                  setNewOption("");
                                }
                              }}
                              disabled={!newOption}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Selected option */}
                      {selectedOption !== null && (
                        <div>
                          <Label>Selected Option</Label>
                          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm font-medium">
                              Option #{selectedOption + 1}: {kickoffOptions[selectedOption]}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Spec */}
                      <div>
                        <Label>Specification</Label>
                        <Textarea
                          value={kickoffSpec}
                          onChange={(e) => setKickoffSpec(e.target.value)}
                          placeholder="Write the specification for the selected option..."
                          rows={6}
                          className="mt-2"
                        />
                      </div>

                      {/* Save button */}
                      <Button onClick={saveKickoffData} className="w-full">
                        Save Kickoff Data
                      </Button>

                      {/* History */}
                      {(taskDetails as any)?.metadata?.kickoff && (
                        <div>
                          <Label>Kickoff History</Label>
                          <div className="mt-2 space-y-2">
                            {Object.entries((taskDetails as any).metadata.kickoff)
                              .sort(([a], [b]) => Number(b) - Number(a))
                              .slice(0, 5)
                              .map(([timestamp, data]: [string, any]) => (
                                <Card key={timestamp}>
                                  <CardHeader className="py-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(Number(timestamp)), "PPp")}
                                      </span>
                                      <Button size="sm" variant="ghost">
                                        <History className="h-3 w-3 mr-1" />
                                        View
                                      </Button>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="py-2">
                                    <p className="text-xs">
                                      Selected: {data.selectedOption || "None"}
                                    </p>
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Checklist Tab */}
                  <TabsContent value="checklist" className="mt-0">
                    <div className="space-y-4">
                      {stageOptions.map((stage) => {
                        const stageItems = (taskDetails as any)?.checklistItems?.filter(
                          (item: any) => item.stage === stage.value
                        ) || [];

                        if (stageItems.length === 0) return null;

                        return (
                          <div key={stage.value}>
                            <h3 className="font-medium mb-2">{stage.label}</h3>
                            <div className="space-y-2">
                              {stageItems.map((item: any) => (
                                <div key={item.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={item.state === "done"}
                                    onCheckedChange={(checked) =>
                                      updateChecklistItem.mutate({
                                        itemId: item.id,
                                        state: checked ? "done" : "open",
                                      } as any)
                                    }
                                  />
                                  <label className="text-sm flex-1">{item.title}</label>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      <Button variant="outline" className="w-full">
                        Add Checklist Item
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Comments Tab (Kickoff Comments) */}
                  <TabsContent value="comments" className="mt-0">
                    <div className="flex flex-col h-[400px]">
                      <ScrollArea className="flex-1">
                        <div className="space-y-3">
                          {(taskDetails as any)?.messages?.map((message: any) => (
                            <Card key={message.id}>
                              <CardHeader className="py-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-[10px]">
                                        {message.author === "agent" ? "AI" :
                                         message.author === "human" ? "H" : "S"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs font-medium">{message.author}</span>
                                  </div>
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
                          rows={2}
                        />
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVoiceInput('message')}
                          >
                            {isRecording ? (
                              <MicOff className="h-4 w-4 text-red-500" />
                            ) : (
                              <Mic className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            onClick={() => {
                              if (newMessage) {
                                addMessage.mutate({
                                  taskId,
                                  contentMd: newMessage,
                                } as any);
                              }
                            }}
                            disabled={!newMessage || addMessage.isPending}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Attachments Tab */}
                  <TabsContent value="attachments" className="mt-0">
                    <div className="space-y-4">
                      {/* Upload area */}
                      <div
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Drag & drop files here or click to browse
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileUpload}
                          accept="image/*,application/pdf,.doc,.docx,.txt,.md"
                        />
                      </div>

                      {/* Attachments grid */}
                      <div className="grid grid-cols-3 gap-4">
                        {(taskDetails as any)?.artifacts?.filter((a: any) =>
                          a.kind === 'file' || a.kind === 'image'
                        ).map((artifact: any) => (
                          <Card key={artifact.id} className="overflow-hidden">
                            {artifact.kind === 'image' ? (
                              <div
                                className="aspect-square bg-muted cursor-pointer relative group"
                                onClick={() => setSelectedImage(artifact.uri)}
                              >
                                <img
                                  src={artifact.uri}
                                  alt=""
                                  className="object-cover w-full h-full"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="h-6 w-6 text-white" />
                                </div>
                              </div>
                            ) : (
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                  <File className="h-8 w-8 text-muted-foreground" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {artifact.uri.split('/').pop()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {artifact.meta?.size || "Unknown size"}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            )}
                            <div className="p-2 border-t flex gap-1">
                              <Button size="sm" variant="ghost" className="flex-1">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="flex-1">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Events Tab */}
                  <TabsContent value="events" className="mt-0">
                    <div className="space-y-2">
                      {(taskDetails as any)?.events?.map((event: any) => (
                        <div key={event.id} className="flex items-start gap-3 p-3 hover:bg-muted/50 rounded-md">
                          <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium capitalize">
                                {event.type.replace(/_/g, ' ')}
                              </span>
                              {event.payload?.from && event.payload?.to && (
                                <span className="text-xs text-muted-foreground">
                                  {event.payload.from} → {event.payload.to}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(event.at), "PPp")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Questions Tab */}
                  <TabsContent value="questions" className="mt-0">
                    <div className="flex flex-col h-[400px]">
                      <ScrollArea className="flex-1">
                        <div className="space-y-3">
                          {(taskDetails as any)?.questions?.map((question: any) => (
                            <Card key={question.id} className={cn(
                              question.status === "open" && "border-orange-200 bg-orange-50"
                            )}>
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
                                {question.answer ? (
                                  <div className="mt-2 p-2 bg-green-50 rounded">
                                    <p className="text-sm text-green-800">
                                      Answer: {question.answer}
                                    </p>
                                  </div>
                                ) : question.status === "open" && (
                                  <div className="mt-2 flex gap-2">
                                    <Input
                                      placeholder="Type your answer..."
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          answerQuestion.mutate({
                                            questionId: question.id,
                                            answer: (e.target as HTMLInputElement).value,
                                          } as any);
                                        }
                                      }}
                                    />
                                    <Button size="sm">Answer</Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>

                      <div className="mt-3">
                        <Label className="text-xs text-muted-foreground mb-2 block">
                          Asking a question will block the task until answered
                        </Label>
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Ask a question to human..."
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                            className="flex-1"
                            rows={2}
                          />
                          <Button
                            onClick={() => {
                              if (newQuestion) {
                                askQuestion.mutate({
                                  taskId,
                                  text: newQuestion,
                                } as any);
                              }
                            }}
                            disabled={!newQuestion || askQuestion.isPending}
                          >
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </div>
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

      {/* Image preview dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img src={selectedImage} alt="" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
