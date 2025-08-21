import { Clock, AlertTriangle, ExternalLink, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  agentType: string;
  rateLimitResetAt?: string | null;
}

interface RateLimitInfo {
  agent: Agent;
  resetTime: Date;
  remainingMs: number;
}

interface RateLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateLimitedAgents: RateLimitInfo[];
  currentTime: Date;
}

function formatDetailedTime(ms: number): string {
  if (ms <= 0) return "Available now";
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  }
  
  if (hours === 0 && minutes < 5) {
    parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  }
  
  return parts.join(', ');
}

function getAgentDisplayName(agent: Agent): string {
  switch (agent.agentType) {
    case 'CLAUDE_CODE':
      return 'Claude Code';
    case 'CURSOR_CLI':
      return 'Cursor CLI';
    case 'OPENCODE':
      return 'OpenCode';
    default:
      return agent.name || agent.agentType;
  }
}

export function RateLimitModal({
  open,
  onOpenChange,
  rateLimitedAgents,
  currentTime
}: RateLimitModalProps) {
  // Recalculate remaining time with current time for live updates
  const updatedAgents = rateLimitedAgents.map(info => ({
    ...info,
    remainingMs: info.resetTime.getTime() - currentTime.getTime()
  })).filter(info => info.remainingMs > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-sm:h-[90vh] max-sm:flex max-sm:flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Rate Limited Agents
          </DialogTitle>
          <DialogDescription>
            {updatedAgents.length === 1 
              ? "Your agent is temporarily rate limited and cannot process new tasks."
              : `${updatedAgents.length} agents are temporarily rate limited and cannot process new tasks.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-sm:flex-1 max-sm:overflow-y-auto">
          {/* Agent Status Cards */}
          <div className="space-y-3">
            {updatedAgents.map((info) => (
              <div 
                key={info.agent.id}
                className="rounded-lg border bg-amber-50 border-amber-200 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-white text-amber-800 border-amber-300">
                      {getAgentDisplayName(info.agent)}
                    </Badge>
                  </div>
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                
                <div className="text-sm text-amber-800">
                  <div className="font-medium">
                    Available in {formatDetailedTime(info.remainingMs)}
                  </div>
                  <div className="text-xs text-amber-600 mt-1">
                    Resets at {info.resetTime.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Information Alert */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p>
                  <strong>What this means:</strong> Claude Code has usage limits that reset periodically. 
                  During rate limits, agents cannot start new tasks.
                </p>
                <p>
                  <strong>What you can do:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs ml-2">
                  <li>Wait for the rate limit to reset automatically</li>
                  <li>Continue working on tasks that are already in progress</li>
                  <li>Set up multiple Claude Code accounts for redundancy</li>
                  <li>Review and refine task descriptions while waiting</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open('https://docs.anthropic.com/en/docs/claude-code', '_blank');
              }}
              className="w-full flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Learn about Claude Code limits
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                // Could trigger opening project settings to agents tab
              }}
              className="w-full flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Manage Agents
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}