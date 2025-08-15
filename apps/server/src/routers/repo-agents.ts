import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { repoAgents, projects } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

const clientTypeEnum = v.picklist(["claude_code", "opencode"]);
const statusEnum = v.picklist(["idle", "active", "rate_limited", "error"]);

export const repoAgentsRouter = o.router({
  list: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (project.length === 0) {
        throw new Error("Project not found or unauthorized");
      }
      
      const results = await db
        .select()
        .from(repoAgents)
        .where(eq(repoAgents.projectId, input.projectId))
        .orderBy(desc(repoAgents.createdAt));
      
      return results;
    }),
  
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const result = await db
        .select({
          repoAgent: repoAgents,
          project: projects
        })
        .from(repoAgents)
        .innerJoin(projects, eq(repoAgents.projectId, projects.id))
        .where(
          and(
            eq(repoAgents.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (result.length === 0) {
        throw new Error("Repo agent not found or unauthorized");
      }
      
      return result[0].repoAgent;
    }),
  
  create: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      repoPath: v.pipe(v.string(), v.minLength(1)),
      clientType: clientTypeEnum,
      config: v.optional(v.any(), {})
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (project.length === 0) {
        throw new Error("Project not found or unauthorized");
      }
      
      const newRepoAgent = await db
        .insert(repoAgents)
        .values({
          projectId: input.projectId,
          name: input.name,
          repoPath: input.repoPath,
          clientType: input.clientType,
          config: input.config,
          status: "idle"
        })
        .returning();
      
      return newRepoAgent[0];
    }),
  
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      repoPath: v.optional(v.pipe(v.string(), v.minLength(1))),
      clientType: v.optional(clientTypeEnum),
      config: v.optional(v.any()),
      status: v.optional(statusEnum)
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const repoAgent = await db
        .select({
          repoAgent: repoAgents,
          project: projects
        })
        .from(repoAgents)
        .innerJoin(projects, eq(repoAgents.projectId, projects.id))
        .where(
          and(
            eq(repoAgents.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (repoAgent.length === 0) {
        throw new Error("Repo agent not found or unauthorized");
      }
      
      const updates: any = { updatedAt: new Date() };
      
      if (input.name !== undefined) updates.name = input.name;
      if (input.repoPath !== undefined) updates.repoPath = input.repoPath;
      if (input.clientType !== undefined) updates.clientType = input.clientType;
      if (input.config !== undefined) updates.config = input.config;
      if (input.status !== undefined) updates.status = input.status;
      
      const updated = await db
        .update(repoAgents)
        .set(updates)
        .where(eq(repoAgents.id, input.id))
        .returning();
      
      return updated[0];
    }),
  
  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const repoAgent = await db
        .select({
          repoAgent: repoAgents,
          project: projects
        })
        .from(repoAgents)
        .innerJoin(projects, eq(repoAgents.projectId, projects.id))
        .where(
          and(
            eq(repoAgents.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (repoAgent.length === 0) {
        throw new Error("Repo agent not found or unauthorized");
      }
      
      // TODO: Check if any tasks are using this repo agent
      // For now, allow deletion (tasks will become orphaned)
      await db.delete(repoAgents).where(eq(repoAgents.id, input.id));
      
      return { success: true };
    }),

  // Detect Claude Code projects from ~/.claude/projects/
  detectClaudeProjects: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      const fs = await import("fs");
      const fsPromises = await import("fs/promises");
      const path = await import("path");
      const os = await import("os");
      const readline = await import("readline");
      
      // Helper function to extract project directory from JSONL files
      async function extractProjectDirectory(projectDir: string, projectName: string): Promise<string | null> {
        try {
          const files = await fsPromises.readdir(projectDir);
          const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
          
          if (jsonlFiles.length === 0) {
            // Fall back to decoded project name if no sessions
            return projectName.replace(/-/g, '/');
          }
          
          const cwdCounts = new Map<string, number>();
          let latestTimestamp = 0;
          let latestCwd: string | null = null;
          
          // Process JSONL files to find project directory
          for (const file of jsonlFiles) {
            const jsonlFile = path.join(projectDir, file);
            const fileStream = fs.createReadStream(jsonlFile);
            const rl = readline.createInterface({
              input: fileStream,
              crlfDelay: Infinity
            });
            
            for await (const line of rl) {
              if (line.trim()) {
                try {
                  const entry = JSON.parse(line);
                  
                  if (entry.cwd) {
                    // Count occurrences of each cwd
                    cwdCounts.set(entry.cwd, (cwdCounts.get(entry.cwd) || 0) + 1);
                    
                    // Track the most recent cwd
                    const timestamp = new Date(entry.timestamp || 0).getTime();
                    if (timestamp > latestTimestamp) {
                      latestTimestamp = timestamp;
                      latestCwd = entry.cwd;
                    }
                  }
                } catch (parseError) {
                  // Skip malformed lines
                }
              }
            }
          }
          
          // Determine the best cwd to use
          if (cwdCounts.size === 0) {
            return projectName.replace(/-/g, '/');
          } else if (cwdCounts.size === 1) {
            return Array.from(cwdCounts.keys())[0];
          } else {
            // Use the most frequent cwd, with latest as tiebreaker
            let bestCwd = latestCwd;
            let maxCount = 0;
            
            for (const [cwd, count] of cwdCounts.entries()) {
              if (count > maxCount || (count === maxCount && cwd === latestCwd)) {
                bestCwd = cwd;
                maxCount = count;
              }
            }
            
            return bestCwd;
          }
        } catch (error) {
          console.warn(`Error extracting project directory for ${projectName}:`, error);
          return projectName.replace(/-/g, '/');
        }
      }
      
      // Helper function to generate display name
      async function generateDisplayName(projectPath: string): Promise<string> {
        try {
          // Try to read package.json from the project path
          const packageJsonPath = path.join(projectPath, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageData = await fsPromises.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageData);
            
            if (packageJson.name) {
              return packageJson.name;
            }
          }
        } catch (error) {
          // Fall back to path-based naming
        }
        
        // Use directory name as fallback
        const parts = projectPath.split('/').filter(Boolean);
        return parts[parts.length - 1] || projectPath;
      }
      
      try {
        const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");
        
        if (!fs.existsSync(claudeProjectsDir)) {
          return [];
        }
        
        const projects = [];
        const entries = await fsPromises.readdir(claudeProjectsDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const projectDir = path.join(claudeProjectsDir, entry.name);
            
            try {
              // Extract actual project directory from JSONL sessions
              const actualProjectDir = await extractProjectDirectory(projectDir, entry.name);
              
              if (actualProjectDir && fs.existsSync(actualProjectDir)) {
                // Generate display name
                const displayName = await generateDisplayName(actualProjectDir);
                
                projects.push({
                  id: entry.name,
                  name: displayName,
                  path: actualProjectDir
                });
              }
            } catch (error) {
              console.warn(`Failed to process project ${entry.name}:`, error);
            }
          }
        }
        
        return projects;
      } catch (error) {
        console.error("Error detecting Claude Code projects:", error);
        return [];
      }
    })
});