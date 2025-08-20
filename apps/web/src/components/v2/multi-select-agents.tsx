/**
 * V2 Multi-Select Agents Component
 * Multi-select dropdown for assigning agents to tasks
 */

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  agentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE';
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number;
}

interface MultiSelectAgentsProps {
  agents: Agent[];
  selectedAgentIds: string[];
  onSelectionChange: (agentIds: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelectAgents({
  agents,
  selectedAgentIds,
  onSelectionChange,
  placeholder = "Select agents...",
  className,
  disabled = false
}: MultiSelectAgentsProps) {
  const [open, setOpen] = useState(false);

  const selectedAgents = agents.filter(agent => selectedAgentIds.includes(agent.id));
  const availableAgents = agents.filter(agent => agent.isAvailable !== false);

  const handleSelect = (agentId: string) => {
    const isSelected = selectedAgentIds.includes(agentId);
    if (isSelected) {
      onSelectionChange(selectedAgentIds.filter(id => id !== agentId));
    } else {
      onSelectionChange([...selectedAgentIds, agentId]);
    }
  };

  const handleRemove = (agentId: string) => {
    onSelectionChange(selectedAgentIds.filter(id => id !== agentId));
  };

  const getAgentStatusColor = (agent: Agent) => {
    if (agent.isAvailable === false) return 'bg-red-100 text-red-800';
    if (agent.activeTaskCount && agent.activeTaskCount > 0) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getAgentStatusText = (agent: Agent) => {
    if (agent.isAvailable === false) return 'Busy';
    if (agent.activeTaskCount && agent.activeTaskCount > 0) return `${agent.activeTaskCount} active`;
    return 'Available';
  };

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-10"
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedAgents.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : selectedAgents.length === 1 ? (
                <span>{selectedAgents[0].agentType} ({selectedAgents[0].name})</span>
              ) : (
                <span>{selectedAgents.length} agents selected</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search agents..." />
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {availableAgents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={`${agent.name} ${agent.agentType}`}
                  onSelect={() => handleSelect(agent.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedAgentIds.includes(agent.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{agent.agentType} ({agent.name})</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getAgentStatusText(agent)}
                        {agent.maxConcurrencyLimit && (
                          <span> • Max: {agent.maxConcurrencyLimit}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={cn("text-xs", getAgentStatusColor(agent))}
                  >
                    {agent.isAvailable === false ? '⏸' : '▶'}
                  </Badge>
                </CommandItem>
              ))}
              {availableAgents.length !== agents.length && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t">
                    Unavailable Agents
                  </div>
                  {agents
                    .filter(agent => agent.isAvailable === false)
                    .map((agent) => (
                      <CommandItem
                        key={agent.id}
                        value={`${agent.name} ${agent.agentType}`}
                        disabled
                        className="opacity-50"
                      >
                        <div className="flex items-center">
                          <Check className="mr-2 h-4 w-4 opacity-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span>{agent.agentType} ({agent.name})</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getAgentStatusText(agent)}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                </>
              )}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected agents display */}
      {selectedAgents.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedAgents.map((agent) => (
            <Badge
              key={agent.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              <span className="text-xs">{agent.agentType} ({agent.name})</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleRemove(agent.id)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {selectedAgents.length === 0 && !disabled && (
        <p className="text-xs text-muted-foreground mt-1">
          Select at least one agent to assign this task to
        </p>
      )}
    </div>
  );
}