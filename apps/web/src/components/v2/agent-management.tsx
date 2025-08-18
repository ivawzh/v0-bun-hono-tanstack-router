/**
 * V2 Agent Management Interface
 * User-owned agent management for V2 architecture
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Settings, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Agent {
  id: string;
  name: string;
  agentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE';
  agentSettings: Record<string, any>;
  maxConcurrencyLimit: number;
  state: Record<string, any>;
  activeTaskCount?: number;
  totalTaskCount?: number;
  isAvailable?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentManagementProps {
  agents: Agent[];
  onCreateAgent: (agent: Omit<Agent, 'id' | 'state' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  onDeleteAgent: (id: string) => Promise<void>;
  loading?: boolean;
}

export function AgentManagement({
  agents,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
  loading = false
}: AgentManagementProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Your Agents</h2>
          <p className="text-muted-foreground">
            Manage your personal AI agents for task execution
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Configure a new AI agent for task execution
              </DialogDescription>
            </DialogHeader>
            <CreateAgentForm
              onSubmit={async (agent) => {
                await onCreateAgent(agent);
                setShowCreateDialog(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No agents configured</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first agent to start executing tasks automatically
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => setEditingAgent(agent)}
              onDelete={() => onDeleteAgent(agent.id)}
            />
          ))}
        </div>
      )}

      {editingAgent && (
        <Dialog open={!!editingAgent} onOpenChange={() => setEditingAgent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Agent</DialogTitle>
              <DialogDescription>
                Update agent configuration and settings
              </DialogDescription>
            </DialogHeader>
            <EditAgentForm
              agent={editingAgent}
              onSubmit={async (updates) => {
                await onUpdateAgent(editingAgent.id, updates);
                setEditingAgent(null);
              }}
              onCancel={() => setEditingAgent(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onEdit,
  onDelete
}: {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isRateLimited = agent.state?.rateLimitResetAt &&
    new Date(agent.state.rateLimitResetAt) > new Date();

  const getStatusBadge = () => {
    if (isRateLimited) {
      return <Badge variant="destructive">Rate Limited</Badge>;
    }
    if (agent.isAvailable) {
      return <Badge variant="default">Available</Badge>;
    }
    if (agent.activeTaskCount && agent.activeTaskCount > 0) {
      return <Badge variant="secondary">Working</Badge>;
    }
    return <Badge variant="outline">Idle</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{agent.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              {agent.agentType}
              {getStatusBadge()}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Concurrency:</span>
          <span>{agent.maxConcurrencyLimit}</span>
        </div>
        {typeof agent.activeTaskCount !== 'undefined' && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Active Tasks:</span>
            <span>{agent.activeTaskCount}</span>
          </div>
        )}
        {typeof agent.totalTaskCount !== 'undefined' && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Tasks:</span>
            <span>{agent.totalTaskCount}</span>
          </div>
        )}
        {agent.agentSettings.CLAUDE_CONFIG_DIR && (
          <div className="text-xs text-muted-foreground">
            Config: {agent.agentSettings.CLAUDE_CONFIG_DIR}
          </div>
        )}
        {isRateLimited && (
          <Alert>
            <AlertDescription className="text-xs">
              Rate limited until {new Date(agent.state.rateLimitResetAt).toLocaleTimeString()}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function CreateAgentForm({
  onSubmit
}: {
  onSubmit: (agent: Omit<Agent, 'id' | 'state' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    name: '',
    agentType: 'CLAUDE_CODE' as const,
    maxConcurrencyLimit: 1,
    claudeConfigDir: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const agentSettings: Record<string, any> = {};
    if (formData.claudeConfigDir) {
      agentSettings.CLAUDE_CONFIG_DIR = formData.claudeConfigDir;
    }

    await onSubmit({
      name: formData.name,
      agentType: formData.agentType,
      agentSettings,
      maxConcurrencyLimit: formData.maxConcurrencyLimit
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Agent Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="My Claude Agent"
          required
        />
      </div>

      <div>
        <Label htmlFor="agentType">Agent Type</Label>
        <Select
          value={formData.agentType}
          onValueChange={(value: 'CLAUDE_CODE') =>
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

      <div>
        <Label htmlFor="maxConcurrencyLimit">Max Concurrent Tasks</Label>
        <Input
          id="maxConcurrencyLimit"
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
        <div>
          <Label htmlFor="claudeConfigDir">Claude Config Directory (Optional)</Label>
          <Input
            id="claudeConfigDir"
            value={formData.claudeConfigDir}
            onChange={(e) => setFormData(prev => ({ ...prev, claudeConfigDir: e.target.value }))}
            placeholder="/home/user/.claude-pro"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use different Claude accounts by specifying config directory
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit">Create Agent</Button>
      </div>
    </form>
  );
}

function EditAgentForm({
  agent,
  onSubmit,
  onCancel
}: {
  agent: Agent;
  onSubmit: (updates: Partial<Agent>) => Promise<void>;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: agent.name,
    maxConcurrencyLimit: agent.maxConcurrencyLimit,
    claudeConfigDir: agent.agentSettings.CLAUDE_CONFIG_DIR || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const agentSettings = { ...agent.agentSettings };
    if (formData.claudeConfigDir) {
      agentSettings.CLAUDE_CONFIG_DIR = formData.claudeConfigDir;
    } else {
      delete agentSettings.CLAUDE_CONFIG_DIR;
    }

    await onSubmit({
      name: formData.name,
      agentSettings,
      maxConcurrencyLimit: formData.maxConcurrencyLimit
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Agent Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div>
        <Label htmlFor="maxConcurrencyLimit">Max Concurrent Tasks</Label>
        <Input
          id="maxConcurrencyLimit"
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

      {agent.agentType === 'CLAUDE_CODE' && (
        <div>
          <Label htmlFor="claudeConfigDir">Claude Config Directory</Label>
          <Input
            id="claudeConfigDir"
            value={formData.claudeConfigDir}
            onChange={(e) => setFormData(prev => ({ ...prev, claudeConfigDir: e.target.value }))}
            placeholder="/home/user/.claude-pro"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Update Agent</Button>
      </div>
    </form>
  );
}
