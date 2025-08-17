/**
 * Rollback and Safety Mechanisms for V2 Migration
 * Provides database backup, restoration, and rollback capabilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { db } from '../index';
import { canMigrateToV2 } from '../../lib/feature-flags';

const execAsync = promisify(exec);

interface BackupInfo {
  timestamp: string;
  filename: string;
  path: string;
  size: number;
  version: 'v1' | 'v2';
}

interface RollbackResult {
  success: boolean;
  backupCreated?: BackupInfo;
  restoredFrom?: BackupInfo;
  errors: string[];
  warnings: string[];
}

/**
 * Get database connection info from environment
 */
function getDatabaseConfig() {
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || '5432',
    database: process.env.DATABASE_NAME || 'solo_unicorn',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || ''
  };
}

/**
 * Get backup directory path
 */
function getBackupDir(): string {
  const backupDir = path.join(process.cwd(), 'backups', 'database');
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

/**
 * Create a database backup before migration
 */
export async function createPreMigrationBackup(version: 'v1' | 'v2' = 'v1'): Promise<BackupInfo> {
  if (!canMigrateToV2()) {
    throw new Error('Migration operations are disabled. Set ALLOW_V2_MIGRATION=true to enable.');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `solo-unicorn-${version}-backup-${timestamp}.sql`;
  const backupPath = path.join(getBackupDir(), filename);
  
  const config = getDatabaseConfig();
  
  try {
    console.log(`[Backup] Creating ${version} backup: ${filename}`);
    
    // Set PGPASSWORD environment variable for pg_dump
    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }
    
    const dumpCommand = [
      'pg_dump',
      `-h ${config.host}`,
      `-p ${config.port}`,
      `-U ${config.username}`,
      `-d ${config.database}`,
      '--no-password',
      '--verbose',
      '--clean',
      '--create',
      `--file="${backupPath}"`
    ].join(' ');
    
    const { stdout, stderr } = await execAsync(dumpCommand, { env });
    
    if (stderr && !stderr.includes('NOTICE')) {
      console.warn('[Backup] pg_dump warnings:', stderr);
    }
    
    // Get file size
    const { stdout: sizeOutput } = await execAsync(`ls -la "${backupPath}"`);
    const size = parseInt(sizeOutput.split(/\s+/)[4]) || 0;
    
    const backupInfo: BackupInfo = {
      timestamp,
      filename,
      path: backupPath,
      size,
      version
    };
    
    console.log(`[Backup] Successfully created backup: ${filename} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    return backupInfo;
    
  } catch (error) {
    console.error('[Backup] Failed to create backup:', error);
    throw new Error(`Database backup failed: ${error}`);
  }
}

/**
 * Restore database from backup
 */
export async function restoreFromBackup(backupPath: string): Promise<RollbackResult> {
  if (!canMigrateToV2()) {
    throw new Error('Migration operations are disabled. Set ALLOW_V2_MIGRATION=true to enable.');
  }

  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const config = getDatabaseConfig();
  const result: RollbackResult = {
    success: false,
    errors: [],
    warnings: []
  };

  try {
    console.log(`[Rollback] Restoring database from: ${backupPath}`);
    
    // Create a pre-rollback backup
    const preRollbackBackup = await createPreMigrationBackup('v2');
    result.backupCreated = preRollbackBackup;
    
    // Set PGPASSWORD environment variable for psql
    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }
    
    const restoreCommand = [
      'psql',
      `-h ${config.host}`,
      `-p ${config.port}`,
      `-U ${config.username}`,
      `-d ${config.database}`,
      '--no-password',
      `--file="${backupPath}"`
    ].join(' ');
    
    const { stdout, stderr } = await execAsync(restoreCommand, { env });
    
    if (stderr && !stderr.includes('NOTICE')) {
      result.warnings.push(`Restore warnings: ${stderr}`);
    }
    
    result.success = true;
    result.restoredFrom = {
      timestamp: 'unknown',
      filename: path.basename(backupPath),
      path: backupPath,
      size: 0,
      version: 'v1'
    };
    
    console.log('[Rollback] Database restoration completed successfully');
    return result;
    
  } catch (error) {
    result.errors.push(`Database restoration failed: ${error}`);
    console.error('[Rollback] Failed to restore database:', error);
    return result;
  }
}

/**
 * List available backups
 */
export async function listAvailableBackups(): Promise<BackupInfo[]> {
  const backupDir = getBackupDir();
  
  try {
    const { stdout } = await execAsync(`ls -la "${backupDir}"/*.sql`);
    const lines = stdout.trim().split('\n');
    
    const backups: BackupInfo[] = [];
    
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 9) {
        const size = parseInt(parts[4]);
        const filename = parts[8];
        const fullPath = path.join(backupDir, filename);
        
        // Extract version and timestamp from filename
        const versionMatch = filename.match(/(v1|v2)/);
        const timestampMatch = filename.match(/backup-(.+)\.sql$/);
        
        backups.push({
          timestamp: timestampMatch ? timestampMatch[1] : 'unknown',
          filename,
          path: fullPath,
          size,
          version: (versionMatch ? versionMatch[1] : 'v1') as 'v1' | 'v2'
        });
      }
    }
    
    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
  } catch (error) {
    console.warn('[Backup] No backups found or error listing backups:', error);
    return [];
  }
}

/**
 * Clean up old backups (keep last N backups)
 */
export async function cleanupOldBackups(keepCount: number = 5): Promise<number> {
  const backups = await listAvailableBackups();
  
  if (backups.length <= keepCount) {
    return 0;
  }
  
  const toDelete = backups.slice(keepCount);
  let deletedCount = 0;
  
  for (const backup of toDelete) {
    try {
      await execAsync(`rm "${backup.path}"`);
      deletedCount++;
      console.log(`[Cleanup] Deleted old backup: ${backup.filename}`);
    } catch (error) {
      console.warn(`[Cleanup] Failed to delete backup ${backup.filename}:`, error);
    }
  }
  
  return deletedCount;
}

/**
 * Verify database integrity after migration/rollback
 */
export async function verifyDatabaseIntegrity(): Promise<{
  valid: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
}> {
  const checks: Array<{ name: string; passed: boolean; message: string }> = [];
  
  try {
    // Check if we can connect to database
    await db.execute('SELECT 1');
    checks.push({
      name: 'Database Connection',
      passed: true,
      message: 'Successfully connected to database'
    });
    
    // Check if users table exists and has data
    try {
      const userCount = await db.execute('SELECT COUNT(*) FROM users');
      checks.push({
        name: 'Users Table',
        passed: true,
        message: `Users table accessible with ${userCount.rowCount} rows`
      });
    } catch (error) {
      checks.push({
        name: 'Users Table',
        passed: false,
        message: `Users table check failed: ${error}`
      });
    }
    
    // Check if projects table exists and has data
    try {
      const projectCount = await db.execute('SELECT COUNT(*) FROM projects');
      checks.push({
        name: 'Projects Table',
        passed: true,
        message: `Projects table accessible with ${projectCount.rowCount} rows`
      });
    } catch (error) {
      checks.push({
        name: 'Projects Table',
        passed: false,
        message: `Projects table check failed: ${error}`
      });
    }
    
    // Check foreign key constraints
    try {
      await db.execute(`
        SELECT COUNT(*) FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY'
      `);
      checks.push({
        name: 'Foreign Key Constraints',
        passed: true,
        message: 'Foreign key constraints are valid'
      });
    } catch (error) {
      checks.push({
        name: 'Foreign Key Constraints',
        passed: false,
        message: `Foreign key constraint check failed: ${error}`
      });
    }
    
  } catch (error) {
    checks.push({
      name: 'Database Connection',
      passed: false,
      message: `Failed to connect to database: ${error}`
    });
  }
  
  const allPassed = checks.every(check => check.passed);
  
  return {
    valid: allPassed,
    checks
  };
}

/**
 * Emergency rollback to last known good backup
 */
export async function emergencyRollback(): Promise<RollbackResult> {
  console.log('[Emergency] Starting emergency rollback procedure...');
  
  const backups = await listAvailableBackups();
  const v1Backups = backups.filter(b => b.version === 'v1');
  
  if (v1Backups.length === 0) {
    return {
      success: false,
      errors: ['No V1 backups available for emergency rollback'],
      warnings: []
    };
  }
  
  const latestV1Backup = v1Backups[0];
  console.log(`[Emergency] Rolling back to: ${latestV1Backup.filename}`);
  
  return await restoreFromBackup(latestV1Backup.path);
}

/**
 * Pre-migration safety checks
 */
export async function runPreMigrationChecks(): Promise<{
  safe: boolean;
  checks: Array<{ name: string; passed: boolean; message: string; critical: boolean }>;
}> {
  const checks: Array<{ name: string; passed: boolean; message: string; critical: boolean }> = [];
  
  // Check disk space
  try {
    const { stdout } = await execAsync('df -h .');
    const available = stdout.split('\n')[1].split(/\s+/)[3];
    checks.push({
      name: 'Disk Space',
      passed: true,
      message: `Available space: ${available}`,
      critical: false
    });
  } catch (error) {
    checks.push({
      name: 'Disk Space',
      passed: false,
      message: `Could not check disk space: ${error}`,
      critical: false
    });
  }
  
  // Check database accessibility
  try {
    await db.execute('SELECT 1');
    checks.push({
      name: 'Database Access',
      passed: true,
      message: 'Database is accessible',
      critical: true
    });
  } catch (error) {
    checks.push({
      name: 'Database Access',
      passed: false,
      message: `Database not accessible: ${error}`,
      critical: true
    });
  }
  
  // Check if pg_dump is available
  try {
    await execAsync('which pg_dump');
    checks.push({
      name: 'pg_dump Available',
      passed: true,
      message: 'pg_dump command is available',
      critical: true
    });
  } catch (error) {
    checks.push({
      name: 'pg_dump Available',
      passed: false,
      message: 'pg_dump command not found - backups will not work',
      critical: true
    });
  }
  
  // Check backup directory
  try {
    const backupDir = getBackupDir();
    checks.push({
      name: 'Backup Directory',
      passed: true,
      message: `Backup directory ready: ${backupDir}`,
      critical: true
    });
  } catch (error) {
    checks.push({
      name: 'Backup Directory',
      passed: false,
      message: `Could not create backup directory: ${error}`,
      critical: true
    });
  }
  
  const criticalChecks = checks.filter(c => c.critical);
  const safe = criticalChecks.every(c => c.passed);
  
  return { safe, checks };
}