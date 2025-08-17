import * as v from "valibot";

// Common schemas
export const uuidSchema = v.pipe(v.string(), v.uuid());
export const emailSchema = v.pipe(v.string(), v.email());
export const dateSchema = v.pipe(v.string(), v.isoDateTime());

// Task related schemas (with loop column support)
export const taskStatusSchema = v.picklist(["todo", "doing", "done", "loop"]);
export const taskStageSchema = v.picklist(["refine", "plan", "execute", "loop"]);

// Session related schemas (simplified)
export const sessionStateSchema = v.picklist(["starting", "active", "completed", "failed"]);

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