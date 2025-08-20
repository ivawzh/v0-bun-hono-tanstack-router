/**
 * Hot-reload-safe interval utility for Bun development
 * 
 * Bun's hot reload doesn't automatically cleanup setInterval timers from old module instances.
 * When hot reload occurs:
 * 1. New module instance starts with new intervals
 * 2. Old module instance intervals keep running
 * 3. Both old and new intervals execute simultaneously
 * 
 * This utility uses module versioning and global state to ensure only the latest module instance
 * runs intervals, while automatically terminating old instances.
 * 
 * @example
 * ```typescript
 * // Replace this:
 * setInterval(myFunction, 5000)
 * 
 * // With this:
 * startHotReloadSafeInterval('myFunction', myFunction, 5000)
 * ```
 */

// Global state for tracking active intervals across hot reloads
declare global {
  var __soloUnicornIntervals: Map<string, {
    moduleVersion: string;
    shouldStop: boolean;
  }> | undefined;
}

// Initialize global state
globalThis.__soloUnicornIntervals ??= new Map();

// Unique module version per hot reload
const MODULE_VERSION = Date.now().toString();

/**
 * Start a hot-reload-safe interval that uses recursive async loops
 * @param name - Human-readable name for logging purposes
 * @param fn - Function to execute repeatedly
 * @param intervalMs - Interval between executions in milliseconds
 * @param runImmediately - Whether to run the function immediately (default: false)
 */
export function startHotReloadSafeInterval(
  name: string,
  fn: () => Promise<void> | void,
  intervalMs: number,
  runImmediately: boolean = false
): void {
  const intervals = globalThis.__soloUnicornIntervals!;
  
  // Stop any existing interval with the same name from previous module versions
  const existing = intervals.get(name);
  if (existing && existing.moduleVersion !== MODULE_VERSION) {
    existing.shouldStop = true;
    console.log(`🛑 Stopping stale interval: ${name} (module ${existing.moduleVersion})`);
  }
  
  // Register this interval
  intervals.set(name, {
    moduleVersion: MODULE_VERSION,
    shouldStop: false
  });
  
  console.log(`🔄 Starting hot-reload-safe interval: ${name} (every ${intervalMs}ms, module ${MODULE_VERSION})`);

  async function intervalLoop(): Promise<void> {
    try {
      if (runImmediately) {
        // Check if we should stop before first execution
        const current = intervals.get(name);
        if (current?.shouldStop || current?.moduleVersion !== MODULE_VERSION) {
          console.log(`🛑 Interval ${name} stopped before first execution`);
          return;
        }
        await fn();
      }

      while (true) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        
        // Check if this interval has been superseded by a newer module version
        const current = intervals.get(name);
        if (current?.shouldStop || current?.moduleVersion !== MODULE_VERSION) {
          console.log(`🛑 Interval ${name} stopped (superseded by newer module)`);
          return;
        }
        
        await fn();
      }
    } catch (error) {
      console.error(`❌ Hot-reload-safe interval '${name}' failed:`, error);
      // Clean up on error
      intervals.delete(name);
      throw error;
    }
  }

  // Start the loop (fire-and-forget)
  intervalLoop().catch(error => {
    console.error(`💥 Hot-reload-safe interval '${name}' crashed:`, error);
  });
}

/**
 * Start a hot-reload-safe interval that runs the function immediately, then on intervals
 * @param name - Human-readable name for logging purposes
 * @param fn - Function to execute repeatedly
 * @param intervalMs - Interval between executions in milliseconds
 */
export function startHotReloadSafeIntervalImmediate(
  name: string,
  fn: () => Promise<void> | void,
  intervalMs: number
): void {
  startHotReloadSafeInterval(name, fn, intervalMs, true);
}