/**
 * V2 Task Dependency Graph Component
 * Simple lightweight dependency visualization showing task relationships
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CheckCircle, Lock, GitBranch, ArrowRight, ArrowDown } from 'lucide-react';

interface Task {
  id: string;
  rawTitle: string;
  refinedTitle?: string;
  status: 'todo' | 'doing' | 'done' | 'loop';
  priority: number;
}

interface TaskDependencyGraphProps {
  currentTask: Task;
  dependencies?: Task[];
  dependents?: Task[];
  className?: string;
  onTaskClick?: (taskId: string) => void;
}

export function TaskDependencyGraph({
  currentTask,
  dependencies = [],
  dependents = [],
  className,
  onTaskClick
}: TaskDependencyGraphProps) {
  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return 'text-red-600 bg-red-50 border-red-200';
    if (priority >= 4) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (priority >= 3) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'doing': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'done': return 'bg-green-100 text-green-700 border-green-300';
      case 'loop': return 'bg-purple-100 text-purple-700 border-purple-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle className="h-3 w-3" />;
      case 'todo': 
      case 'doing':
      case 'loop':
      default: return <Lock className="h-3 w-3" />;
    }
  };

  const TaskNode: React.FC<{
    task: Task;
    isCurrent?: boolean;
    isClickable?: boolean;
  }> = ({ task, isCurrent = false, isClickable = true }) => (
    <Card
      className={cn(
        "p-3 transition-all duration-200",
        isCurrent 
          ? "ring-2 ring-blue-500 bg-blue-50 border-blue-300" 
          : "hover:shadow-md",
        isClickable && onTaskClick && "cursor-pointer"
      )}
      onClick={() => isClickable && onTaskClick?.(task.id)}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn(
            "font-medium text-sm leading-tight",
            isCurrent ? "text-blue-900" : "text-gray-900"
          )}>
            {task.refinedTitle || task.rawTitle}
          </h4>
          {task.status !== 'done' && (
            <Lock className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
          )}
          {task.status === 'done' && (
            <CheckCircle className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Badge 
            variant="outline" 
            className={cn("text-xs", getStatusColor(task.status))}
          >
            {task.status}
          </Badge>
          <Badge 
            variant="outline" 
            className={cn("text-xs", getPriorityColor(task.priority))}
          >
            P{task.priority}
          </Badge>
        </div>
      </div>
    </Card>
  );

  const hasAnyDependencies = dependencies.length > 0 || dependents.length > 0;

  if (!hasAnyDependencies) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No task dependencies</p>
        <p className="text-xs mt-1">This task has no dependencies or dependents</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Dependencies Section */}
      {dependencies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ArrowDown className="h-4 w-4" />
            <span>Dependencies ({dependencies.length})</span>
          </div>
          
          <div className="grid gap-2">
            {dependencies.map((dep) => (
              <TaskNode key={dep.id} task={dep} />
            ))}
          </div>
          
          {/* Flow arrow */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-px bg-gray-300"></div>
              <ArrowDown className="h-3 w-3" />
              <div className="w-4 h-px bg-gray-300"></div>
            </div>
          </div>
        </div>
      )}

      {/* Current Task */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
          <GitBranch className="h-4 w-4" />
          <span>Current Task</span>
        </div>
        
        <TaskNode task={currentTask} isCurrent={true} isClickable={false} />
      </div>

      {/* Dependents Section */}
      {dependents.length > 0 && (
        <div className="space-y-3">
          {/* Flow arrow */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-px bg-gray-300"></div>
              <ArrowDown className="h-3 w-3" />
              <div className="w-4 h-px bg-gray-300"></div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ArrowRight className="h-4 w-4" />
            <span>Blocked Tasks ({dependents.length})</span>
          </div>
          
          <div className="grid gap-2">
            {dependents.map((dependent) => (
              <TaskNode key={dependent.id} task={dependent} />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="border-t pt-4 mt-6">
        <h5 className="text-xs font-medium text-gray-600 mb-2">Legend</h5>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span className="text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-amber-500" />
            <span className="text-gray-600">Blocking</span>
          </div>
        </div>
      </div>
    </div>
  );
}