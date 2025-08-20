// Priority utility functions for numeric priority system

export type Priority = 1 | 2 | 3 | 4 | 5;

// Priority labels mapping
export const PRIORITY_LABELS = {
  1: 'Lowest',
  2: 'Low', 
  3: 'Medium',
  4: 'High',
  5: 'Highest'
} as const;

// Priority colors for badges (maintaining the color scheme)
export const PRIORITY_COLORS = {
  1: 'bg-gray-100 text-gray-800 border-gray-200',      // Lowest (was P1)
  2: 'bg-blue-100 text-blue-800 border-blue-200',     // Low (was P2)
  3: 'bg-yellow-100 text-yellow-800 border-yellow-200', // Medium (was P3)
  4: 'bg-orange-100 text-orange-800 border-orange-200', // High (was P4)
  5: 'bg-red-100 text-red-800 border-red-200'         // Highest (was P5)
} as const;

/**
 * Safely parse priority value, handling legacy formats and edge cases
 */
export function normalizePriority(priority: any): Priority {
  // Handle legacy string format (P1, P2, etc.)
  if (typeof priority === 'string') {
    if (priority.startsWith('P')) {
      const num = parseInt(priority.slice(1));
      if (num >= 1 && num <= 5) {
        return num as Priority;
      }
    }
    const parsed = parseInt(priority);
    if (parsed >= 1 && parsed <= 5) {
      return parsed as Priority;
    }
  }
  
  // Handle numeric values
  if (typeof priority === 'number' && priority >= 1 && priority <= 5) {
    return priority as Priority;
  }
  
  // Default fallback
  return 3; // Medium priority
}

/**
 * Get the label for a priority number
 */
export function getPriorityLabel(priority: any): string {
  const normalizedPriority = normalizePriority(priority);
  return PRIORITY_LABELS[normalizedPriority];
}

/**
 * Get the display text for a priority (5 • Highest format)
 */
export function getPriorityDisplay(priority: any): string {
  const normalizedPriority = normalizePriority(priority);
  return `${normalizedPriority} • ${PRIORITY_LABELS[normalizedPriority]}`;
}

/**
 * Get the CSS classes for priority badge styling
 */
export function getPriorityColors(priority: any): string {
  const normalizedPriority = normalizePriority(priority);
  return PRIORITY_COLORS[normalizedPriority];
}

/**
 * Get all priority options for dropdowns/selectors
 */
export function getPriorityOptions(): Array<{ value: Priority; label: string; display: string }> {
  return [
    { value: 5, label: 'Highest', display: '5 - Highest' },
    { value: 4, label: 'High', display: '4 - High' },
    { value: 3, label: 'Medium', display: '3 - Medium' },
    { value: 2, label: 'Low', display: '2 - Low' },
    { value: 1, label: 'Lowest', display: '1 - Lowest' }
  ];
}

/**
 * Sort tasks by priority (higher numbers = higher priority)
 */
export function comparePriority(a: Priority, b: Priority): number {
  return b - a; // Higher numbers first (5, 4, 3, 2, 1)
}