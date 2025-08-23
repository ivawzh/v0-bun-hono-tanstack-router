/**
 * V2 Enhanced Task Form
 * Includes repository and agent selection for V2 architecture
 */

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, Bot, Plus, AlertTriangle, GitBranch } from "lucide-react";
import { MultiSelectAgents } from "./multi-select-agents";
import { MultiSelectRepositories } from "./multi-select-repositories";
import { TaskDependencySelector } from "./task-dependency-selector";
import { TaskCreationWarning } from "./project-setup-warning";
import { AttachmentDropzone, type AttachmentFile } from "../attachment-dropzone";
import { TaskModeSelector } from "../task-mode-selector";
import { client } from '@/utils/orpc';

interface Repository {
  id: string;
  name: string;
  repoPath: string;
  isDefault?: boolean;
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number;
}

interface Agent {
  id: string;
  name: string;
  agentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE';
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number;
}

interface Actor {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

interface TaskFormData {
  rawTitle: string;
  rawDescription: string;
  mainRepositoryId: string;
  additionalRepositoryIds: string[];
  assignedAgentIds: string[];
  actorId?: string;
  priority: number;
  ready: boolean;
  attachments: File[];
  dependencyIds: string[];
  mode: "clarify" | "plan" | "execute" | "loop" | "talk" | null;
}

interface EnhancedTaskFormV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
  onOpenSettings: () => void;
  repositories: Repository[];
  agents: Agent[];
  actors: Actor[];
  projectId: string;
}

