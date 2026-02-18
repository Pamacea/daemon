/**
 * Detection Types
 *
 * Types for project detection and analysis results.
 */

import type { Framework, Language, TestRunner } from './project.types.js';

/**
 * Database type enumeration
 */
export type DatabaseType =
  | 'Prisma Postgres'
  | 'Prisma MySQL'
  | 'Prisma SQLite'
  | 'Prisma MongoDB'
  | 'Prisma CockroachDB'
  | 'Prisma'
  | 'Drizzle ORM'
  | 'TypeORM'
  | 'MikroORM'
  | 'MongoDB (Mongoose)'
  | 'Neon Postgres'
  | 'Supabase Postgres'
  | 'PlanetScale MySQL'
  | 'Turso SQLite'
  | 'Local Database'
  | 'Railway'
  | 'Render'
  | 'None';

/**
 * Dependency category
 */
export type DependencyCategory =
  | 'Router'
  | 'State'
  | 'Query'
  | 'Forms'
  | 'UI'
  | 'Testing'
  | 'E2E'
  | 'Framework';

/**
 * Test strategy enum
 */
export enum TestStrategy {
  /** Wrap tests in transaction and rollback */
  TransactionRollback = 'transaction-rollback',
  /** Truncate all tables after each test */
  Truncate = 'truncate',
  /** Drop and recreate schema */
  DropSchema = 'drop-schema',
  /** Use mock database */
  Mock = 'mock',
  /** No isolation strategy */
  None = 'none',
}

/**
 * Pattern match type
 */
export type PatternType = 'file-exists' | 'package-json' | 'config-file' | 'content-match';

/**
 * Base pattern interface
 */
export interface BasePattern {
  /** Type of pattern */
  type: PatternType;
  /** File path relative to project root */
  file: string;
  /** Priority for scoring (higher = more specific) */
  priority: number;
}

/**
 * File existence pattern
 */
export interface FileExistsPattern extends BasePattern {
  type: 'file-exists';
  /** Whether file should exist */
  shouldExist: boolean;
}

/**
 * Package JSON pattern
 */
export interface PackageJsonPattern extends BasePattern {
  type: 'package-json';
  /** Regex to match in package.json */
  pattern: RegExp;
  /** Check dependencies or devDependencies or both */
  scope: 'dependencies' | 'devDependencies' | 'both';
}

/**
 * Content match pattern
 */
export interface ContentMatchPattern extends BasePattern {
  type: 'content-match';
  /** Regex to match in file content */
  pattern: RegExp;
}

/**
 * Combined pattern union
 */
export type DetectionPattern = FileExistsPattern | PackageJsonPattern | ContentMatchPattern;

/**
 * Framework pattern configuration
 */
export interface FrameworkPattern {
  /** Framework name */
  name: Framework;
  /** Detection patterns */
  patterns: DetectionPattern[];
  /** Frameworks that this pattern excludes */
  excludes?: Framework[];
  /** Confidence score threshold */
  confidenceThreshold: number;
}

/**
 * Database pattern configuration
 */
export interface DatabasePattern {
  /** Database/ORM name */
  name: DatabaseType;
  /** Package name to detect */
  packagePattern: RegExp;
  /** Schema file path */
  schemaPath?: string;
  /** Provider pattern in schema */
  providerPattern?: RegExp;
  /** Default test strategy */
  defaultStrategy: TestStrategy;
}

/**
 * Test runner pattern configuration
 */
export interface TestRunnerPattern {
  /** Test runner name */
  name: TestRunner;
  /** Package name to detect */
  packagePattern: RegExp;
  /** Config file names */
  configFiles: string[];
  /** File extensions for test files */
  testExtensions: string[];
}

/**
 * Detection result for a single category
 */
export interface DetectionResult<T = string> {
  /** Detected value */
  value: T | null;
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence/sources for the detection */
  evidence: string[];
  /** Alternative candidates with lower confidence */
  alternatives?: Array<{ value: T; confidence: number }>;
}

/**
 * Dependency detection result
 */
export interface DependencyDetection {
  /** Category */
  category: DependencyCategory;
  /** Detected package name */
  packageName: string;
  /** Version if found */
  version?: string;
}

/**
 * Coverage information
 */
export interface CoverageInfo {
  /** Line coverage percentage */
  lines: number;
  /** Branch coverage percentage */
  branches: number;
  /** Function coverage percentage */
  functions: number;
  /** Statement coverage percentage */
  statements: number;
  /** Overall percentage */
  total: number;
}

/**
 * Test file count result
 */
export interface TestCountResult {
  /** Total test files found */
  total: number;
  /** Breakdown by extension */
  byExtension: Record<string, number>;
  /** Test files in src directory */
  inSrc: number;
  /** Test files outside src directory */
  outsideSrc: number;
}

/**
 * Full detection results
 *
 * Complete output of project analysis
 */
export interface DetectionResults {
  /** Framework detection */
  framework: DetectionResult<Framework>;
  /** Language detection */
  language: DetectionResult<Language>;
  /** Test runner detection */
  testRunner: DetectionResult<TestRunner>;
  /** Database detection */
  database: DetectionResult<DatabaseType>;
  /** Detected dependencies */
  dependencies: DependencyDetection[];
  /** Test file counts */
  testCounts: TestCountResult;
  /** Coverage if available */
  coverage: CoverageInfo | null;
  /** Analysis duration in milliseconds */
  duration: number;
  /** Analysis timestamp */
  timestamp: Date;
}

/**
 * Detection error types
 */
export type DetectionErrorType =
  | 'project-not-found'
  | 'invalid-package-json'
  | 'access-denied'
  | 'timeout'
  | 'unknown';

/**
 * Detection error
 */
export interface DetectionError {
  /** Error type */
  type: DetectionErrorType;
  /** Error message */
  message: string;
  /** Path that caused the error */
  path?: string;
  /** Original error if available */
  cause?: unknown;
}

/**
 * Detection options
 */
export interface DetectionOptions {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Maximum time to spend detecting (ms) */
  timeout?: number;
  /** Specific patterns to detect */
  targets?: Array<'framework' | 'language' | 'testRunner' | 'database' | 'dependencies'>;
  /** Paths to exclude from scanning */
  excludePaths?: string[];
  /** Custom patterns to include */
  customPatterns?: {
    frameworks?: FrameworkPattern[];
    databases?: DatabasePattern[];
    testRunners?: TestRunnerPattern[];
  };
}
