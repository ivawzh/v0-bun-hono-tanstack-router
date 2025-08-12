export function getClaudeCodeBaseUrl(): string {
  // Prefer explicit env var if provided
  const envBase = (import.meta as any)?.env?.VITE_CLAUDE_CODE_BASE_URL as string | undefined;
  if (envBase && typeof envBase === "string" && envBase.trim().length > 0) {
    return envBase.replace(/\/$/, "");
  }

  // Compose from host/port envs if available
  const host = ((import.meta as any)?.env?.VITE_CLAUDE_CODE_HOST as string) || window.location.hostname;
  const port = ((import.meta as any)?.env?.VITE_CLAUDE_CODE_PORT as string) || "8303";
  const protocol = window.location.protocol || "http:";

  return `${protocol}//${host}:${port}`;
}
