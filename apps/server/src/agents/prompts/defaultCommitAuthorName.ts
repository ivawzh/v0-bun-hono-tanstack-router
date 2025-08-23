import type { AgentType } from "@/db/schema";

const ourName = 'Solo Unicorn!';

/**
 * Convert agent type enum to user-friendly display name
 */
export function defaultCommitAuthorName(agentType: AgentType): string {
  switch (agentType) {
    case 'CLAUDE_CODE':
      return `${ourName} Claude Code`;
    case 'CURSOR_CLI':
      return `${ourName} Cursor CLI`;
    case 'OPENCODE':
      return `${ourName} OpenCode`;
    default:
      return `${ourName}`;
  }
}
