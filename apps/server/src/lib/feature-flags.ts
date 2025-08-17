/**
 * Feature flag system for Solo Unicorn V2 migration
 * Allows safe rollback between V1 and V2 architectures
 */

interface FeatureFlags {
  useV2Schema: boolean;
  useV2APIs: boolean;
  useV2Orchestrator: boolean;
  allowV2Migration: boolean;
  debugMode: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  useV2Schema: false,       // Start with V1 schema
  useV2APIs: false,         // Start with V1 APIs
  useV2Orchestrator: false, // Start with V1 orchestrator
  allowV2Migration: true,   // Allow migration tools to run
  debugMode: false          // Debug logging for migration
};

/**
 * Get feature flags from environment variables with fallbacks
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    useV2Schema: process.env.USE_V2_SCHEMA === 'true' || DEFAULT_FLAGS.useV2Schema,
    useV2APIs: process.env.USE_V2_APIS === 'true' || DEFAULT_FLAGS.useV2APIs,
    useV2Orchestrator: process.env.USE_V2_ORCHESTRATOR === 'true' || DEFAULT_FLAGS.useV2Orchestrator,
    allowV2Migration: process.env.ALLOW_V2_MIGRATION !== 'false', // Default true, must explicitly disable
    debugMode: process.env.FEATURE_FLAG_DEBUG === 'true' || DEFAULT_FLAGS.debugMode
  };
}

/**
 * Check if V2 schema should be used
 */
export function useV2Schema(): boolean {
  const flags = getFeatureFlags();
  if (flags.debugMode) {
    console.log('[FeatureFlag] useV2Schema:', flags.useV2Schema);
  }
  return flags.useV2Schema;
}

/**
 * Check if V2 APIs should be used
 */
export function useV2APIs(): boolean {
  const flags = getFeatureFlags();
  if (flags.debugMode) {
    console.log('[FeatureFlag] useV2APIs:', flags.useV2APIs);
  }
  return flags.useV2APIs;
}

/**
 * Check if V2 orchestrator should be used
 */
export function useV2Orchestrator(): boolean {
  const flags = getFeatureFlags();
  if (flags.debugMode) {
    console.log('[FeatureFlag] useV2Orchestrator:', flags.useV2Orchestrator);
  }
  return flags.useV2Orchestrator;
}

/**
 * Check if V2 migration tools are allowed to run
 */
export function canMigrateToV2(): boolean {
  const flags = getFeatureFlags();
  if (flags.debugMode) {
    console.log('[FeatureFlag] canMigrateToV2:', flags.allowV2Migration);
  }
  return flags.allowV2Migration;
}

/**
 * Log current feature flag state
 */
export function logFeatureFlags(): void {
  const flags = getFeatureFlags();
  console.log('[FeatureFlags] Current state:', flags);
}

/**
 * Validate feature flag dependencies
 * Some flags have logical dependencies on others
 */
export function validateFeatureFlags(): { valid: boolean; errors: string[] } {
  const flags = getFeatureFlags();
  const errors: string[] = [];

  // V2 APIs depend on V2 Schema
  if (flags.useV2APIs && !flags.useV2Schema) {
    errors.push('useV2APIs requires useV2Schema to be enabled');
  }

  // V2 Orchestrator depends on V2 Schema
  if (flags.useV2Orchestrator && !flags.useV2Schema) {
    errors.push('useV2Orchestrator requires useV2Schema to be enabled');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Initialize feature flags and validate configuration
 * Should be called during server startup
 */
export function initializeFeatureFlags(): void {
  const validation = validateFeatureFlags();
  
  if (!validation.valid) {
    console.error('[FeatureFlags] Invalid configuration:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Feature flag configuration is invalid');
  }

  if (getFeatureFlags().debugMode || process.env.NODE_ENV === 'development') {
    logFeatureFlags();
  }
}