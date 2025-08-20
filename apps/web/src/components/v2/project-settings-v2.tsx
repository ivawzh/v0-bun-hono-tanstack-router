/**
 * V2 Project Settings Component
 * Manages repositories and agents separately for V2 architecture
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCacheUtils } from "@/hooks/use-cache-utils";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
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
import { Settings, Plus, Loader2, FolderOpen, Bot, Trash2, Activity, HelpCircle, Edit3, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DeleteProjectModal } from "./delete-project-modal";
import { ConcurrencySelect } from "@/components/ui/concurrency-select";

interface ProjectSettingsV2Props {
  project: {
    id: string;
    name: string;
    description?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultTab?: 'repositories' | 'agents';
}

// Repository card component
function RepositoryCard({ repository, onDelete }: { repository: any; onDelete: (id: string) => void }) {
  const cache = useCacheUtils();
  const [isEditingConcurrency, setIsEditingConcurrency] = useState(false);
  const [concurrencyValue, setConcurrencyValue] = useState(repository.maxConcurrencyLimit ?? 0);
  const [tempConcurrencyValue, setTempConcurrencyValue] = useState(repository.maxConcurrencyLimit ?? 0);
  
  const updateRepository = useMutation(
    orpc.repositories.update.mutationOptions({
      onSuccess: (updatedRepo) => {
        toast.success("Repository updated successfully");
        setConcurrencyValue(updatedRepo.maxConcurrencyLimit ?? 0);
        setIsEditingConcurrency(false);
        cache.invalidateRepository(repository.id, repository.projectId);
      },
      onError: (error: any) => {
        toast.error(`Failed to update repository: ${error.message}`);
        setTempConcurrencyValue(concurrencyValue); // Reset to previous value
      }
    })
  );

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

  const handleStartEdit = () => {
    setTempConcurrencyValue(concurrencyValue);
    setIsEditingConcurrency(true);
  };

  const handleSaveConcurrency = () => {
    if (tempConcurrencyValue !== 0 && (tempConcurrencyValue < 1 || tempConcurrencyValue > 10)) {
      toast.error("Concurrency limit must be unlimited or between 1 and 10");
      return;
    }
    updateRepository.mutate({
      id: repository.id,
      maxConcurrencyLimit: tempConcurrencyValue
    });
  };

  const handleCancelEdit = () => {
    setTempConcurrencyValue(concurrencyValue);
    setIsEditingConcurrency(false);
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
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Concurrency: 
              </p>
              {isEditingConcurrency ? (
                <div className="flex items-center gap-1">
                  <ConcurrencySelect
                    value={tempConcurrencyValue}
                    onValueChange={setTempConcurrencyValue}
                    className="h-6 w-24 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveConcurrency}
                    disabled={updateRepository.isPending}
                    className="h-6 w-6 p-0"
                  >
                    {updateRepository.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 text-green-600" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={updateRepository.isPending}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={handleStartEdit}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 hover:bg-muted px-1 py-0.5 rounded transition-colors"
                >
                  {concurrencyValue === 0 ? 'Unlimited' : concurrencyValue}
                  <Edit3 className="h-3 w-3" />
                </button>
              )}
            </div>
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
  const cache = useCacheUtils();
  const [isEditingConcurrency, setIsEditingConcurrency] = useState(false);
  const [concurrencyValue, setConcurrencyValue] = useState(agent.maxConcurrencyLimit ?? 0);
  const [tempConcurrencyValue, setTempConcurrencyValue] = useState(agent.maxConcurrencyLimit ?? 0);
  
  const updateAgent = useMutation(
    orpc.agents.update.mutationOptions({
      onSuccess: (updatedAgent) => {
        toast.success("Agent updated successfully");
        setConcurrencyValue(updatedAgent.maxConcurrencyLimit ?? 0);
        setIsEditingConcurrency(false);
        cache.invalidateAgent(agent.id);
      },
      onError: (error: any) => {
        toast.error(`Failed to update agent: ${error.message}`);
        setTempConcurrencyValue(concurrencyValue); // Reset to previous value
      }
    })
  );

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

  const handleStartEdit = () => {
    setTempConcurrencyValue(concurrencyValue);
    setIsEditingConcurrency(true);
  };

  const handleSaveConcurrency = () => {
    if (tempConcurrencyValue !== 0 && (tempConcurrencyValue < 1 || tempConcurrencyValue > 10)) {
      toast.error("Concurrency limit must be unlimited or between 1 and 10");
      return;
    }
    updateAgent.mutate({
      id: agent.id,
      maxConcurrencyLimit: tempConcurrencyValue
    });
  };

  const handleCancelEdit = () => {
    setTempConcurrencyValue(concurrencyValue);
    setIsEditingConcurrency(false);
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
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-muted-foreground">
                Max Concurrency: 
              </p>
              {isEditingConcurrency ? (
                <div className="flex items-center gap-1">
                  <ConcurrencySelect
                    value={tempConcurrencyValue}
                    onValueChange={setTempConcurrencyValue}
                    className="h-6 w-24 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveConcurrency}
                    disabled={updateAgent.isPending}
                    className="h-6 w-6 p-0"
                  >
                    {updateAgent.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 text-green-600" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={updateAgent.isPending}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={handleStartEdit}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 hover:bg-muted px-1 py-0.5 rounded transition-colors"
                >
                  {concurrencyValue === 0 ? 'Unlimited' : concurrencyValue}
                  <Edit3 className="h-3 w-3" />
                </button>
              )}
            </div>
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
    maxConcurrencyLimit: 0
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
        <div className="flex items-center gap-2">
          <Label htmlFor="repo-path">Repository Path</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p>Absolute path to your repository directory. To find your repository path, navigate to your project folder in the terminal and run <code className="bg-slate-800 text-green-400 px-1 py-0.5 rounded text-xs font-mono">pwd</code></p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
        <ConcurrencySelect
          value={formData.maxConcurrencyLimit}
          onValueChange={(value) => setFormData(prev => ({ 
            ...prev, 
            maxConcurrencyLimit: value 
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
function CreateAgentForm({ projectId, onSuccess }: { projectId: string; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    agentType: 'CLAUDE_CODE' as 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE',
    maxConcurrencyLimit: 0,
    claudeConfigDir: ''
  });

  const createAgent = useMutation(
    orpc.agents.create.mutationOptions({
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
      projectId: projectId,
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
        <ConcurrencySelect
          value={formData.maxConcurrencyLimit}
          onValueChange={(value) => setFormData(prev => ({ 
            ...prev, 
            maxConcurrencyLimit: value 
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
  defaultTab = 'repositories',
}: ProjectSettingsV2Props) {
  const cache = useCacheUtils();

  const [name, setName] = useState(project.name || "");
  const [description, setDescription] = useState(project.description || "");
  const [showCreateRepoForm, setShowCreateRepoForm] = useState(false);
  const [showCreateAgentForm, setShowCreateAgentForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch repositories for this project
  const { data: repositories, isLoading: loadingRepositories } = useQuery(
    orpc.repositories.list.queryOptions({
      input: { projectId: project.id },
      enabled: open
    })
  );

  // Fetch user agents
  const { data: agents, isLoading: loadingAgents } = useQuery(
    orpc.agents.list.queryOptions({
      input: { projectId: project.id, includeTaskCounts: true },
      enabled: open
    })
  );

  const updateProject = useMutation(
    orpc.projects.update.mutationOptions({
      onSuccess: () => {
        toast.success("Project settings updated successfully");
        cache.invalidateProjectLists();
        onSuccess?.();
      },
      onError: (error: any) => {
        toast.error(`Failed to update project: ${error.message}`);
      },
    })
  );

  const deleteRepository = useMutation(
    orpc.repositories.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Repository deleted successfully");
        cache.invalidateRepository('', project.id); // Pass empty string for repo ID since we're invalidating by project
      },
      onError: (error: any) => {
        toast.error(`Failed to delete repository: ${error.message}`);
      }
    })
  );

  const deleteAgent = useMutation(
    orpc.agents.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Agent deleted successfully");
        cache.invalidateAgent(''); // Pass empty string as we're invalidating all agent lists
      },
      onError: (error: any) => {
        toast.error(`Failed to delete agent: ${error.message}`);
      }
    })
  );

  const handleSave = () => {
    updateProject.mutate({
      id: project.id,
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
              
              <Tabs defaultValue={defaultTab} className="w-full">
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
                          projectId={project.id}
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

            <Separator />

            {/* Danger Zone */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
              <Card className="border-destructive/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-destructive">Delete Project</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Permanently delete this project and all its data. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteModal(true)}
                      className="ml-4"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </Button>
                  </div>
                </CardContent>
              </Card>
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

      <DeleteProjectModal
        project={project}
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
      />
    </Dialog>
  );
}