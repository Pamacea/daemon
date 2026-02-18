/**
 * Core Types Barrel Export
 *
 * Centralized exports for all core types
 */

// Project types
export type {
  Framework,
  Language,
  TestRunner,
  DatabaseInfo,
  ProjectContext,
  PackageJson,
  DaemonConfig,
} from './project.types.js';

// Detection types
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
  DependencyDetection,
  CoverageInfo,
  TestCountResult,
  DetectionResults,
  DetectionErrorType,
  DetectionError,
  DetectionOptions,
  TestStrategy,
  DatabaseType,
  DependencyCategory,
} from './detection.types.js';

// Docker types
export type {
  ContainerStatus,
  ImageArchitecture,
  DockerExecOptions,
  DockerExecResult,
  DockerConfig,
  DockerBuildOptions,
  DockerCreateOptions,
  ContainerInspectResult,
  ImageInspectResult,
  DockerLogOptions,
  DockerResult,
  DockerHealthStatus,
  DockerVolume,
  DockerNetwork,
  DockerSystemInfo,
} from './docker.types.js';

// Test types
export type {
  TestType,
  TestStatus,
  TestFormat,
  TestResult,
  TestSuiteResult,
  TestSummary,
  CoverageMetrics,
  CoverageReport,
  FileCoverage,
  TestGenerationOptions,
  TestGenerationResult,
  PerformanceThreshold,
  PerformanceTestResult,
  LoadTestConfig,
  LoadTestResult,
} from './test.types.js';

// Common types
export type {
  Result,
  SuccessType,
  ErrorType,
  BaseOptions,
  AsyncResult,
  Maybe,
  Nullable,
  Optional,
  DeepPartial,
  DeepReadonly,
  DeepRequired,
  ValueOf,
  Tuple,
  EnumValues,
  RequireKeys,
  OptionalKeys,
  Comparable,
  AsyncFunction,
  SyncFunction,
  AnyFunction,
  Constructor,
  AbstractConstructor,
  Class,
  Mutable,
  Prettify,
  EventListener,
  Observer,
  Observable,
  RetryOptions,
  ThrottleOptions,
  DebounceOptions,
  ProgressCallback,
  ProgressResult,
} from './common.types.js';
