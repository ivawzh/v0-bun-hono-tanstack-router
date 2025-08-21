import { useEffect, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RateLimitModal } from './rate-limit-modal';

interface RateLimitIndicatorProps {
  agents: Array<{
    id: string;
    name: string;
    agentType: string;
    rateLimitResetAt: Date | null;
  }>;
  className?: string;
}

interface CountdownState {
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

function useCountdown(targetDate: Date | null): CountdownState {
  const [countdown, setCountdown] = useState<CountdownState>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: true,
  });

  useEffect(() => {
    if (!targetDate) {
      setCountdown({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;

      if (difference <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setCountdown({ hours, minutes, seconds, isExpired: false });
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return countdown;
}

function formatCountdown(countdown: CountdownState): string {
  if (countdown.isExpired) return 'Available';

  const parts: string[] = [];
  
  if (countdown.hours > 0) {
    parts.push(`${countdown.hours}h`);
  }
  
  if (countdown.minutes > 0 || countdown.hours > 0) {
    parts.push(`${countdown.minutes}m`);
  }
  
  // Only show seconds if less than 1 minute remaining
  if (countdown.hours === 0 && countdown.minutes === 0) {
    parts.push(`${countdown.seconds}s`);
  }

  return parts.join(' ');
}

export function RateLimitIndicator({ agents, className }: RateLimitIndicatorProps) {
  const [showModal, setShowModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Find agents that are currently rate limited
  const rateLimitedAgents = agents.filter(agent => {
    if (!agent.rateLimitResetAt) return false;
    return agent.rateLimitResetAt > currentTime;
  });

  // Don't render if no agents are rate limited
  if (rateLimitedAgents.length === 0) {
    return null;
  }

  // Convert to the format expected by modal
  const rateLimitInfo = rateLimitedAgents.map(agent => ({
    agent: {
      ...agent,
      rateLimitResetAt: agent.rateLimitResetAt!.toISOString()
    },
    resetTime: agent.rateLimitResetAt!,
    remainingMs: agent.rateLimitResetAt!.getTime() - currentTime.getTime()
  })).sort((a, b) => a.remainingMs - b.remainingMs);

  const shortestLimit = rateLimitInfo[0];
  const remainingMs = shortestLimit.remainingMs;

  // Format display text
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  let displayText: string;
  let mobileText: string;

  if (rateLimitedAgents.length === 1) {
    const agentName = shortestLimit.agent.agentType === 'CLAUDE_CODE' ? 'Claude Code' : shortestLimit.agent.agentType;
    if (hours > 0) {
      displayText = `${agentName}: ${hours}h ${minutes}m`;
      mobileText = `${hours}h ${minutes}m`;
    } else {
      displayText = `${agentName}: ${minutes}m`;
      mobileText = `${minutes}m`;
    }
  } else {
    if (hours > 0) {
      displayText = `${rateLimitedAgents.length} agents: ${hours}h ${minutes}m`;
      mobileText = `${rateLimitedAgents.length}:${hours}h`;
    } else {
      displayText = `${rateLimitedAgents.length} agents: ${minutes}m`;
      mobileText = `${rateLimitedAgents.length}:${minutes}m`;
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowModal(true)}
        className={cn(
          "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
          "flex items-center gap-1.5 min-h-[44px] touch-manipulation",
          "transition-all duration-200",
          className
        )}
        aria-label={`${rateLimitedAgents.length} agent${rateLimitedAgents.length === 1 ? '' : 's'} rate limited. Click for details.`}
      >
        <Clock className="h-3.5 w-3.5 animate-pulse" />
        <span className="hidden md:inline text-xs font-medium">
          {displayText}
        </span>
        <span className="md:hidden text-xs font-medium">
          {mobileText}
        </span>
      </Button>

      <RateLimitModal
        open={showModal}
        onOpenChange={setShowModal}
        rateLimitedAgents={rateLimitInfo}
        currentTime={currentTime}
      />
    </>
  );
}

interface RateLimitBadgeProps {
  agent: {
    id: string;
    name: string;
    agentType: string;
    rateLimitResetAt: Date | null;
  };
}

function RateLimitBadge({ agent }: RateLimitBadgeProps) {
  const resetDate = agent.rateLimitResetAt;
  const countdown = useCountdown(resetDate);

  // If the countdown has expired, don't render the badge
  if (countdown.isExpired) {
    return null;
  }

  const displayName = agent.name || agent.agentType.replace('_', ' ');
  const countdownText = formatCountdown(countdown);

  return (
    <Badge
      variant="outline"
      className={cn(
        "bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-2 max-w-fit",
        "hover:bg-amber-100 transition-colors cursor-default"
      )}
    >
      <Clock className="h-3 w-3 flex-shrink-0" />
      <span className="text-xs font-medium truncate">
        {displayName}: {countdownText}
      </span>
      <RefreshCw className="h-3 w-3 flex-shrink-0 text-amber-600" />
    </Badge>
  );
}