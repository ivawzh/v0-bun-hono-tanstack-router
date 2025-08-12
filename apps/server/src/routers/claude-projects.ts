import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { promises as fs } from "fs";
import path from "path";
import { readFileSync, createReadStream } from "fs";
import readline from "readline";

interface ClaudeProject {
  id: string;           // The folder name (e.g., "-home-user-repos-myproject")
  path: string;         // The actual file system path
  displayName: string;  // Human-friendly name
  exists: boolean;      // Whether the path exists on disk
}

// Extract the actual project directory from JSONL sessions
async function extractProjectDirectory(projectName: string): Promise<string> {
  const projectDir = path.join(process.env.HOME || "", ".claude", "projects", projectName);
  
  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      // Fall back to decoded project name if no sessions
      return projectName.replace(/-/g, '/');
    }
    
    // Read first JSONL file to find cwd
    const jsonlFile = path.join(projectDir, jsonlFiles[0]);
    const fileContent = readFileSync(jsonlFile, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.cwd) {
          return entry.cwd;
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    
    // Fall back to decoded name
    return projectName.replace(/-/g, '/');
  } catch (error) {
    // Fall back to decoded project name
    return projectName.replace(/-/g, '/');
  }
}

// Generate display name from path
async function generateDisplayName(projectPath: string): Promise<string> {
  // Try to read package.json
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageData = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageData);
    
    if (packageJson.name) {
      return packageJson.name;
    }
  } catch (error) {
    // Continue to fallback
  }
  
  // Return last folder name
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

// Check if a directory exists
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export const claudeProjectsRouter = o.router({
  discover: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      const claudeDir = path.join(process.env.HOME || "", ".claude", "projects");
      const projects: ClaudeProject[] = [];
      
      try {
        // Check if Claude projects directory exists
        const claudeDirExists = await directoryExists(claudeDir);
        if (!claudeDirExists) {
          return { projects: [] };
        }
        
        // Read all project directories
        const entries = await fs.readdir(claudeDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            // Extract actual project path from sessions
            const actualPath = await extractProjectDirectory(entry.name);
            
            // Generate display name
            const displayName = await generateDisplayName(actualPath);
            
            // Check if path exists
            const exists = await directoryExists(actualPath);
            
            projects.push({
              id: entry.name,
              path: actualPath,
              displayName,
              exists
            });
          }
        }
        
        // Sort by display name
        projects.sort((a, b) => a.displayName.localeCompare(b.displayName));
        
      } catch (error) {
        console.error('Error discovering Claude projects:', error);
      }
      
      return { projects };
    }),
    
  validate: protectedProcedure
    .input(v.object({
      path: v.string()
    }))
    .handler(async ({ context, input }) => {
      // Check if path exists and is a directory
      const exists = await directoryExists(input.path);
      
      // Generate the Claude project ID for this path
      const projectId = '-' + input.path.replace(/^\//g, '').replace(/\//g, '-');
      
      // Check if this project exists in Claude
      const claudeProjectPath = path.join(process.env.HOME || "", ".claude", "projects", projectId);
      const inClaude = await directoryExists(claudeProjectPath);
      
      // Get display name
      const displayName = await generateDisplayName(input.path);
      
      return {
        valid: exists,
        exists,
        projectId,
        inClaude,
        displayName
      };
    })
});