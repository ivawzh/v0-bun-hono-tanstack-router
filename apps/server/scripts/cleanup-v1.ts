#!/usr/bin/env bun
/**
 * V1 Cleanup Script
 * Removes V1 schema and code after successful V2 migration
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { 
  getFeatureFlags, 
  validateFeatureFlags,
  useV2Schema,
  useV2APIs,
  useV2Orchestrator
} from '../src/lib/feature-flags';

const program = new Command();

program
  .name('cleanup-v1')
  .description('Solo Unicorn V1 Cleanup Tool')
  .version('1.0.0');

interface CleanupResult {
  filesRemoved: string[];
  tablesDropped: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Check if V2 is fully enabled and V1 can be safely removed
 */
function checkV2Readiness(): { ready: boolean; issues: string[] } {
  const flags = getFeatureFlags();
  const issues: string[] = [];

  if (!flags.useV2Schema) {
    issues.push('V2 schema not enabled (USE_V2_SCHEMA=true required)');
  }
  
  if (!flags.useV2APIs) {
    issues.push('V2 APIs not enabled (USE_V2_APIS=true required)');
  }
  
  if (!flags.useV2Orchestrator) {
    issues.push('V2 orchestrator not enabled (USE_V2_ORCHESTRATOR=true required)');
  }

  const validation = validateFeatureFlags();
  if (!validation.valid) {
    issues.push(...validation.errors);
  }

  return {
    ready: issues.length === 0,
    issues
  };
}

/**
 * List V1 files that would be removed
 */
async function listV1Files(): Promise<string[]> {
  const filesToRemove = [
    // V1 Schema files
    'apps/server/src/db/schema/index.ts', // Would be replaced with v2.ts
    
    // V1 Agent orchestrator (class-based)
    'apps/server/src/agents/agent-orchestrator.ts',
    'apps/server/src/agents/claude-code-client.ts',
    
    // V1 Migration utilities
    'apps/server/src/db/migrations/v2-migration-utils.ts',
    'apps/server/src/db/migrations/rollback-safety.ts',
    'apps/server/scripts/migrate-v2.ts',
    
    // Feature flag system (would be simplified)
    'apps/server/src/lib/feature-flags.ts',
    'apps/server/src/db/schema/dynamic.ts'
  ];

  const existingFiles = [];
  for (const file of filesToRemove) {
    if (existsSync(file)) {
      existingFiles.push(file);
    }
  }

  return existingFiles;
}

/**
 * List V1 database tables that would be dropped
 */
function listV1Tables(): string[] {
  return [
    'agent_clients',
    'repo_agents', 
    'sessions', // V2 uses lastAgentSessionId in tasks
    // Note: users, projects, actors, tasks, task_dependencies are kept (enhanced in V2)
  ];
}

/**
 * Simulate cleanup (dry run)
 */
async function simulateCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = {
    filesRemoved: [],
    tablesDropped: [],
    errors: [],
    warnings: []
  };

  try {
    // Check readiness
    const readiness = checkV2Readiness();
    if (!readiness.ready) {
      result.errors.push(...readiness.issues);
      return result;
    }

    // List files that would be removed
    result.filesRemoved = await listV1Files();
    
    // List tables that would be dropped
    result.tablesDropped = listV1Tables();

    // Add warnings
    result.warnings.push('This would remove V1 code and database tables permanently');
    result.warnings.push('Ensure V2 is working correctly before proceeding');
    result.warnings.push('Create a full backup before running actual cleanup');

    return result;
  } catch (error) {
    result.errors.push(`Simulation failed: ${error}`);
    return result;
  }
}

/**
 * Perform actual cleanup (WARNING: Destructive)
 */
async function performCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = {
    filesRemoved: [],
    tablesDropped: [],
    errors: [],
    warnings: []
  };

  try {
    // Final safety check
    const readiness = checkV2Readiness();
    if (!readiness.ready) {
      result.errors.push('V2 not ready for cleanup:');
      result.errors.push(...readiness.issues);
      return result;
    }

    console.log('🧹 Starting V1 cleanup...');

    // Remove V1 files
    const filesToRemove = await listV1Files();
    for (const file of filesToRemove) {
      try {
        await fs.unlink(file);
        result.filesRemoved.push(file);
        console.log(`✅ Removed: ${file}`);
      } catch (error) {
        result.errors.push(`Failed to remove ${file}: ${error}`);
      }
    }

    // Drop V1 database tables
    const { db } = await import('../src/db/index');
    const tablesToDrop = listV1Tables();
    
    for (const table of tablesToDrop) {
      try {
        await db.execute(`DROP TABLE IF EXISTS ${table} CASCADE`);
        result.tablesDropped.push(table);
        console.log(`✅ Dropped table: ${table}`);
      } catch (error) {
        result.errors.push(`Failed to drop table ${table}: ${error}`);
      }
    }

    // Update main schema to use V2
    const schemaIndexContent = `// Solo Unicorn V2 Schema (V1 removed)
export * from './v2';
`;
    
    try {
      await fs.writeFile('apps/server/src/db/schema/index.ts', schemaIndexContent);
      console.log('✅ Updated schema index to use V2');
    } catch (error) {
      result.errors.push(`Failed to update schema index: ${error}`);
    }

    // Remove feature flag dependencies from main server
    result.warnings.push('Manual cleanup required:');
    result.warnings.push('- Remove feature flag imports from apps/server/src/index.ts');
    result.warnings.push('- Update environment variables documentation');
    result.warnings.push('- Remove V1 references from CLAUDE.md');
    result.warnings.push('- Update V2-IMPLEMENTATION-STATUS.md');

    console.log('🧹 V1 cleanup completed');
    return result;

  } catch (error) {
    result.errors.push(`Cleanup failed: ${error}`);
    return result;
  }
}

