import {
  query,
  type Options,
  type PermissionMode,
} from "@anthropic-ai/claude-code";

for await (const message of query({
  prompt: "Just say 'Hello, world!'",
  options: {
    hooks: {
      SessionStart: [
        {
          matcher: '*',
          hooks: [
            async (input, toolUseID, options) => {
              console.log(
                "[Claude Code] SessionStart hook called. ",
                input.hook_event_name,
                input.session_id,
                input.transcript_path,
              );

              return { continue: false };
            },
          ],
        },
      ],
    },
  },
})) {
  console.log(message);
}
