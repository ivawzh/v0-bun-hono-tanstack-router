import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface ClaudeCodeSessionLinkProps {
  taskId: string;
  activeSession?: {
    id: string;
    agentSessionId: string | null;
    taskId: string | null;
    repoAgentId: string;
    startedAt: Date;
    completedAt: Date | null;
  } | null;
  repoAgentClientType?: string;
}

export function ClaudeCodeSessionLink({
  taskId,
  activeSession,
  repoAgentClientType
}: ClaudeCodeSessionLinkProps) {
  // Only show for Claude Code client type with active session
  const shouldShow = repoAgentClientType === "CLAUDE_CODE" &&
                     activeSession &&
                     activeSession.agentSessionId;

  if (!shouldShow) {
    return null;
  }

  const handleOpenClaudeCode = () => {
    // Open Claude Code UI in a new tab
    // Using port 8303 as specified in the project documentation
    const claudeCodeUrl = "http://localhost:8303/session/" + activeSession.agentSessionId;
    window.open(claudeCodeUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleOpenClaudeCode}
      className="gap-2"
    >
      <ExternalLink className="h-4 w-4" />
      Open in Claude Code
    </Button>
  );
}
