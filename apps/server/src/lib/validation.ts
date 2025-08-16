import * as v from "valibot";

// Common schemas
export const uuidSchema = v.pipe(v.string(), v.uuid());
export const emailSchema = v.pipe(v.string(), v.email());
export const dateSchema = v.pipe(v.string(), v.isoDateTime());

// Task related schemas
export const taskStatusSchema = v.picklist(["todo", "in_progress", "blocked", "done", "paused"]);
export const taskStageSchema = v.picklist(["refine", "plan", "execute"]);
export const taskActorTypeSchema = v.picklist(["agent", "human"]);

// Agent related schemas
export const agentRoleSchema = v.picklist(["PM", "Designer", "Architect", "Engineer", "QA"]);
export const agentRuntimeSchema = v.picklist(["windows-runner", "cloud"]);
export const sessionStateSchema = v.picklist(["booting", "running", "paused", "stopped", "error", "done"]);
export const actionTypeSchema = v.picklist(["plan", "tool_call", "code_edit", "commit", "test", "comment"]);

// Repository related schemas
export const repositoryProviderSchema = v.picklist(["github", "gitlab", "local", "cloud-code"]);

// Helper function to parse and validate
export function parseData<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, data: unknown): v.InferOutput<T> {
  return v.parse(schema, data);
}

// Helper function to safely parse (returns undefined on error)
export function safeParseData<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, data: unknown): v.InferOutput<T> | undefined {
  const result = v.safeParse(schema, data);
  return result.success ? result.output : undefined;
}