/**
 * Optimization Service Barrel Export
 *
 * Central export point for all optimization-related services and types.
 */

import { OptimizationService } from './optimization.service.js';
import type {
  DetectionOptions,
  DetectAndOptimizeOptions,
  OptimizationReport,
} from './optimization.types.js';

// Main service
export { OptimizationService } from './optimization.service.js';

// Detectors
export { BugDetector } from './detectors/bug-detector.js';
export { PerfDetector } from './detectors/perf-detector.js';
export { CodeSmellDetector } from './detectors/code-smell-detector.js';

// Optimizers
export { CodeOptimizer } from './optimizers/code-optimizer.js';
export { PerfOptimizer } from './optimizers/perf-optimizer.js';
export { RefactOptimizer } from './optimizers/refact-optimizer.js';

// Patterns
export {
  ANTI_PATTERNS,
  getAntiPatternsByCategory,
  getAntiPatternById,
  getAntiPatternsBySeverity,
  findMatchingAntiPatterns,
} from './patterns/anti-patterns.js';

// Types
export type {
  // Core types
  BugType,
  DetectedBug,
  Location,
  Severity,

  // Performance types
  PerfCategory,
  PerformanceIssue,
  Metric,

  // Code smell types
  CodeSmellType,
  CodeSmell,

  // Report types
  OptimizationReport,
  OptimizationResult,
  OptimizationStats,

  // Optimization types
  AppliedOptimization,
  Suggestion,
  OptimizationError,
  PriorityScore,

  // Options types
  DetectionOptions,
  OptimizationOptions,
  DetectAndOptimizeOptions,

  // Pattern types
  AntiPattern,
  PatternMatcher,

  // Analysis types
  FileAnalysis,
} from './optimization.types.js';

/**
 * Default optimization service instance
 */
export const optimizationService = new OptimizationService();

/**
 * Convenience function to detect issues in a project
 *
 * @example
 * ```ts
 * import { detectOptimizations } from '@pamacea/daemon';
 *
 * const report = await detectOptimizations('/path/to/project');
 * console.log(`Found ${report.bugs.length} bugs`);
 * ```
 */
export async function detectOptimizations(
  projectPath: string,
  options?: DetectionOptions
) {
  return optimizationService.detect(projectPath, options);
}

/**
 * Convenience function to detect and optimize in one operation
 *
 * @example
 * ```ts
 * import { detectAndOptimize } from '@pamacea/daemon';
 *
 * const result = await detectAndOptimize('/path/to/project', {
 *   autoFix: true,
 *   maxFixes: 10,
 * });
 * console.log(`Applied ${result.appliedOptimizations.length} optimizations`);
 * ```
 */
export async function detectAndOptimize(
  projectPath: string,
  options?: DetectAndOptimizeOptions
) {
  return optimizationService.detectAndOptimize(projectPath, options);
}

/**
 * Convenience function to generate a summary report
 *
 * @example
 * ```ts
 * import { generateReport } from '@pamacea/daemon';
 *
 * const report = await detectOptimizations('/path/to/project');
 * const summary = generateReport(report);
 * console.log(summary);
 * ```
 */
export function generateReport(report: OptimizationReport): string {
  return optimizationService.generateSummary(report);
}
