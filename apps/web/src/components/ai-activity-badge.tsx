import { Clock, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AIActivityBadgeProps {
  ready: boolean | null;
  agentSessionStatus?: 'INACTIVE' | 'PUSHING' | 'ACTIVE' | null;
  status: string;
  className?: string;
}

export function AIActivityBadge({ ready, agentSessionStatus, status, className }: AIActivityBadgeProps) {
  // Don't show badge for done tasks or when not ready
  if (status === "done" || !ready) {
    return null;
  }

  // AI Working state - highest priority
  if (agentSessionStatus === 'ACTIVE') {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-green-100 text-green-800 border-green-200 flex items-center gap-1",
          className
        )}
      >
        <Zap className="h-3 w-3 animate-pulse" />
        AI in work
      </Badge>
    );
  }

  // AI Ready state - only for todo tasks that are ready but AI not working  
  if (status === "todo" && ready === true && (agentSessionStatus === 'INACTIVE' || agentSessionStatus === null)) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1",
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Queueing
      </Badge>
    );
  }

  // No badge for other states
  return null;
}
