/**
 * V2 Task Dependency Selector Component
 * Multi-select dropdown for selecting task dependencies with search and filtering
 */

import { useState } from 'react';
import { Check, ChevronsUpDown, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  rawTitle: string;
  refinedTitle?: string;
  list: 'todo' | 'doing' | 'done' | 'loop';
  priority: number;
}

interface TaskDependencySelectorProps {
  availableTasks: Task[];
  selectedDependencyIds: string[];
  onSelectionChange: (dependencyIds: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxSelections?: number;
}

export function TaskDependencySelector({
  availableTasks,
  selectedDependencyIds,
  onSelectionChange,
  placeholder = "Select dependencies...",
  className,
  disabled = false,
  maxSelections
}: TaskDependencySelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedTasks = availableTasks.filter(task => selectedDependencyIds.includes(task.id));

  const handleSelect = (taskId: string) => {
    const isSelected = selectedDependencyIds.includes(taskId);
    if (isSelected) {
      onSelectionChange(selectedDependencyIds.filter(id => id !== taskId));
    } else {
      // Check max selections limit
      if (maxSelections && selectedDependencyIds.length >= maxSelections) {
        return;
      }
      onSelectionChange([...selectedDependencyIds, taskId]);
    }
  };

  const handleRemove = (taskId: string) => {
    onSelectionChange(selectedDependencyIds.filter(id => id !== taskId));
  };

  const getTaskListColor = (list: string) => {
    switch (list) {
      case 'todo': return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
      case 'doing': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'loop': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const getTaskListIcon = (list: string) => {
    switch (list) {
      case 'todo': return '⏸';
      case 'doing': return '▶';
      case 'loop': return '♻';
      default: return '⏸';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return 'text-red-600 dark:text-red-400';
    if (priority >= 4) return 'text-orange-600 dark:text-orange-400';
    if (priority >= 3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  // Group tasks by column for better organization
  const tasksByColumn = availableTasks.reduce((acc, task) => {
    if (!acc[task.column]) acc[task.column] = [];
    acc[task.column].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Sort tasks within each column by priority (descending), then by title
  Object.keys(tasksByColumn).forEach(column => {
    tasksByColumn[column].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return (a.refinedTitle || a.rawTitle).localeCompare(b.refinedTitle || b.rawTitle);
    });
  });

  const columnOrder = ['todo', 'doing', 'loop'];

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
              {selectedTasks.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : selectedTasks.length === 1 ? (
                <span className="truncate">
                  {selectedTasks[0].refinedTitle || selectedTasks[0].rawTitle}
                </span>
              ) : (
                <span>{selectedTasks.length} dependencies selected</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search tasks..." />
            <CommandEmpty>No tasks found.</CommandEmpty>
            <div className="max-h-64 overflow-auto">
              {columnOrder.map(column => {
                const tasks = tasksByColumn[column] || [];
                if (tasks.length === 0) return null;

                return (
                  <CommandGroup key={column} heading={column.charAt(0).toUpperCase() + column.slice(1)}>
                    {tasks.map((task) => {
                      const isSelected = selectedDependencyIds.includes(task.id);
                      const isDisabled = !isSelected && maxSelections ? selectedDependencyIds.length >= maxSelections : false;

                      return (
                        <CommandItem
                          key={task.id}
                          value={`${task.rawTitle} ${task.refinedTitle || ''}`}
                          onSelect={() => !isDisabled && handleSelect(task.id)}
                          className={cn(
                            "flex items-center justify-between",
                            isDisabled && "opacity-50 cursor-not-allowed"
                          )}
                          disabled={isDisabled}
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate">
                                  {task.refinedTitle || task.rawTitle}
                                </span>
                                <span className={cn("text-xs font-medium", getPriorityColor(task.priority))}>
                                  P{task.priority}
                                </span>
                              </div>
                              {task.refinedTitle && task.rawTitle !== task.refinedTitle && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {task.rawTitle}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn("text-xs ml-2 shrink-0", getTaskListColor(task.list))}
                          >
                            {getTaskListIcon(task.list)}
                          </Badge>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected dependencies display */}
      {selectedTasks.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedTasks.map((task) => (
            <Badge
              key={task.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1 max-w-xs"
            >
              <span className="text-xs truncate">
                {task.refinedTitle || task.rawTitle}
              </span>
              <span className={cn("text-xs font-medium", getPriorityColor(task.priority))}>
                P{task.priority}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleRemove(task.id)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Helper text */}
      {selectedTasks.length === 0 && !disabled && (
        <p className="text-xs text-muted-foreground mt-1">
          Select tasks that must be completed before this task can start
        </p>
      )}

      {/* Max selections warning */}
      {maxSelections && selectedDependencyIds.length >= maxSelections && (
        <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
          <AlertCircle className="h-3 w-3" />
          Maximum {maxSelections} dependencies reached
        </div>
      )}
    </div>
  );
}
