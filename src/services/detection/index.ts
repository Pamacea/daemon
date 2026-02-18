/**
 * Detection Services Barrel Export
 *
 * Central export point for all detection-related services
 */

export { FrameworkDetector, getFrameworkDetector, detectFramework } from './framework-detector.js';
export type {
  FrameworkDetectorOptions,
  FrameworkScore,
} from './framework-detector.js';

// Re-export commonly used types
export type {
  Framework,
  Language,
  TestRunner,
  DatabaseInfo,
  PackageJson,
} from '../../core/types/project.types.js';

export type {
  PatternType,
  BasePattern,
  FileExistsPattern,
  PackageJsonPattern,
  ContentMatchPattern,
  DetectionPattern,
  FrameworkPattern,
  DatabasePattern,
  TestRunnerPattern,
  DetectionResult,
  DetectionError,
  DetectionOptions,
  TestStrategy,
} from '../../core/types/detection.types.js';