export function EnhancedTaskFormV2({
  open,
  onOpenChange,
  onSubmit,
  onOpenSettings,
  repositories,
  agents,
  actors,
  projectId
}: EnhancedTaskFormV2Props) {
  const [formData, setFormData] = useState<TaskFormData>({
    rawTitle: '',
    rawDescription: '',
    mainRepositoryId: '',
    additionalRepositoryIds: [],
    assignedAgentIds: [],
    actorId: '',
    priority: 3,
    ready: false,
    attachments: [],
    dependencyIds: [],
    mode: null
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<Array<{
    id: string;
    rawTitle: string;
    refinedTitle: string | null;
    list: 'todo' | 'doing' | 'done' | 'loop';
    priority: number;
  }>>([]);

  const hasRepositories = repositories.length > 0;
  const hasAgents = agents.length > 0;
  const canCreateTask = hasRepositories && hasAgents;

  const defaultActor = actors.find(actor => actor.isDefault);
  const availableRepositories = repositories.filter(repo => repo.isAvailable !== false);
  const availableAgents = agents.filter(agent => agent.isAvailable !== false);

  // Fetch available tasks for dependencies when form opens
  React.useEffect(() => {
    if (open && projectId) {
      client.tasks.getAvailableDependencies({ projectId })
        .then(tasks => setAvailableTasks(tasks))
        .catch(console.error);
    }
  }, [open, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreateTask) {
      return;
    }

    if (!formData.rawTitle.trim() || !formData.mainRepositoryId || formData.assignedAgentIds.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Create task using oRPC with native File support for attachments
      const result = await client.tasks.create({
        projectId: projectId,
        mainRepositoryId: formData.mainRepositoryId,
        additionalRepositoryIds: formData.additionalRepositoryIds,
        assignedAgentIds: formData.assignedAgentIds,
        actorId: formData.actorId || defaultActor?.id,
        rawTitle: formData.rawTitle,
        rawDescription: formData.rawDescription,
        priority: formData.priority,
        list: "todo",
        mode: formData.mode,
        dependencyIds: formData.dependencyIds,
        attachments: formData.attachments.map(file => ({
          file: file
        }))
      });

      // Call the success callback if provided
      await onSubmit({
        ...formData,
        actorId: formData.actorId || defaultActor?.id
      });

      // Reset form
      setFormData({
        rawTitle: '',
        rawDescription: '',
        mainRepositoryId: '',
        additionalRepositoryIds: [],
        assignedAgentIds: [],
        actorId: '',
        priority: 3,
        ready: false,
        attachments: [],
        dependencyIds: [],
        mode: null
      });

      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachmentsChange = (files: File[]) => {
    setFormData(prev => ({ ...prev, attachments: files }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Task
          </DialogTitle>
        </DialogHeader>

        {!canCreateTask && (
          <TaskCreationWarning
            hasRepositories={hasRepositories}
            hasAgents={hasAgents}
            onOpenSettings={onOpenSettings}
            onCancel={() => onOpenChange(false)}
          />
        )}

        {canCreateTask && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Task Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Task Title *</Label>
                <Input
                  id="task-title"
                  placeholder="What needs to be done?"
                  value={formData.rawTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, rawTitle: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description">Description (Optional)</Label>
                <Textarea
                  id="task-description"
                  placeholder="Provide more details about what needs to be done..."
                  value={formData.rawDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, rawDescription: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <Separator />

            {/* Task Dependencies */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Task Dependencies (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Dependencies</Label>
                  <TaskDependencySelector
                    availableTasks={availableTasks}
                    selectedDependencyIds={formData.dependencyIds}
                    onSelectionChange={(ids) => setFormData(prev => ({
                      ...prev,
                      dependencyIds: ids
                    }))}
                    placeholder="Select tasks that must be completed first..."
                    maxSelections={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    This task will be blocked until all selected dependencies are completed
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Repository Configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Repository Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="main-repository">Main Repository *</Label>
                  <Select
                    value={formData.mainRepositoryId}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      mainRepositoryId: value,
                      // Remove from additional repos if selected as main
                      additionalRepositoryIds: prev.additionalRepositoryIds.filter(id => id !== value)
                    }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRepositories.map((repo) => (
                        <SelectItem key={repo.id} value={repo.id}>
                          <div className="flex items-center gap-2">
                            <span>{repo.name}</span>
                            {repo.isDefault && (
                              <Badge variant="outline" className="text-xs">Default</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Primary working directory where the agent will execute the task
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Additional Repositories (Optional)</Label>
                  <MultiSelectRepositories
                    repositories={availableRepositories}
                    selectedRepositoryIds={formData.additionalRepositoryIds}
                    mainRepositoryId={formData.mainRepositoryId}
                    onSelectionChange={(ids) => setFormData(prev => ({
                      ...prev,
                      additionalRepositoryIds: ids
                    }))}
                    placeholder="Select additional working directories..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Agent Assignment */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Agent Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Assigned Agents *</Label>
                  <MultiSelectAgents
                    agents={availableAgents}
                    selectedAgentIds={formData.assignedAgentIds}
                    onSelectionChange={(ids) => setFormData(prev => ({
                      ...prev,
                      assignedAgentIds: ids
                    }))}
                    placeholder="Select agents to work on this task..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Task Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Task Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task-mode">Task Mode (Optional)</Label>
                  <TaskModeSelector
                    mode={formData.mode}
                    list="todo"
                    onModeChange={(mode) => setFormData(prev => ({ ...prev, mode: mode as "clarify" | "plan" | "execute" | "loop" | "talk" | null }))}
                    size="md"
                  />
                  <p className="text-xs text-muted-foreground">
                    Select the initial mode for this task. If not specified, the agent will start with clarify mode.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="actor">Actor (Optional)</Label>
                    <Select
                      value={formData.actorId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, actorId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={defaultActor ? `Default: ${defaultActor.name}` : "Select actor"} />
                      </SelectTrigger>
                      <SelectContent>
                        {actors.map((actor) => (
                          <SelectItem key={actor.id} value={actor.id}>
                            <div className="flex items-center gap-2">
                              <span>{actor.name}</span>
                              {actor.isDefault && (
                                <Badge variant="outline" className="text-xs">Default</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority.toString()}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, priority: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">🔴 Highest (5)</SelectItem>
                        <SelectItem value="4">🟠 High (4)</SelectItem>
                        <SelectItem value="3">🟡 Medium (3)</SelectItem>
                        <SelectItem value="2">🔵 Low (2)</SelectItem>
                        <SelectItem value="1">⚪ Lowest (1)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ready"
                    checked={formData.ready}
                    onChange={(e) => setFormData(prev => ({ ...prev, ready: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="ready" className="text-sm font-normal">
                    Mark as ready for AI pickup
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Attachments (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <AttachmentDropzone
                  onAttachmentsChange={(attachmentFiles) => {
                    handleAttachmentsChange(attachmentFiles.map(af => af.file))
                  }}
                  maxFiles={5}
                  maxSize={10 * 1024 * 1024}
                />
                {formData.attachments.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formData.attachments.length} file(s) selected
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.rawTitle.trim() || !formData.mainRepositoryId || formData.assignedAgentIds.length === 0}
              >
                {isSubmitting ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
