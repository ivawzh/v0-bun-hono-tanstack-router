import type { AgentsMdConfig } from 'agents-md'

export default {
  include: [
    '**/agents-md/**/*.md',
    '**/*.agents.md',
    // '**/.solo/designs/**/*.md',
    '**/.ai/rules/shared/rules/**/*',
  ],
} satisfies AgentsMdConfig
