/**
 * V2 Project Setup Warning Component
 * Shows warning when project doesn't have repositories or agents configured
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Settings, FolderOpen, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProjectSetupWarningProps {
  hasRepositories: boolean;
  hasAgents: boolean;
  onOpenSettings: () => void;
  className?: string;
}

export function ProjectSetupWarning({
  hasRepositories,
  hasAgents,
  onOpenSettings,
  className
}: ProjectSetupWarningProps) {
  // Only show if missing either repositories or agents
  if (hasRepositories && hasAgents) {
    return null;
  }

  const missingItems = [];
  if (!hasRepositories) missingItems.push("repositories");
  if (!hasAgents) missingItems.push("agents");

  return (
    <Alert className={`border-yellow-200 bg-yellow-50 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-800">
            Project setup incomplete - missing{" "}
            {missingItems.map((item, index) => (
              <span key={item}>
                <Badge variant="outline" className="mx-1 text-yellow-700 border-yellow-300">
                  {item === "repositories" ? (
                    <>
                      <FolderOpen className="h-3 w-3 mr-1" />
                      repositories
                    </>
                  ) : (
                    <>
                      <Bot className="h-3 w-3 mr-1" />
                      agents
                    </>
                  )}
                </Badge>
                {index < missingItems.length - 1 && " and "}
              </span>
            ))}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
        >
          <Settings className="h-3 w-3 mr-1" />
          Configure Project
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Task Creation Warning - shown when trying to create task without proper setup
 */
interface TaskCreationWarningProps {
  hasRepositories: boolean;
  hasAgents: boolean;
  onOpenSettings: () => void;
  onCancel: () => void;
}

export function TaskCreationWarning({
  hasRepositories,
  hasAgents,
  onOpenSettings,
  onCancel
}: TaskCreationWarningProps) {
  const missingItems = [];
  if (!hasRepositories) missingItems.push("repositories");
  if (!hasAgents) missingItems.push("agents");

  if (missingItems.length === 0) {
    return null;
  }

  return (
    <Alert className="border-yellow-200 bg-yellow-50 mb-4">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription>
        <div className="space-y-3">
          <div className="text-yellow-800">
            <p className="font-medium mb-2">Cannot create task</p>
            <p className="text-sm">
              Tasks require both repositories and agents to be configured. 
              You're missing:
            </p>
            <ul className="text-sm mt-2 space-y-1">
              {!hasRepositories && (
                <li className="flex items-center gap-2">
                  <FolderOpen className="h-3 w-3" />
                  <span>
                    <strong>Repositories</strong> - Define where agents can work
                  </span>
                </li>
              )}
              {!hasAgents && (
                <li className="flex items-center gap-2">
                  <Bot className="h-3 w-3" />
                  <span>
                    <strong>Agents</strong> - AI workers that execute tasks
                  </span>
                </li>
              )}
            </ul>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onOpenSettings}
              className="bg-yellow-600 text-white hover:bg-yellow-700"
            >
              <Settings className="h-3 w-3 mr-1" />
              Configure Project First
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}