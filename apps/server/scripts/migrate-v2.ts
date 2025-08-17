#!/usr/bin/env bun
/**
 * V2 Migration CLI Script
 * Safe migration between V1 and V2 schemas with backup and rollback capabilities
 */

import { Command } from 'commander';
import { 
  migrateV1ToV2, 
  checkMigrationStatus 
} from '../src/db/migrations/v2-migration-utils';
import {
  createPreMigrationBackup,
  restoreFromBackup,
  listAvailableBackups,
  cleanupOldBackups,
  verifyDatabaseIntegrity,
  emergencyRollback,
  runPreMigrationChecks
} from '../src/db/migrations/rollback-safety';
import { 
  getFeatureFlags, 
  logFeatureFlags, 
  validateFeatureFlags,
  initializeFeatureFlags
} from '../src/lib/feature-flags';

const program = new Command();

program
  .name('migrate-v2')
  .description('Solo Unicorn V2 Migration Tool')
  .version('1.0.0');

program
  .command('status')
  .description('Check current migration status')
  .action(async () => {
    try {
      console.log('🔍 Checking migration status...\n');
      
      const status = await checkMigrationStatus();
      
      console.log('Migration Status:');
      console.log(`  V1 Data Exists: ${status.v1DataExists ? '✅' : '❌'}`);
      console.log(`  V2 Data Exists: ${status.v2DataExists ? '✅' : '❌'}`);
      console.log(`  Needs Migration: ${status.needsMigration ? '🚨 YES' : '✅ NO'}`);
      console.log(`  Summary: ${status.summary}\n`);
      
      console.log('Feature Flags:');
      logFeatureFlags();
      
      const validation = validateFeatureFlags();
      if (!validation.valid) {
        console.log('\n❌ Feature Flag Issues:');
        validation.errors.forEach(error => console.log(`  - ${error}`));
      }
      
    } catch (error) {
      console.error('❌ Failed to check migration status:', error);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Run pre-migration safety checks')
  .action(async () => {
    try {
      console.log('🔧 Running pre-migration safety checks...\n');
      
      const result = await runPreMigrationChecks();
      
      console.log('Safety Checks:');
      result.checks.forEach(check => {
        const icon = check.passed ? '✅' : '❌';
        const critical = check.critical ? ' (CRITICAL)' : '';
        console.log(`  ${icon} ${check.name}${critical}: ${check.message}`);
      });
      
      console.log(`\n${result.safe ? '✅ Safe to proceed' : '❌ Issues found - resolve before migration'}`);
      
      if (!result.safe) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Pre-migration checks failed:', error);
      process.exit(1);
    }
  });

program
  .command('backup')
  .description('Create a database backup')
  .option('-v, --version <version>', 'Schema version (v1 or v2)', 'v1')
  .action(async (options) => {
    try {
      console.log(`📦 Creating ${options.version} backup...\n`);
      
      const backup = await createPreMigrationBackup(options.version);
      
      console.log('✅ Backup created successfully:');
      console.log(`  File: ${backup.filename}`);
      console.log(`  Path: ${backup.path}`);
      console.log(`  Size: ${(backup.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Timestamp: ${backup.timestamp}`);
      
    } catch (error) {
      console.error('❌ Backup failed:', error);
      process.exit(1);
    }
  });

program
  .command('migrate')
  .description('Migrate from V1 to V2 schema')
  .option('--skip-backup', 'Skip pre-migration backup (not recommended)')
  .option('--skip-checks', 'Skip pre-migration safety checks (not recommended)')
  .action(async (options) => {
    try {
      console.log('🚀 Starting V1 → V2 migration...\n');
      
      // Initialize and validate feature flags
      initializeFeatureFlags();
      
      // Run safety checks unless skipped
      if (!options.skipChecks) {
        console.log('🔧 Running pre-migration checks...');
        const checks = await runPreMigrationChecks();
        if (!checks.safe) {
          console.error('❌ Pre-migration checks failed. Use --skip-checks to bypass (not recommended)');
          process.exit(1);
        }
        console.log('✅ Pre-migration checks passed\n');
      }
      
      // Create backup unless skipped
      let backup;
      if (!options.skipBackup) {
        console.log('📦 Creating pre-migration backup...');
        backup = await createPreMigrationBackup('v1');
        console.log(`✅ Backup created: ${backup.filename}\n`);
      }
      
      // Run migration
      console.log('🔄 Executing migration...');
      const summary = await migrateV1ToV2();
      
      // Display results
      console.log('\n📊 Migration Summary:');
      Object.entries(summary).forEach(([table, result]) => {
        const icon = result.success ? '✅' : '❌';
        console.log(`  ${icon} ${table}: ${result.migratedCount} records`);
        if (result.errors.length > 0) {
          result.errors.forEach(error => console.log(`      ❌ ${error}`));
        }
        if (result.warnings.length > 0) {
          result.warnings.forEach(warning => console.log(`      ⚠️  ${warning}`));
        }
      });
      
      // Verify integrity
      console.log('\n🔍 Verifying database integrity...');
      const integrity = await verifyDatabaseIntegrity();
      if (integrity.valid) {
        console.log('✅ Database integrity check passed');
      } else {
        console.log('❌ Database integrity issues found:');
        integrity.checks.forEach(check => {
          if (!check.passed) {
            console.log(`  ❌ ${check.name}: ${check.message}`);
          }
        });
      }
      
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 Next steps:');
      console.log('  1. Set USE_V2_SCHEMA=true in your environment');
      console.log('  2. Restart your application');
      console.log('  3. Test V2 functionality');
      console.log('  4. Set USE_V2_APIS=true when ready');
      
      if (backup) {
        console.log(`\n💾 Backup available for rollback: ${backup.filename}`);
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      console.log('\n🔄 Consider running emergency rollback if needed');
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('Rollback to a previous backup')
  .argument('[backup-file]', 'Backup file to restore (or latest V1 backup if not specified)')
  .action(async (backupFile) => {
    try {
      console.log('🔄 Starting rollback procedure...\n');
      
      let targetBackup = backupFile;
      
      if (!targetBackup) {
        // Find latest V1 backup
        const backups = await listAvailableBackups();
        const v1Backups = backups.filter(b => b.version === 'v1');
        
        if (v1Backups.length === 0) {
          console.error('❌ No V1 backups available for rollback');
          process.exit(1);
        }
        
        targetBackup = v1Backups[0].path;
        console.log(`📦 Using latest V1 backup: ${v1Backups[0].filename}`);
      }
      
      const result = await restoreFromBackup(targetBackup);
      
      if (result.success) {
        console.log('✅ Rollback completed successfully');
        if (result.backupCreated) {
          console.log(`💾 Pre-rollback backup created: ${result.backupCreated.filename}`);
        }
      } else {
        console.log('❌ Rollback failed:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
      
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      process.exit(1);
    }
  });

program
  .command('emergency-rollback')
  .description('Emergency rollback to latest V1 backup')
  .action(async () => {
    try {
      console.log('🚨 EMERGENCY ROLLBACK INITIATED...\n');
      
      const result = await emergencyRollback();
      
      if (result.success) {
        console.log('✅ Emergency rollback completed');
        console.log('🔄 Please restart your application');
      } else {
        console.log('❌ Emergency rollback failed:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
    } catch (error) {
      console.error('❌ Emergency rollback failed:', error);
      process.exit(1);
    }
  });

program
  .command('list-backups')
  .description('List available database backups')
  .action(async () => {
    try {
      const backups = await listAvailableBackups();
      
      if (backups.length === 0) {
        console.log('📦 No backups found');
        return;
      }
      
      console.log('📦 Available Backups:\n');
      backups.forEach((backup, index) => {
        const size = (backup.size / 1024 / 1024).toFixed(2);
        console.log(`${index + 1}. ${backup.filename}`);
        console.log(`   Version: ${backup.version}`);
        console.log(`   Size: ${size} MB`);
        console.log(`   Path: ${backup.path}`);
        console.log(`   Timestamp: ${backup.timestamp}\n`);
      });
      
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Clean up old backups')
  .option('-k, --keep <count>', 'Number of backups to keep', '5')
  .action(async (options) => {
    try {
      const keepCount = parseInt(options.keep);
      const deletedCount = await cleanupOldBackups(keepCount);
      
      console.log(`🧹 Cleaned up ${deletedCount} old backups`);
      console.log(`📦 Keeping ${keepCount} most recent backups`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('Verify database integrity')
  .action(async () => {
    try {
      console.log('🔍 Verifying database integrity...\n');
      
      const result = await verifyDatabaseIntegrity();
      
      console.log('Integrity Checks:');
      result.checks.forEach(check => {
        const icon = check.passed ? '✅' : '❌';
        console.log(`  ${icon} ${check.name}: ${check.message}`);
      });
      
      console.log(`\n${result.valid ? '✅ Database integrity verified' : '❌ Database integrity issues found'}`);
      
      if (!result.valid) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Integrity verification failed:', error);
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