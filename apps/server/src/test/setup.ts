/**
 * Test setup file for Solo Unicorn tests
 */

// Set test environment
process.env.NODE_ENV = 'test'

// Mock any external services or APIs if needed
globalThis.console.log = (...args: any[]) => {
  // Suppress logs during tests unless explicitly needed
  if (process.env.VERBOSE_TESTS) {
    console.log(...args)
  }
}

export {}