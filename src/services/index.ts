/**
 * Services Barrel Export
 *
 * Central export point for all services
 */

// Detection services
export {
  FrameworkDetector,
  getFrameworkDetector,
  detectFramework,
} from './detection/index.js';
export type {
  FrameworkDetectorOptions,
  FrameworkScore,
} from './detection/index.js';

// Re-export detection types
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
} from './detection/index.js';

// Re-export project types
export type {
  Framework,
  Language,
  TestRunner,
  DatabaseInfo,
  PackageJson,
} from '../core/types/project.types.js';
