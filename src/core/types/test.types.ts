/**
 * Test Types
 *
 * Types for test generation, execution, and reporting.
 */

/**
 * Test type categories
 */
export type TestType =
  | 'unit'
  | 'integration'
  | 'e2e'
  | 'performance'
  | 'load'
  | 'security';

/**
 * Test status states
 */
export type TestStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'timed-out';

/**
 * Test file format
 */
export type TestFormat = 'ts' | 'js' | 'tsx' | 'jsx';

/**
 * Single test result
 */
export interface TestResult {
  /** Test name/identifier */
  name: string;
  /** Test file path */
  file: string;
  /** Test status */
  status: TestStatus;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Error stack trace if failed */
  stack?: string;
  /** Retry attempt number */
  retry?: number;
  /** Flaky detection */
  flaky?: boolean;
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  /** Suite name */
  name: string;
  /** File path */
  file: string;
  /** Individual test results */
  tests: TestResult[];
  /** Total duration in milliseconds */
  duration: number;
  /** Suite status (derived from tests) */
  status: TestStatus;
  /** Number of passed tests */
  passed: number;
  /** Number of failed tests */
  failed: number;
  /** Number of skipped tests */
  skipped: number;
}

/**
 * Test run summary
 */
export interface TestSummary {
  /** Total number of tests */
  total: number;
  /** Number of passed tests */
  passed: number;
  /** Number of failed tests */
  failed: number;
  /** Number of skipped tests */
  skipped: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Overall success status */
  success: boolean;
  /** Test suites */
  suites: TestSuiteResult[];
  /** Test run timestamp */
  timestamp: Date;
}

/**
 * Coverage metrics
 */
export interface CoverageMetrics {
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
 * Coverage report
 */
export interface CoverageReport {
  /** Coverage metrics */
  metrics: CoverageMetrics;
  /** Coverage by file */
  files: FileCoverage[];
  /** Uncovered lines by file */
  uncovered: Record<string, number[]>;
  /** Report timestamp */
  timestamp: Date;
}

/**
 * File coverage information
 */
export interface FileCoverage {
  /** File path */
  path: string;
  /** Line coverage percentage */
  lines: number;
  /** Branch coverage percentage */
  branches: number;
  /** Function coverage percentage */
  functions: number;
  /** Statement coverage percentage */
  statements: number;
  /** Total percentage */
  total: number;
  /** Uncovered line numbers */
  uncoveredLines: number[];
}

/**
 * Test generation options
 */
export interface TestGenerationOptions {
  /** Test type to generate */
  type: TestType;
  /** Source file to test */
  sourceFile: string;
  /** Output directory */
  outputDir: string;
  /** Test framework */
  framework: 'vitest' | 'jest' | 'mocha' | 'playwright' | 'cypress';
  /** Include coverage setup */
  includeCoverage?: boolean;
  /** Generate snapshot tests */
  snapshots?: boolean;
  /** Test file format */
  format?: TestFormat;
  /** Custom template path */
  templatePath?: string;
}

/**
 * Test generation result
 */
export interface TestGenerationResult {
  /** Number of files generated */
  filesGenerated: number;
  /** Generated file paths */
  files: string[];
  /** Generation duration in milliseconds */
  duration: number;
  /** Warnings during generation */
  warnings: string[];
}

/**
 * Performance test threshold
 */
export interface PerformanceThreshold {
  /** Metric name */
  metric: string;
  /** Maximum expected value */
  max: number;
  /** Minimum expected value */
  min?: number;
  /** Unit of measurement */
  unit: 'ms' | 'bytes' | 'count' | 'percent';
}

/**
 * Performance test result
 */
export interface PerformanceTestResult {
  /** Test name */
  name: string;
  /** Metric values */
  metrics: Record<string, number>;
  /** Threshold results */
  thresholds: Array<{
    metric: string;
    passed: boolean;
    actual: number;
    expected: number;
  }>;
  /** Overall pass/fail */
  passed: boolean;
}

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  /** Number of virtual users */
  vus: number;
  /** Test duration */
  duration: string;
  /** Target URL */
  target: string;
  /** Requests per second limit */
  rps?: number;
  /** Stages for ramp-up */
  stages?: Array<{ duration: string; target: number }>;
}

/**
 * Load test result
 */
export interface LoadTestResult {
  /** Total requests made */
  totalRequests: number;
  /** Requests per second */
  rps: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** p95 response time in milliseconds */
  p95ResponseTime: number;
  /** p99 response time in milliseconds */
  p99ResponseTime: number;
  /** Error rate percentage */
  errorRate: number;
  /** Test passed thresholds */
  passed: boolean;
}
