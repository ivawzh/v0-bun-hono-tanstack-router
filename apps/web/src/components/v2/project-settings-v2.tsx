/**
 * V2 Project Settings Component
 * Manages repositories and agents separately for V2 architecture
 */

import { useState } from "react";
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
import { Settings, Plus, Loader2, FolderOpen, Bot, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ProjectSettingsV2Props {
  project: {
    id: string;
    name: string;
    description?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Repository card component
function RepositoryCard({ repository, onDelete }: { repository: any; onDelete: (id: string) => void }) {
  const getStatusBadge = () => {
    if (repository.activeTaskCount && repository.activeTaskCount > 0) {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
          <Activity className="h-3 w-3 mr-1" />
          {repository.activeTaskCount} active
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
        <Activity className="h-3 w-3 mr-1" />
        Available
      </Badge>
    );
  };

  return (
    <Card className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">{repository.name}</h4>
              {repository.isDefault && (
                <Badge variant="outline" className="text-xs">Default</Badge>
              )}
              {getStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              Path: {repository.repoPath}
            </p>
            <p className="text-xs text-muted-foreground">
              Concurrency: {repository.maxConcurrencyLimit || 1}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(repository.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Agent card component
function AgentCard({ agent, onDelete }: { agent: any; onDelete: (id: string) => void }) {
  const getStatusBadge = () => {
    const isRateLimited = agent.state?.rateLimitResetAt && 
      new Date(agent.state.rateLimitResetAt) > new Date();
    
    if (isRateLimited) {
      return (
        <Badge variant="destructive">Rate Limited</Badge>
      );
    }
    if (agent.activeTaskCount && agent.activeTaskCount > 0) {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
          <Activity className="h-3 w-3 mr-1" />
          {agent.activeTaskCount} active
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
        <Activity className="h-3 w-3 mr-1" />
        Available
      </Badge>
    );
  };

  return (
    <Card className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">{agent.name}</h4>
              <Badge variant="outline" className="text-xs">{agent.agentType}</Badge>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              Max Concurrency: {agent.maxConcurrencyLimit || 1}
            </p>
            {agent.agentSettings?.CLAUDE_CONFIG_DIR && (
              <p className="text-xs text-muted-foreground">
                Config: {agent.agentSettings.CLAUDE_CONFIG_DIR}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(agent.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Repository creation form
function CreateRepositoryForm({ projectId, onSuccess }: { projectId: string; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    repoPath: '',
    isDefault: false,
    maxConcurrencyLimit: 1
  });

  const createRepository = useMutation(
    orpc.repositories.create.mutationOptions({
      onSuccess: () => {
        toast.success("Repository created successfully");
        onSuccess();
      },
      onError: (error: any) => {
        toast.error(`Failed to create repository: ${error.message}`);
      }
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRepository.mutate({
      projectId,
      ...formData
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="repo-name">Repository Name</Label>
        <Input
          id="repo-name"
          placeholder="Main Repo"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="repo-path">Repository Path</Label>
        <Input
          id="repo-path"
          placeholder="/home/user/repos/my-project"
          value={formData.repoPath}
          onChange={(e) => setFormData(prev => ({ ...prev, repoPath: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="concurrency-limit">Max Concurrent Tasks</Label>
        <Input
          id="concurrency-limit"
          type="number"
          min="1"
          max="10"
          value={formData.maxConcurrencyLimit}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            maxConcurrencyLimit: parseInt(e.target.value) 
          }))}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button 
          type="submit" 
          disabled={createRepository.isPending}
        >
          {createRepository.isPending ? "Creating..." : "Create Repository"}
        </Button>
      </div>
    </form>
  );
}

// Agent creation form
function CreateAgentForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    agentType: 'CLAUDE_CODE' as 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE',
    maxConcurrencyLimit: 1,
    claudeConfigDir: ''
  });

  const createAgent = useMutation(
    orpc.userAgents.create.mutationOptions({
      onSuccess: () => {
        toast.success("Agent created successfully");
        onSuccess();
      },
      onError: (error: any) => {
        toast.error(`Failed to create agent: ${error.message}`);
      }
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const agentSettings = formData.agentType === 'CLAUDE_CODE' && formData.claudeConfigDir 
      ? { CLAUDE_CONFIG_DIR: formData.claudeConfigDir }
      : {};
    
    createAgent.mutate({
      name: formData.name,
      agentType: formData.agentType,
      maxConcurrencyLimit: formData.maxConcurrencyLimit,
      agentSettings
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="agent-name">Agent Name</Label>
        <Input
          id="agent-name"
          placeholder="My Claude Agent"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="agent-type">Agent Type</Label>
        <Select
          value={formData.agentType}
          onValueChange={(value: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE') =>
            setFormData(prev => ({ ...prev, agentType: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CLAUDE_CODE">Claude Code</SelectItem>
            <SelectItem value="CURSOR_CLI">Cursor CLI</SelectItem>
            <SelectItem value="OPENCODE">OpenCode</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agent-concurrency">Max Concurrent Tasks</Label>
        <Input
          id="agent-concurrency"
          type="number"
          min="1"
          max="10"
          value={formData.maxConcurrencyLimit}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            maxConcurrencyLimit: parseInt(e.target.value) 
          }))}
        />
      </div>

      {formData.agentType === 'CLAUDE_CODE' && (
        <div className="space-y-2">
          <Label htmlFor="claude-config">Claude Config Directory (Optional)</Label>
          <Input
            id="claude-config"
            placeholder="/home/user/.claude-pro"
            value={formData.claudeConfigDir}
            onChange={(e) => setFormData(prev => ({ ...prev, claudeConfigDir: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Use different Claude accounts by specifying config directory
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button 
          type="submit" 
          disabled={createAgent.isPending}
        >
          {createAgent.isPending ? "Creating..." : "Create Agent"}
        </Button>
      </div>
    </form>
  );
}

export function ProjectSettingsV2({
  project,
  open,
  onOpenChange,
  onSuccess,
}: ProjectSettingsV2Props) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(project.name || "");
  const [description, setDescription] = useState(project.description || "");
  const [showCreateRepoForm, setShowCreateRepoForm] = useState(false);
  const [showCreateAgentForm, setShowCreateAgentForm] = useState(false);

  // Fetch repositories for this project
  const { data: repositories, isLoading: loadingRepositories } = useQuery(
    orpc.repositories.list.queryOptions({
      input: { projectId: project.id },
      enabled: open
    })
  );

  // Fetch user agents
  const { data: agents, isLoading: loadingAgents } = useQuery(
    orpc.userAgents.list.queryOptions({
      input: { includeTaskCounts: true },
      enabled: open
    })
  );

  const updateProject = useMutation({
    mutationFn: async (updates: { name: string; description: string }) => {
      // TODO: Replace with V2 API
      return orpc.projects.update.mutate({
        id: project.id,
        ...updates
      });
    },
    onSuccess: () => {
      toast.success("Project settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(`Failed to update project: ${error.message}`);
    },
  });

  const deleteRepository = useMutation(
    orpc.repositories.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Repository deleted successfully");
        queryClient.invalidateQueries({ queryKey: ['repositories', 'list', { input: { projectId: project.id } }] });
      },
      onError: (error: any) => {
        toast.error(`Failed to delete repository: ${error.message}`);
      }
    })
  );

  const deleteAgent = useMutation(
    orpc.userAgents.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Agent deleted successfully");
        queryClient.invalidateQueries({ queryKey: ['userAgents', 'list'] });
      },
      onError: (error: any) => {
        toast.error(`Failed to delete agent: ${error.message}`);
      }
    })
  );

  const handleSave = () => {
    updateProject.mutate({
      name: name,
      description: description,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Project Settings
          </DialogTitle>
          <DialogDescription>
            Manage project details, repositories, and agents
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-1">
          <div className="space-y-6 py-4">
            {/* Project Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Project Details</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="Project name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-description">Description (optional)</Label>
                  <Input
                    id="project-description"
                    placeholder="Project description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* V2 Architecture Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configuration</h3>
              
              <Tabs defaultValue="repositories" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="repositories" className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Repositories
                    <Badge variant="outline">{repositories?.length || 0}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="agents" className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Agents
                    <Badge variant="outline">{agents?.length || 0}</Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="repositories" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Repositories</h4>
                    <Button 
                      size="sm" 
                      onClick={() => setShowCreateRepoForm(true)}
                      className="h-8"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Repository
                    </Button>
                  </div>
                  
                  {showCreateRepoForm && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Create New Repository</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CreateRepositoryForm 
                          projectId={project.id}
                          onSuccess={() => setShowCreateRepoForm(false)}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {loadingRepositories ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2 text-muted-foreground">Loading repositories...</span>
                    </div>
                  ) : repositories && repositories.length > 0 ? (
                    <div className="space-y-3">
                      {repositories.map((repository: any) => (
                        <RepositoryCard
                          key={repository.id}
                          repository={repository}
                          onDelete={(id) => deleteRepository.mutate({ id })}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center text-muted-foreground">
                          <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No repositories configured</p>
                          <p className="text-xs">Add repositories to define where agents can work</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="agents" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Your Agents</h4>
                    <Button 
                      size="sm" 
                      onClick={() => setShowCreateAgentForm(true)}
                      className="h-8"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Agent
                    </Button>
                  </div>

                  {showCreateAgentForm && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Create New Agent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CreateAgentForm 
                          onSuccess={() => setShowCreateAgentForm(false)}
                        />
                      </CardContent>
                    </Card>
                  )}
                  
                  {loadingAgents ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2 text-muted-foreground">Loading agents...</span>
                    </div>
                  ) : agents && agents.length > 0 ? (
                    <div className="space-y-3">
                      {agents.map((agent: any) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          onDelete={(id) => deleteAgent.mutate({ id })}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center text-muted-foreground">
                          <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No agents configured</p>
                          <p className="text-xs">Add agents to enable AI task automation</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
              
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>V2 Architecture:</strong> Repositories define where agents can work, and 
                  agents execute tasks across multiple repositories as needed.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateProject.isPending || !name.trim()}
          >
            {updateProject.isPending ? "Saving..." : "Save Project Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}