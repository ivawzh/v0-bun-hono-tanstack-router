/**
 * File-based session registry for tracking Claude Code agent sessions
 * Survives hot reloads and server restarts
 */

import { mkdir, writeFile, readFile, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface SessionData {
  sessionId: string;
  taskId: string;
  agentId: string;
  projectId: string;
  repositoryPath: string;
  startedAt: string;
  lastPing?: string;
  claudeConfigDir?: string;
}

const ACTIVE_SESSIONS_DIR = join(homedir(), '.solo-unicorn', 'sessions', 'active');
const COMPLETED_SESSIONS_DIR = join(homedir(), '.solo-unicorn', 'sessions', 'completed');

/**
 * Initialize session registry directory
 */
export async function initSessionRegistry(): Promise<void> {
  try {
    if (!existsSync(ACTIVE_SESSIONS_DIR)) {
      await mkdir(ACTIVE_SESSIONS_DIR, { recursive: true });
    }
    if (!existsSync(COMPLETED_SESSIONS_DIR)) {
      await mkdir(COMPLETED_SESSIONS_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('Failed to initialize session registry:', error);
    throw error;
  }
}

/**
 * Register a new agent session
 */
export async function registerActiveSession(sessionData: SessionData): Promise<void> {
  await initSessionRegistry();

  const sessionFile = join(ACTIVE_SESSIONS_DIR, `${sessionData.sessionId}.json`);
  const data = {
    ...sessionData,
    lastPing: new Date().toISOString()
  };

  await writeFile(sessionFile, JSON.stringify(data, null, 2));

  await unregisterCompletedSession(sessionData.sessionId);
}

export async function registerCompletedSession(sessionData: SessionData): Promise<void> {
  await initSessionRegistry();

  const sessionFile = join(COMPLETED_SESSIONS_DIR, `${sessionData.sessionId}.json`);
  const data = {
    ...sessionData,
    lastPing: new Date().toISOString()
  };

  await writeFile(sessionFile, JSON.stringify(data, null, 2));

  await unregisterActiveSession(sessionData.sessionId);
}

/**
 * Update session ping timestamp
 */
export async function pingSession(sessionId: string): Promise<void> {
  await initSessionRegistry();

  const sessionFile = join(ACTIVE_SESSIONS_DIR, `${sessionId}.json`);

  if (existsSync(sessionFile)) {
    const data = JSON.parse(await readFile(sessionFile, 'utf-8'));
    data.lastPing = new Date().toISOString();
    await writeFile(sessionFile, JSON.stringify(data, null, 2));
  }
}

/**
 * Remove session from registry. Idempotent.
 */
async function unregisterActiveSession(sessionId: string): Promise<void> {
  await initSessionRegistry();

  const sessionFile = join(ACTIVE_SESSIONS_DIR, `${sessionId}.json`);

  if (existsSync(sessionFile)) {
    await unlink(sessionFile);
  }
}

/**
 * Remove session from registry. Idempotent.
 */
async function unregisterCompletedSession(sessionId: string): Promise<void> {
  await initSessionRegistry();

  const sessionFile = join(COMPLETED_SESSIONS_DIR, `${sessionId}.json`);

  if (existsSync(sessionFile)) {
    await unlink(sessionFile);
  }
}

/**
 * Get all active sessions
 */
export async function getAllActiveSessions(): Promise<SessionData[]> {
  await initSessionRegistry();

  try {
    const files = await readdir(ACTIVE_SESSIONS_DIR);
    const sessions: SessionData[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const sessionFile = join(ACTIVE_SESSIONS_DIR, file);
          const data = JSON.parse(await readFile(sessionFile, 'utf-8'));
          sessions.push(data);
        } catch (error) {
          console.warn(`Failed to read session file ${file}:`, error);
          // Clean up corrupted files
          try {
            await unlink(join(ACTIVE_SESSIONS_DIR, file));
          } catch {}
        }
      }
    }

    return sessions;
  } catch (error) {
    console.error('Failed to get active sessions:', error);
    return [];
  }
}

/**
 * Get all completed sessions
 */
export async function getAllCompletedSessions(): Promise<SessionData[]> {
  await initSessionRegistry();

  try {
    const files = await readdir(COMPLETED_SESSIONS_DIR);
    const sessions: SessionData[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const sessionFile = join(COMPLETED_SESSIONS_DIR, file);
          const data = JSON.parse(await readFile(sessionFile, 'utf-8'));
          sessions.push(data);
        } catch (error) {
          console.warn(`Failed to read session file ${file}:`, error);
          // Clean up corrupted files
          try {
            await unlink(join(COMPLETED_SESSIONS_DIR, file));
          } catch {}
        }
      }
    }

    return sessions;
  } catch (error) {
    console.error('Failed to get completed sessions:', error);
    return [];
  }
}

/**
 * Get session by ID
 */
export async function getActiveSession(sessionId: string): Promise<SessionData | null> {
  await initSessionRegistry();

  const sessionFile = join(ACTIVE_SESSIONS_DIR, `${sessionId}.json`);

  if (!existsSync(sessionFile)) {
    return null;
  }

  try {
    const data = JSON.parse(await readFile(sessionFile, 'utf-8'));
    return data;
  } catch (error) {
    console.warn(`Failed to read session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Get sessions for a specific agent
 */
export async function getSessionsForAgent(agentId: string): Promise<SessionData[]> {
  const allSessions = await getAllActiveSessions();
  return allSessions.filter(session => session.agentId === agentId);
}

/**
 * Get sessions for a specific task
 */
export async function getSessionsForTask(taskId: string): Promise<SessionData[]> {
  const allSessions = await getAllActiveSessions();
  return allSessions.filter(session => session.taskId === taskId);
}

/**
 * Clean up stale active sessions (older than specified minutes)
 */
export async function cleanupStaleActiveSessions(staleMinutes = 120): Promise<number> {
  const allSessions = await getAllActiveSessions();
  const staleThreshold = Date.now() - (staleMinutes * 60 * 1000);
  let cleanedCount = 0;

  for (const session of allSessions) {
    const lastPingTime = session.lastPing ? new Date(session.lastPing).getTime() : new Date(session.startedAt).getTime();

    if (lastPingTime < staleThreshold) {
      await unregisterActiveSession(session.sessionId);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

/**
 * Purge completed sessions
 */
export async function purgeCompletedSessions(): Promise<void> {
  await initSessionRegistry();

  try {
    const files = await readdir(COMPLETED_SESSIONS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await unlink(join(COMPLETED_SESSIONS_DIR, file));
      }
    }
    console.log(`🗑️ Purged ${files.length} completed sessions`);
  } catch (error) {
    console.error('Failed to purge completed sessions:', error);
    throw error;
  }
}
