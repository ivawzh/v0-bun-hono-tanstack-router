/**
 * V2 Enhanced Task Creation Form
 * Task creation with multi-repo and multi-agent support
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAgents } from './multi-select-agents';
import { MultiSelectRepositories } from './multi-select-repositories';
import { AttachmentDropzone } from '@/components/attachment-dropzone';
import { Badge } from '@/components/ui/badge';
import { Folder, Users, Infinity, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface EnhancedTaskFormProps {
  repositories: Repository[];
  agents: Agent[];
  actors: Actor[];
  onSubmit: (task: {
    rawTitle: string;
    rawDescription?: string;
    mainRepositoryId: string;
    additionalRepositoryIds: string[];
    assignedAgentIds: string[];
    actorId?: string;
    priority: number;
    ready: boolean;
    status: 'todo' | 'loop';
    attachments: any[];
  }) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export function EnhancedTaskForm({
  repositories,
  agents,
  actors,
  onSubmit,
  onCancel,
  loading = false
}: EnhancedTaskFormProps) {
  const [formData, setFormData] = useState({
    rawTitle: '',
    rawDescription: '',
    mainRepositoryId: '',
    additionalRepositoryIds: [] as string[],
    assignedAgentIds: [] as string[],
    actorId: '',
    priority: 3,
    ready: false,
    status: 'todo' as 'todo' | 'loop',
    attachments: [] as any[]
  });

  const defaultRepository = repositories.find(repo => repo.isDefault);
  const defaultActor = actors.find(actor => actor.isDefault);

  // Set defaults when they become available
  if (defaultRepository && !formData.mainRepositoryId) {
    setFormData(prev => ({ ...prev, mainRepositoryId: defaultRepository.id }));
  }
  if (defaultActor && !formData.actorId) {
    setFormData(prev => ({ ...prev, actorId: defaultActor.id }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const selectedMainRepository = repositories.find(repo => repo.id === formData.mainRepositoryId);
  const selectedActor = actors.find(actor => actor.id === formData.actorId);

  const priorityLabels = {
    1: 'Lowest',
    2: 'Low',
    3: 'Medium',
    4: 'High',
    5: 'Highest'
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Task Type Selection */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Task Type
          </CardTitle>
          <CardDescription>
            Choose whether this is a regular task or a repeatable loop task
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div 
              className={cn(
                "p-3 border rounded-lg cursor-pointer transition-colors",
                formData.status === 'todo' 
                  ? "border-primary bg-primary/5" 
                  : "border-muted hover:border-muted-foreground/50"
              )}
              onClick={() => setFormData(prev => ({ ...prev, status: 'todo' }))}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 rounded border border-primary flex items-center justify-center">
                  {formData.status === 'todo' && (
                    <div className="h-2 w-2 rounded bg-primary" />
                  )}
                </div>
                <span className="font-medium">Regular Task</span>
              </div>
              <p className="text-xs text-muted-foreground">
                One-time task: Todo → Doing → Done
              </p>
            </div>

            <div 
              className={cn(
                "p-3 border rounded-lg cursor-pointer transition-colors",
                formData.status === 'loop' 
                  ? "border-primary bg-primary/5" 
                  : "border-muted hover:border-muted-foreground/50"
              )}
              onClick={() => setFormData(prev => ({ ...prev, status: 'loop' }))}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 rounded border border-primary flex items-center justify-center">
                  {formData.status === 'loop' && (
                    <div className="h-2 w-2 rounded bg-primary" />
                  )}
                </div>
                <span className="font-medium flex items-center gap-1">
                  <Infinity className="h-3 w-3" />
                  Loop Task
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Repeatable: Loop → Doing → Loop...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Task Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="rawTitle">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rawTitle"
              value={formData.rawTitle}
              onChange={(e) => setFormData(prev => ({ ...prev, rawTitle: e.target.value }))}
              placeholder={
                formData.status === 'loop' 
                  ? "Brainstorm new feature ideas. Document in wiki."
                  : "Add user authentication"
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="rawDescription">Description (Optional)</Label>
            <Textarea
              id="rawDescription"
              value={formData.rawDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, rawDescription: e.target.value }))}
              placeholder={
                formData.status === 'loop'
                  ? "Regular brainstorming session to generate and document new feature ideas in the project wiki."
                  : "Implement login functionality with email/password authentication"
              }
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority.toString()}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  priority: parseInt(value) 
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      P{value} - {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="actorId">Actor</Label>
              <Select
                value={formData.actorId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, actorId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select actor..." />
                </SelectTrigger>
                <SelectContent>
                  {actors.map((actor) => (
                    <SelectItem key={actor.id} value={actor.id}>
                      {actor.name} {actor.isDefault && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Repository Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Repository Configuration
          </CardTitle>
          <CardDescription>
            Select the main repository and any additional working directories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="mainRepositoryId">
              Main Repository <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.mainRepositoryId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, mainRepositoryId: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select main repository..." />
              </SelectTrigger>
              <SelectContent>
                {repositories.map((repo) => (
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
            {selectedMainRepository && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedMainRepository.repoPath}
              </p>
            )}
          </div>

          <div>
            <Label>Additional Repositories (Optional)</Label>
            <MultiSelectRepositories
              repositories={repositories}
              selectedRepositoryIds={formData.additionalRepositoryIds}
              mainRepositoryId={formData.mainRepositoryId}
              onSelectionChange={(ids) => setFormData(prev => ({ 
                ...prev, 
                additionalRepositoryIds: ids 
              }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Agent Assignment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agent Assignment
          </CardTitle>
          <CardDescription>
            Assign agents that can work on this task
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>
              Assigned Agents <span className="text-destructive">*</span>
            </Label>
            <MultiSelectAgents
              agents={agents}
              selectedAgentIds={formData.assignedAgentIds}
              onSelectionChange={(ids) => setFormData(prev => ({ 
                ...prev, 
                assignedAgentIds: ids 
              }))}
              placeholder="Select agents to assign..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Attachments</CardTitle>
          <CardDescription>
            Add files, images, or documents to help with task execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttachmentDropzone
            onFilesSelected={(files) => setFormData(prev => ({ 
              ...prev, 
              attachments: [...prev.attachments, ...files] 
            }))}
            maxFiles={5}
            maxSize={10 * 1024 * 1024} // 10MB
          />
        </CardContent>
      </Card>

      {/* Task Summary */}
      {(selectedMainRepository || selectedActor || formData.assignedAgentIds.length > 0) && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Task Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={formData.status === 'loop' ? 'secondary' : 'default'}>
                {formData.status === 'loop' ? (
                  <>
                    <Infinity className="h-3 w-3 mr-1" />
                    Loop Task
                  </>
                ) : (
                  'Regular Task'
                )}
              </Badge>
              <Badge variant="outline">
                P{formData.priority} - {priorityLabels[formData.priority as keyof typeof priorityLabels]}
              </Badge>
            </div>
            
            {selectedMainRepository && (
              <p className="text-sm text-muted-foreground">
                <strong>Main Repository:</strong> {selectedMainRepository.name}
              </p>
            )}
            
            {formData.additionalRepositoryIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                <strong>Additional Repositories:</strong> {formData.additionalRepositoryIds.length} selected
              </p>
            )}
            
            {formData.assignedAgentIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                <strong>Assigned Agents:</strong> {formData.assignedAgentIds.length} selected
              </p>
            )}
            
            {selectedActor && (
              <p className="text-sm text-muted-foreground">
                <strong>Actor:</strong> {selectedActor.name}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ready Checkbox */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ready"
              checked={formData.ready}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                ready: !!checked 
              }))}
            />
            <Label htmlFor="ready" className="flex items-center gap-2">
              Mark as ready for AI pickup
              {formData.ready && <Badge variant="outline" className="text-xs">Ready</Badge>}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            {formData.ready 
              ? "Task will be automatically picked up by available agents"
              : "Task will be created but won't be assigned until marked ready"
            }
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={
            loading || 
            !formData.rawTitle || 
            !formData.mainRepositoryId || 
            formData.assignedAgentIds.length === 0
          }
        >
          {loading ? 'Creating...' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}