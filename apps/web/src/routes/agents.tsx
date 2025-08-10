import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Bot,
  Play,
  Pause,
  StopCircle,
  Activity,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const [showNewAgentDialog, setShowNewAgentDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    role: "Engineer",
    character: "",
    runtime: "windows-runner",
  });

  const { data: agents, isLoading, refetch: refetchAgents } = orpc.agents.list.useQuery({});
  const { data: activeSessions } = orpc.agents.getActiveSessions.useQuery({});

  const createAgent = orpc.agents.create.useMutation({
    onSuccess: () => {
      toast.success("Agent created successfully");
      setShowNewAgentDialog(false);
      setNewAgent({ name: "", role: "Engineer", character: "", runtime: "windows-runner" });
      refetchAgents();
    },
    onError: (error) => {
      toast.error(`Failed to create agent: ${error.message}`);
    },
  });

  const deleteAgent = orpc.agents.delete.useMutation({
    onSuccess: () => {
      toast.success("Agent deleted");
      refetchAgents();
    },
    onError: (error) => {
      toast.error(`Failed to delete agent: ${error.message}`);
    },
  });

  const pauseSession = orpc.agents.pauseSession.useMutation({
    onSuccess: () => {
      toast.success("Session paused");
      refetchAgents();
    },
  });

  const resumeSession = orpc.agents.resumeSession.useMutation({
    onSuccess: () => {
      toast.success("Session resumed");
      refetchAgents();
    },
  });

  const getSessionForAgent = (agentId: string) => {
    return activeSessions?.find((s) => s.agent.id === agentId);
  };

  const getSessionStateColor = (state: string) => {
    switch (state) {
      case "running":
        return "bg-green-500";
      case "paused":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      case "booting":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading agents...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground">
            Configure and monitor your AI agents
          </p>
        </div>
        <Button onClick={() => setShowNewAgentDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent) => {
          const session = getSessionForAgent(agent.id);
          return (
            <Card key={agent.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>{agent.name}</CardTitle>
                  </div>
                  <Badge variant="outline">{agent.role}</Badge>
                </div>
                <CardDescription>
                  {agent.character || "No character description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Runtime:</span>
                    <Badge variant="secondary">{agent.runtime}</Badge>
                  </div>

                  {session ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${getSessionStateColor(
                            session.session.state
                          )}`}
                        />
                        <span className="text-sm font-medium">
                          Session: {session.session.state}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Task: {session.task.title}
                      </div>
                      <div className="flex gap-2">
                        {session.session.state === "running" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              pauseSession.mutate({
                                sessionId: session.session.id,
                              })
                            }
                          >
                            <Pause className="h-3 w-3" />
                          </Button>
                        )}
                        {session.session.state === "paused" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              resumeSession.mutate({
                                sessionId: session.session.id,
                              })
                            }
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAgent({ agent, session });
                            setShowSessionDetails(true);
                          }}
                        >
                          <Activity className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No active session
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        // TODO: Implement agent configuration
                        toast.info("Agent configuration coming soon");
                      }}
                    >
                      <Settings className="mr-1 h-3 w-3" />
                      Configure
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (
                          confirm(
                            `Are you sure you want to delete agent "${agent.name}"?`
                          )
                        ) {
                          deleteAgent.mutate({ id: agent.id });
                        }
                      }}
                      disabled={!!session}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active Sessions Summary */}
      {activeSessions && activeSessions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Active Sessions</h2>
          <Card>
            <ScrollArea className="h-[200px]">
              <div className="p-4 space-y-2">
                {activeSessions.map((session) => (
                  <div
                    key={session.session.id}
                    className="flex items-center justify-between p-2 hover:bg-accent rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${getSessionStateColor(
                          session.session.state
                        )}`}
                      />
                      <div>
                        <div className="font-medium">{session.agent.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.task.title}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Started {format(new Date(session.session.startedAt), "pp")}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>
      )}

      {/* New Agent Dialog */}
      <Dialog open={showNewAgentDialog} onOpenChange={setShowNewAgentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Configure a new AI agent for task automation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                placeholder="My Agent"
                value={newAgent.name}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-role">Role</Label>
              <Select
                value={newAgent.role}
                onValueChange={(value) =>
                  setNewAgent({ ...newAgent, role: value })
                }
              >
                <SelectTrigger id="agent-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PM">Product Manager</SelectItem>
                  <SelectItem value="Designer">Designer</SelectItem>
                  <SelectItem value="Architect">Architect</SelectItem>
                  <SelectItem value="Engineer">Engineer</SelectItem>
                  <SelectItem value="QA">QA Engineer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-character">
                Character/Persona (optional)
              </Label>
              <Textarea
                id="agent-character"
                placeholder="Describe the agent's personality and approach..."
                value={newAgent.character}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, character: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-runtime">Runtime</Label>
              <Select
                value={newAgent.runtime}
                onValueChange={(value) =>
                  setNewAgent({ ...newAgent, runtime: value })
                }
              >
                <SelectTrigger id="agent-runtime">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="windows-runner">Windows Runner</SelectItem>
                  <SelectItem value="cloud">Cloud</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewAgentDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newAgent.name && newAgent.role) {
                  createAgent.mutate({
                    name: newAgent.name,
                    role: newAgent.role as any,
                    character: newAgent.character || undefined,
                    runtime: newAgent.runtime as any,
                  });
                }
              }}
              disabled={!newAgent.name || createAgent.isPending}
            >
              Create Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Details Dialog */}
      {selectedAgent && (
        <Dialog open={showSessionDetails} onOpenChange={setShowSessionDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Session Details</DialogTitle>
              <DialogDescription>
                {selectedAgent.agent.name} - {selectedAgent.session?.session.state}
              </DialogDescription>
            </DialogHeader>
            {selectedAgent.session && (
              <div className="space-y-4">
                <div>
                  <Label>Task</Label>
                  <div className="mt-1 p-2 bg-muted rounded-md">
                    {selectedAgent.session.task.title}
                  </div>
                </div>
                <div>
                  <Label>Session ID</Label>
                  <div className="mt-1 font-mono text-sm">
                    {selectedAgent.session.session.id}
                  </div>
                </div>
                <div>
                  <Label>Started At</Label>
                  <div className="mt-1 text-sm">
                    {format(
                      new Date(selectedAgent.session.session.startedAt),
                      "PPpp"
                    )}
                  </div>
                </div>
                {/* TODO: Add session actions/events display */}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}