import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings, Plus, FolderOpen, Code2, User, Trash2, Edit,
  Loader2, AlertCircle, Star, StarOff
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface ProjectSettingsProps {
  project: {
    id: string;
    name: string;
    description?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RepoAgentForm {
  repoPath: string;
  clientType: "claude_code" | "opencode";
  selectedClaudeProject?: {
    id: string;
    name: string;
    path: string;
  };
}

interface ActorForm {
  name: string;
  description: string;
  isDefault: boolean;
}

export function ProjectSettingsComprehensive({
  project,
  open,
  onOpenChange,
}: ProjectSettingsProps) {
  const queryClient = useQueryClient();
  
  // Form states
  const [showRepoAgentForm, setShowRepoAgentForm] = useState(false);
  const [editingRepoAgent, setEditingRepoAgent] = useState<string | null>(null);
  const [repoAgentForm, setRepoAgentForm] = useState<RepoAgentForm>({
    repoPath: "",
    clientType: "claude_code"
  });

  const [showActorForm, setShowActorForm] = useState(false);
  const [editingActor, setEditingActor] = useState<string | null>(null);
  const [actorForm, setActorForm] = useState<ActorForm>({
    name: "",
    description: "",
    isDefault: false
  });

  // Fetch repo agents
  const { data: repoAgents, isLoading: repoAgentsLoading } = useQuery(
    orpc.repoAgents.list.queryOptions({
      input: { projectId: project.id },
      enabled: open
    })
  );

  // Fetch actors
  const { data: actors, isLoading: actorsLoading } = useQuery(
    orpc.actors.list.queryOptions({
      input: { projectId: project.id },
      enabled: open
    })
  );

  // Claude Code projects detection
  const { data: claudeProjects } = useQuery(
    orpc.repoAgents.detectClaudeProjects.queryOptions({
      input: {},
      enabled: open && repoAgentForm.clientType === "claude_code"
    })
  );

  // Repo Agent mutations
  const createRepoAgent = useMutation(
    orpc.repoAgents.create.mutationOptions({
      onSuccess: () => {
        toast.success("Repo agent created successfully");
        queryClient.invalidateQueries({ queryKey: ["repoAgents"] });
        resetRepoAgentForm();
      },
      onError: (error: any) => {
        toast.error(`Failed to create repo agent: ${error.message}`);
      },
    })
  );

  const updateRepoAgent = useMutation(
    orpc.repoAgents.update.mutationOptions({
      onSuccess: () => {
        toast.success("Repo agent updated successfully");
        queryClient.invalidateQueries({ queryKey: ["repoAgents"] });
        resetRepoAgentForm();
      },
      onError: (error: any) => {
        toast.error(`Failed to update repo agent: ${error.message}`);
      },
    })
  );

  const deleteRepoAgent = useMutation(
    orpc.repoAgents.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Repo agent deleted successfully");
        queryClient.invalidateQueries({ queryKey: ["repoAgents"] });
      },
      onError: (error: any) => {
        toast.error(`Failed to delete repo agent: ${error.message}`);
      },
    })
  );

  // Actor mutations
  const createActor = useMutation(
    orpc.actors.create.mutationOptions({
      onSuccess: () => {
        toast.success("Actor created successfully");
        queryClient.invalidateQueries({ queryKey: ["actors"] });
        resetActorForm();
      },
      onError: (error: any) => {
        toast.error(`Failed to create actor: ${error.message}`);
      },
    })
  );

  const updateActor = useMutation(
    orpc.actors.update.mutationOptions({
      onSuccess: () => {
        toast.success("Actor updated successfully");
        queryClient.invalidateQueries({ queryKey: ["actors"] });
        resetActorForm();
      },
      onError: (error: any) => {
        toast.error(`Failed to update actor: ${error.message}`);
      },
    })
  );

  const deleteActor = useMutation(
    orpc.actors.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Actor deleted successfully");
        queryClient.invalidateQueries({ queryKey: ["actors"] });
      },
      onError: (error: any) => {
        toast.error(`Failed to delete actor: ${error.message}`);
      },
    })
  );

  // Form handlers
  const resetRepoAgentForm = () => {
    setRepoAgentForm({
      repoPath: "",
      clientType: "claude_code"
    });
    setShowRepoAgentForm(false);
    setEditingRepoAgent(null);
  };

  const resetActorForm = () => {
    setActorForm({
      name: "",
      description: "",
      isDefault: false
    });
    setShowActorForm(false);
    setEditingActor(null);
  };

  const handleEditRepoAgent = (agent: any) => {
    setRepoAgentForm({
      repoPath: agent.repoPath,
      clientType: agent.clientType
    });
    setEditingRepoAgent(agent.id);
    setShowRepoAgentForm(true);
  };

  const handleEditActor = (actor: any) => {
    setActorForm({
      name: actor.name,
      description: actor.description,
      isDefault: actor.isDefault
    });
    setEditingActor(actor.id);
    setShowActorForm(true);
  };

  const handleSaveRepoAgent = () => {
    if (!repoAgentForm.repoPath) {
      toast.error("Please select a repository");
      return;
    }

    // Auto-generate name based on repo and client type
    const repoName = repoAgentForm.selectedClaudeProject?.name || 
                     repoAgentForm.repoPath.split('/').pop() || 
                     'Unknown';
    const clientName = repoAgentForm.clientType === 'claude_code' ? 'Claude Code' : 'OpenCode';
    const generatedName = `${repoName} (${clientName})`;

    const agentData = {
      name: generatedName,
      repoPath: repoAgentForm.repoPath,
      clientType: repoAgentForm.clientType
    };

    if (editingRepoAgent) {
      updateRepoAgent.mutate({
        id: editingRepoAgent,
        ...agentData
      });
    } else {
      createRepoAgent.mutate({
        projectId: project.id,
        ...agentData
      });
    }
  };

  const handleSaveActor = () => {
    if (!actorForm.name || !actorForm.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingActor) {
      updateActor.mutate({
        id: editingActor,
        ...actorForm
      });
    } else {
      createActor.mutate({
        projectId: project.id,
        ...actorForm
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 border-green-200";
      case "idle": return "bg-gray-100 text-gray-800 border-gray-200";
      case "rate_limited": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "error": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Project Settings - {project.name}
          </DialogTitle>
          <DialogDescription>
            Configure repo agents and actors for your project
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="repo-agents" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="repo-agents" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Repo Agents
            </TabsTrigger>
            <TabsTrigger value="actors" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Actors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="repo-agents" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Repository Agents</h3>
                <p className="text-sm text-muted-foreground">
                  Configure coding environments for this project
                </p>
              </div>
              <Button
                onClick={() => setShowRepoAgentForm(true)}
                disabled={showRepoAgentForm}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Repo Agent
              </Button>
            </div>

            {(!repoAgents || repoAgents.length === 0) && !repoAgentsLoading && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No repo agents configured. Tasks won't be able to run until you add at least one repo agent.
                </AlertDescription>
              </Alert>
            )}

            {showRepoAgentForm && (
              <Card className="border-2 border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingRepoAgent ? "Edit Repo Agent" : "Add New Repo Agent"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client-type">Client Type</Label>
                    <Select
                      value={repoAgentForm.clientType}
                      onValueChange={(value: "claude_code" | "opencode") => {
                        setRepoAgentForm({ 
                          ...repoAgentForm, 
                          clientType: value,
                          repoPath: "",
                          selectedClaudeProject: undefined
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude_code">Claude Code</SelectItem>
                        <SelectItem value="opencode">OpenCode</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {repoAgentForm.clientType === "claude_code" ? (
                    <div className="space-y-2">
                      <Label htmlFor="claude-project">Claude Code Project</Label>
                      <Select
                        value={repoAgentForm.selectedClaudeProject?.id || ""}
                        onValueChange={(value) => {
                          const selectedProject = claudeProjects?.find(p => p.id === value);
                          setRepoAgentForm({
                            ...repoAgentForm,
                            selectedClaudeProject: selectedProject,
                            repoPath: selectedProject?.path || ""
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Claude Code project" />
                        </SelectTrigger>
                        <SelectContent>
                          {claudeProjects?.length ? (
                            claudeProjects.map((project: any) => (
                              <SelectItem key={project.id} value={project.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{project.name}</span>
                                  <span className="text-xs text-muted-foreground">{project.path}</span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-projects" disabled>
                              No Claude Code projects found
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {repoAgentForm.selectedClaudeProject && (
                        <p className="text-sm text-muted-foreground">
                          Path: {repoAgentForm.selectedClaudeProject.path}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="repo-path">Repository Path</Label>
                      <Input
                        id="repo-path"
                        placeholder="/home/user/repos/my-project"
                        value={repoAgentForm.repoPath}
                        onChange={(e) => setRepoAgentForm({
                          ...repoAgentForm,
                          repoPath: e.target.value
                        })}
                      />
                    </div>
                  )}

                  {/* Preview of auto-generated name */}
                  {repoAgentForm.repoPath && (
                    <div className="space-y-2">
                      <Label>Generated Name</Label>
                      <div className="p-2 bg-muted rounded-md text-sm">
                        {(() => {
                          const repoName = repoAgentForm.selectedClaudeProject?.name || 
                                           repoAgentForm.repoPath.split('/').pop() || 
                                           'Unknown';
                          const clientName = repoAgentForm.clientType === 'claude_code' ? 'Claude Code' : 'OpenCode';
                          return `${repoName} (${clientName})`;
                        })()}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveRepoAgent}
                      disabled={createRepoAgent.isPending || updateRepoAgent.isPending}
                    >
                      {(createRepoAgent.isPending || updateRepoAgent.isPending) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingRepoAgent ? "Update" : "Create"}
                    </Button>
                    <Button variant="outline" onClick={resetRepoAgentForm}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {repoAgents?.map((agent: any) => (
                <Card key={agent.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{agent.name}</h4>
                          <Badge
                            variant="outline"
                            className={getStatusBadgeColor(agent.status)}
                          >
                            {agent.status}
                          </Badge>
                          <Badge variant="secondary">
                            {agent.clientType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <FolderOpen className="h-3 w-3" />
                          {agent.repoPath}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRepoAgent(agent)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this repo agent?")) {
                              deleteRepoAgent.mutate({ id: agent.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="actors" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Actors</h3>
                <p className="text-sm text-muted-foreground">
                  Define agent personalities and methodologies
                </p>
              </div>
              <Button
                onClick={() => setShowActorForm(true)}
                disabled={showActorForm}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Actor
              </Button>
            </div>

            {showActorForm && (
              <Card className="border-2 border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingActor ? "Edit Actor" : "Add New Actor"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="actor-name">Name</Label>
                      <Input
                        id="actor-name"
                        placeholder="Full-Stack Engineer"
                        value={actorForm.name}
                        onChange={(e) => setActorForm({
                          ...actorForm,
                          name: e.target.value
                        })}
                      />
                    </div>
                    <div className="space-y-2 flex items-end">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="is-default"
                          checked={actorForm.isDefault}
                          onChange={(e) => setActorForm({
                            ...actorForm,
                            isDefault: e.target.checked
                          })}
                        />
                        <Label htmlFor="is-default">Set as default</Label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actor-description">Description</Label>
                    <Textarea
                      id="actor-description"
                      placeholder="Describe the agent's mindset, principles, focus, methodology, and values..."
                      rows={4}
                      value={actorForm.description}
                      onChange={(e) => setActorForm({
                        ...actorForm,
                        description: e.target.value
                      })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveActor}
                      disabled={createActor.isPending || updateActor.isPending}
                    >
                      {(createActor.isPending || updateActor.isPending) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingActor ? "Update" : "Create"}
                    </Button>
                    <Button variant="outline" onClick={resetActorForm}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {actors?.map((actor: any) => (
                <Card key={actor.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{actor.name}</h4>
                          {actor.isDefault && (
                            <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {actor.description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditActor(actor)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this actor?")) {
                              deleteActor.mutate({ id: actor.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}