program
  .command('check')
  .description('Check if V2 is ready for V1 cleanup')
  .action(async () => {
    try {
      console.log('🔍 Checking V2 readiness for V1 cleanup...\n');
      
      const readiness = checkV2Readiness();
      
      console.log('Current Feature Flags:');
      const flags = getFeatureFlags();
      console.log(`  USE_V2_SCHEMA: ${flags.useV2Schema ? '✅' : '❌'}`);
      console.log(`  USE_V2_APIS: ${flags.useV2APIs ? '✅' : '❌'}`);
      console.log(`  USE_V2_ORCHESTRATOR: ${flags.useV2Orchestrator ? '✅' : '❌'}`);
      
      if (readiness.ready) {
        console.log('\n✅ V2 is ready for V1 cleanup');
        console.log('💡 Run "bun scripts/cleanup-v1.ts simulate" to see what would be removed');
      } else {
        console.log('\n❌ V2 is not ready for V1 cleanup');
        console.log('\nIssues to resolve:');
        readiness.issues.forEach(issue => console.log(`  - ${issue}`));
      }
      
    } catch (error) {
      console.error('❌ Check failed:', error);
      process.exit(1);
    }
  });

program
  .command('simulate')
  .description('Simulate cleanup (dry run) - shows what would be removed')
  .action(async () => {
    try {
      console.log('🎭 Simulating V1 cleanup (dry run)...\n');
      
      const result = await simulateCleanup();
      
      if (result.errors.length > 0) {
        console.log('❌ Cannot proceed with cleanup:');
        result.errors.forEach(error => console.log(`  - ${error}`));
        process.exit(1);
      }
      
      console.log('📁 Files that would be removed:');
      if (result.filesRemoved.length === 0) {
        console.log('  (No files to remove)');
      } else {
        result.filesRemoved.forEach(file => console.log(`  - ${file}`));
      }
      
      console.log('\n🗄️  Database tables that would be dropped:');
      if (result.tablesDropped.length === 0) {
        console.log('  (No tables to drop)');
      } else {
        result.tablesDropped.forEach(table => console.log(`  - ${table}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
      
      console.log('\n💡 To perform actual cleanup, run: bun scripts/cleanup-v1.ts cleanup --confirm');
      
    } catch (error) {
      console.error('❌ Simulation failed:', error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Perform actual V1 cleanup (DESTRUCTIVE)')
  .option('--confirm', 'Confirm that you want to permanently remove V1 code')
  .action(async (options) => {
    try {
      if (!options.confirm) {
        console.error('❌ This is a destructive operation. Use --confirm flag to proceed.');
        console.log('💡 Run "bun scripts/cleanup-v1.ts simulate" first to see what would be removed');
        process.exit(1);
      }
      
      console.log('⚠️  WARNING: This will permanently remove V1 code and database tables!');
      console.log('⚠️  Make sure you have a backup and V2 is working correctly!');
      console.log('');
      
      // Give user a chance to cancel
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result = await performCleanup();
      
      console.log('\n📊 Cleanup Summary:');
      console.log(`Files removed: ${result.filesRemoved.length}`);
      console.log(`Tables dropped: ${result.tablesDropped.length}`);
      console.log(`Errors: ${result.errors.length}`);
      console.log(`Warnings: ${result.warnings.length}`);
      
      if (result.filesRemoved.length > 0) {
        console.log('\n📁 Removed files:');
        result.filesRemoved.forEach(file => console.log(`  ✅ ${file}`));
      }
      
      if (result.tablesDropped.length > 0) {
        console.log('\n🗄️  Dropped tables:');
        result.tablesDropped.forEach(table => console.log(`  ✅ ${table}`));
      }
      
      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Manual cleanup required:');
        result.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
      
      if (result.errors.length === 0) {
        console.log('\n🎉 V1 cleanup completed successfully!');
        console.log('🔄 Restart your application to use V2 exclusively');
      } else {
        console.log('\n⚠️  Cleanup completed with errors - review above');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error('❌ Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}