/**
 * TaskContent Component
 * Reusable task content component extracted from TaskDrawerV2
 * Contains all tab content logic for task management
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GitBranch,
  Settings2,
  FolderOpen,
  Bot,
  User,
  Lock,
  CheckCircle,
  X,
  Trash2,
  Edit3,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getPriorityColors, getPriorityDisplay, getPriorityOptions, type Priority } from "@/utils/priority";
import { TaskModeSelector } from "@/components/task-mode-selector";
import { AttachmentList } from "@/components/attachment-list";
import { EditableField } from "@/components/editable-field";
import { ClaudeCodeSessionLink } from "@/components/claude-code-session-link";
import { TaskAttachmentUpload } from "@/components/task-attachment-upload";
import { MultiSelectAgents } from "./multi-select-agents";
import { MultiSelectRepositories } from "./multi-select-repositories";
import { TaskDependencySelector } from "./task-dependency-selector";
import { TaskDependencyGraph } from "./task-dependency-graph";
import { TaskIterationHistory } from "@/components/task-iteration-history";
import { TaskApprovalControls } from "@/components/task-approval-controls";
import type { TaskV2, DependencyData, Repository, Agent, Actor, AvailableTask } from "@/types/task";


interface TaskContentProps {
  task: TaskV2;
  repositories?: Repository[];
  agents?: Agent[];
  actors?: Actor[];
  dependencyData?: DependencyData;
  availableTasks?: AvailableTask[];
  editingDescription: boolean;
  tempDescription: string;
  onEditingDescriptionChange: (editing: boolean) => void;
  onTempDescriptionChange: (description: string) => void;
  onSaveDescription: () => void;
  onSaveRefinedTitle: (value: string) => Promise<void>;
  onSaveRefinedDescription: (value: string) => Promise<void>;
  onSavePlan: (value: string) => Promise<void>;
  onListChange: (list: string) => void;
  onPriorityChange: (priority: string) => void;
  onModeChange: (mode: string | null) => void;
  onMainRepositoryChange: (repositoryId: string) => void;
  onAdditionalRepositoriesChange: (repositoryIds: string[]) => void;
  onAssignedAgentsChange: (agentIds: string[]) => void;
  onActorChange: (actorId: string) => void;
  onDependencySelectionChange: (selectedIds: string[]) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onDeleteTask: () => void;
}

const listOptions = [
  { value: "todo", label: "Todo", color: "bg-slate-500" },
  { value: "doing", label: "Doing", color: "bg-blue-500" },
  { value: "done", label: "Done", color: "bg-green-500" },
  { value: "loop", label: "Loop", color: "bg-purple-500" },
  { value: "check", label: "Check", color: "bg-orange-500" },
];

export function TaskContent({
  task,
  repositories = [],
  agents = [],
  actors = [],
  dependencyData,
  availableTasks = [],
  editingDescription,
  tempDescription,
  onEditingDescriptionChange,
  onTempDescriptionChange,
  onSaveDescription,
  onSaveRefinedTitle,
  onSaveRefinedDescription,
  onSavePlan,
  onListChange,
  onPriorityChange,
  onModeChange,
  onMainRepositoryChange,
  onAdditionalRepositoriesChange,
  onAssignedAgentsChange,
  onActorChange,
  onDependencySelectionChange,
  onDeleteAttachment,
  onDeleteTask,
}: TaskContentProps) {
  return (
    <Tabs defaultValue={task.list === 'check' ? 'check' : 'overview'} className="flex flex-col h-full">
      <div className="flex-shrink-0">
        <TabsList className="px-4 sm:px-6 w-full justify-start rounded-none border-b h-10 sm:h-12">
          <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3">Overview</TabsTrigger>
          <TabsTrigger value="dependencies" className="text-xs sm:text-sm px-2 sm:px-3">
            <GitBranch className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Dependencies</span>
            <span className="sm:hidden">Deps</span>
            {dependencyData?.dependencies && dependencyData.dependencies.length > 0 && (
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                {dependencyData.dependencies.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="plan" className="text-xs sm:text-sm px-2 sm:px-3">Plan</TabsTrigger>
          {task.list === 'check' && (
            <TabsTrigger value="check" className="text-xs sm:text-sm px-2 sm:px-3">
              <CheckCircle className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Review</span>
              <span className="sm:hidden">Review</span>
              {task.iterations && task.iterations.length > 0 && (
                <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                  {task.iterations.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="attachments" className="text-xs sm:text-sm px-2 sm:px-3">
            <span className="hidden sm:inline">Attachments</span>
            <span className="sm:hidden">Files</span>
            {(() => {
              const attachments = task.attachments as any[];
              return attachments && Array.isArray(attachments) && attachments.length > 0 ? (
                <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                  {attachments.length}
                </Badge>
              ) : null;
            })()}
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm px-2 sm:px-3">
            <Settings2 className="h-3 w-3 mr-1" />
            Settings
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6">
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0">
            <div className="space-y-6">
              {/* Raw Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Description</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-auto p-2"
                    onClick={() => {
                      if (editingDescription) {
                        onSaveDescription();
                      } else {
                        onTempDescriptionChange(task.rawDescription || "");
                        onEditingDescriptionChange(true);
                      }
                    }}
                  >
                    {editingDescription ? "Save" : <Edit3 className="h-5 w-5 sm:h-4 sm:w-4" />}
                  </Button>
                </div>
                {editingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      value={tempDescription}
                      onChange={(e) => onTempDescriptionChange(e.target.value)}
                      placeholder="Add a description..."
                      rows={6}
                    />
                    <div className="flex gap-2 flex-col sm:flex-row">
                      <Button size="sm" onClick={onSaveDescription} className="h-9">
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onEditingDescriptionChange(false)} className="h-9">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/50 rounded-md min-h-[100px]">
                    <p className="text-sm whitespace-pre-wrap">
                      {task.rawDescription || "No description yet"}
                    </p>
                  </div>
                )}
              </div>

              {/* Refined Information */}
              <div>
                <Label>Refined by AI</Label>
                <Card className="mt-2">
                  <CardContent className="p-4 space-y-4">
                    <EditableField
                      type="input"
                      value={task.refinedTitle || ""}
                      onSave={onSaveRefinedTitle}
                      label="Refined Title"
                      placeholder="AI will generate a refined title"
                      emptyText="Click to add a refined title"
                      maxLength={255}
                    />
                    <EditableField
                      type="textarea"
                      value={task.refinedDescription || ""}
                      onSave={onSaveRefinedDescription}
                      label="Refined Description"
                      placeholder="AI will generate a refined description"
                      emptyText="Click to add a refined description"
                      rows={6}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Creation Date */}
              <div>
                <Label>Created</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(task.createdAt), "PPP 'at' p")}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Dependencies Tab */}
          <TabsContent value="dependencies" className="mt-0">
            <div className="space-y-6">
              {/* Current Dependencies */}
              {dependencyData?.dependencies && dependencyData.dependencies.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Current Dependencies ({dependencyData.dependencies.length})</Label>
                  <div className="mt-2 space-y-2">
                    {dependencyData.dependencies.map((dep) => {
                      const isCompleted = dep.list === 'done';
                      const isBlocking = !isCompleted;

                      return (
                        <Card key={dep.id} className={cn(
                          "p-3",
                          isCompleted
                            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                            : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {isBlocking ? (
                                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                  {dep.refinedTitle || dep.rawTitle}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      isCompleted
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                    )}
                                  >
                                    {dep.list}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    P{dep.priority}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                const currentDependencyIds = dependencyData?.dependencies?.map(d => d.id) || [];
                                const newIds = currentDependencyIds.filter(id => id !== dep.id);
                                onDependencySelectionChange(newIds);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Blocked Status Warning */}
              {dependencyData?.dependencies && dependencyData.dependencies.some(dep => dep.list !== 'done') && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Lock className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                    <span className="font-medium text-sm">Task is blocked</span>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    This task cannot start until all dependencies are completed
                  </p>
                </div>
              )}

              {/* Add Dependencies */}
              <div>
                <Label className="text-sm font-medium">Manage Dependencies</Label>
                <div className="mt-2">
                  <TaskDependencySelector
                    availableTasks={availableTasks}
                    selectedDependencyIds={dependencyData?.dependencies?.map(d => d.id) || []}
                    onSelectionChange={onDependencySelectionChange}
                    placeholder="Select tasks that must be completed first..."
                    maxSelections={10}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Add or remove task dependencies. This task will be blocked until all dependencies are completed.
                </p>
              </div>

              {/* Dependents */}
              {dependencyData?.dependents && dependencyData.dependents.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Tasks Depending on This ({dependencyData.dependents.length})</Label>
                  <div className="mt-2 space-y-2">
                    {dependencyData.dependents.map((dependent) => (
                      <Card key={dependent.id} className="p-3 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {dependent.refinedTitle || dependent.rawTitle}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                                {dependent.list}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                P{dependent.priority}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    These tasks are waiting for this task to be completed
                  </p>
                </div>
              )}

              {/* Dependency Graph Visualization */}
              {(dependencyData?.dependencies && dependencyData.dependencies.length > 0) ||
               (dependencyData?.dependents && dependencyData.dependents.length > 0) ? (
                <div>
                  <Label className="text-sm font-medium">Dependency Flow</Label>
                  <div className="mt-2 border rounded-lg p-4 bg-muted/50">
                    <TaskDependencyGraph
                      currentTask={{
                        id: task.id,
                        rawTitle: task.rawTitle,
                        refinedTitle: task.refinedTitle || undefined,
                        list: task.list as any,
                        priority: task.priority
                      }}
                      dependencies={dependencyData?.dependencies?.map(dep => ({
                        ...dep,
                        refinedTitle: dep.refinedTitle || undefined
                      }))}
                      dependents={dependencyData?.dependents?.map(dep => ({
                        ...dep,
                        refinedTitle: dep.refinedTitle || undefined
                      }))}
                      onTaskClick={(taskId) => {
                        // Could implement navigation to other tasks here
                        console.log('Navigate to task:', taskId);
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Empty State */
                <div className="text-center py-8 text-muted-foreground">
                  <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No dependencies configured</p>
                  <p className="text-xs mt-1">Use the selector above to add task dependencies</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Plan Tab */}
          <TabsContent value="plan" className="mt-0">
            <div className="space-y-4">
              <EditableField
                type="textarea"
                value={(() => {
                  if (!task.plan) return "";
                  if (typeof task.plan === 'string') return task.plan;
                  if (typeof task.plan === 'object') return JSON.stringify(task.plan, null, 2);
                  return String(task.plan);
                })()}
                onSave={onSavePlan}
                label="Agent Plan"
                placeholder="AI will generate a plan when the task is picked up"
                emptyText="Click to add a plan"
                rows={12}
                displayClassName="font-mono text-sm bg-muted/50"
                editClassName="font-mono text-sm"
              />
            </div>
          </TabsContent>

          {/* Check Mode Tab - Only visible for tasks in check list */}
          {task.list === 'check' && (
            <TabsContent value="check" className="mt-0">
              <div className="space-y-6">
                {/* Approval Controls */}
                <TaskApprovalControls task={task} />
                
                <Separator />
                
                {/* Iteration History */}
                <TaskIterationHistory iterations={task.iterations || []} />
              </div>
            </TabsContent>
          )}

          {/* Attachments Tab */}
          <TabsContent value="attachments" className="mt-0">
            <div className="space-y-6">
              {/* Upload new attachments */}
              <TaskAttachmentUpload taskId={task.id} projectId={task.projectId} />

              {/* Existing attachments */}
              <AttachmentList
                attachments={Array.isArray(task.attachments) ? task.attachments : []}
                taskId={task.id}
                showDelete={true}
                compact={false}
                onDelete={onDeleteAttachment}
              />
            </div>
          </TabsContent>

          {/* V2 Enhanced Settings Tab */}
          <TabsContent value="settings" className="mt-0">
            <div className="space-y-6">
              {/* Task List and Priority */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Task List</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>List</Label>
                      <Select value={task.list} onValueChange={onListChange}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {listOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Priority</Label>
                      <Select value={task.priority.toString()} onValueChange={onPriorityChange}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getPriorityOptions().map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(task.list === "todo" || (task.list === "doing" && task.mode === "talk")) && (
                    <div>
                      <Label>Mode</Label>
                      <div className="mt-1">
                        <TaskModeSelector
                          mode={task.mode || null}
                          list={task.list}
                          onModeChange={onModeChange}
                          size="md"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* V2 Repository Configuration */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Repository Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Main Repository</Label>
                    <Select
                      value={task.mainRepositoryId || ""}
                      onValueChange={onMainRepositoryChange}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select main repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {repositories.map((repo: any) => (
                          <SelectItem key={repo.id} value={repo.id}>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-3 w-3" />
                              <span>{repo.name}</span>
                              {repo.isDefault && (
                                <Badge variant="outline" className="text-xs">Default</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Primary working directory where agents will execute the task
                    </p>
                  </div>

                  <div>
                    <Label>Additional Repositories</Label>
                    <div className="mt-1">
                      <MultiSelectRepositories
                        repositories={repositories.map(r => ({
                          ...r,
                          isDefault: r.isDefault ?? undefined,
                          maxConcurrencyLimit: r.maxConcurrencyLimit ?? undefined,
                        }))}
                        selectedRepositoryIds={task.additionalRepositoryIds || []}
                        mainRepositoryId={task.mainRepositoryId}
                        onSelectionChange={onAdditionalRepositoriesChange}
                        placeholder="Select additional repositories..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* V2 Agent Assignment */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Agent Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Assigned Agents</Label>
                    <div className="mt-1">
                      <MultiSelectAgents
                        agents={agents.map(a => ({
                          ...a,
                          maxConcurrencyLimit: a.maxConcurrencyLimit ?? undefined,
                        }))}
                        selectedAgentIds={task.assignedAgentIds || []}
                        onSelectionChange={onAssignedAgentsChange}
                        placeholder="Select agents to work on this task..."
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Actor (Optional)</Label>
                    <Select
                      value={task.actorId || ""}
                      onValueChange={onActorChange}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Use default actor" />
                      </SelectTrigger>
                      <SelectContent>
                        {actors.map((actor: Actor) => (
                          <SelectItem key={actor.id} value={actor.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              <span>{actor.name}</span>
                              {actor.isDefault && (
                                <Badge variant="outline" className="text-xs">Default</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Agent personality and methodology for this task
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Session Link */}
              <div className="space-y-2">
                <ClaudeCodeSessionLink
                  taskId={task.id}
                  activeSession={(task as any).activeSession}
                  repoAgentClientType={task.assignedAgents?.[0]?.agentType}
                />
              </div>

              <Separator />

              {/* Danger Zone */}
              <div className="pt-4">
                <Button
                  variant="destructive"
                  onClick={onDeleteTask}
                  className="w-full h-11 min-h-[44px] touch-manipulation"
                >
                  <Trash2 className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                  Delete Task
                </Button>
              </div>
            </div>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
