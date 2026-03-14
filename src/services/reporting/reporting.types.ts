/**
 * Reporting & History Types
 *
 * Types for the reporting and historical tracking system.
 * Extends core scoring types with reporting-specific functionality.
 */

import type { CodeDimension } from '../../core/types/scoring.types.js';

// Re-export core types to avoid duplication
export type { CodeDimension } from '../../core/types/scoring.types.js';
export type { ProjectScore } from '../../core/types/scoring.types.js';

/**
 * Report format types
 */
export type ReportFormat = 'html' | 'markdown' | 'json' | 'junit';

/**
 * Issue severity levels (aligned with core types)
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Status indicators for dimension scores
 */
export type DimensionStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/**
 * Issue detected during reporting (simplified for reporting)
 */
export interface ReportIssue {
  /** Issue severity */
  severity: IssueSeverity;
  /** Issue category */
  category: string;
  /** Issue message */
  message: string;
  /** File path where issue was found */
  file?: string;
  /** Line number */
  line?: number;
  /** Suggestion for fixing */
  suggestion?: string;
  /** Rule or check that generated this issue */
  rule?: string;
}

/**
 * Dimension score details for reporting
 */
export interface ReportDimensionScore {
  /** Score value (0-100) */
  score: number;
  /** Weight in overall calculation */
  weight: number;
  /** Status indicator */
  status: DimensionStatus;
  /** Issues found in this dimension */
  issues: ReportIssue[];
}

/**
 * Extended project score for reporting with additional metadata
 */
export interface ExtendedProjectScore {
  /** Overall score (0-100) */
  overall: number;
  /** Score per dimension */
  dimensions: Record<string, ReportDimensionScore>;
  /** All issues aggregated */
  issues: ReportIssue[];
  /** Timestamp when score was calculated */
  timestamp: Date;
  /** Project path */
  projectPath: string;
  /** Git commit hash */
  commit?: string;
  /** Git branch */
  branch?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Score snapshot for historical tracking
 */
export interface ScoreSnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: Date;
  /** Git commit hash */
  commit: string;
  /** Git branch */
  branch: string;
  /** Overall score */
  overall: number;
  /** Dimension scores */
  dimensions: Record<string, ReportDimensionScore>;
  /** Number of issues */
  issueCount: number;
  /** Critical issues count */
  criticalCount: number;
}

/**
 * Score trend information
 */
export interface ScoreTrend {
  /** Dimension or 'overall' */
  dimension: CodeDimension | 'overall';
  /** Current score value */
  current: number;
  /** Previous score value */
  previous: number;
  /** Score difference */
  delta: number;
  /** Trend direction */
  trend: 'improving' | 'stable' | 'declining';
  /** Historical values for charting */
  history: number[];
  /** Timestamps for history values */
  timestamps: Date[];
}

/**
 * Regression detected
 */
export interface Regression {
  /** Dimension that regressed */
  dimension: CodeDimension | 'overall';
  /** Previous score */
  previousScore: number;
  /** Current score */
  currentScore: number;
  /** Score drop amount */
  drop: number;
  /** Severity of regression */
  severity: 'minor' | 'moderate' | 'severe';
}

/**
 * Improvement detected
 */
export interface Improvement {
  /** Dimension that improved */
  dimension: CodeDimension | 'overall';
  /** Previous score */
  previousScore: number;
  /** Current score */
  currentScore: number;
  /** Score increase amount */
  increase: number;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  /** Overall trend */
  overallTrend: ScoreTrend;
  /** Per-dimension trends */
  dimensionTrends: Record<string, ScoreTrend>;
  /** Detected regressions */
  regressions: Regression[];
  /** Detected improvements */
  improvements: Improvement[];
  /** Development velocity (points per snapshot) */
  velocity: number;
  /** Analysis period */
  period: {
    start: Date;
    end: Date;
    snapshotCount: number;
  };
}

/**
 * Trend prediction
 */
export interface TrendPrediction {
  /** Dimension being predicted */
  dimension: CodeDimension | 'overall';
  /** Current score */
  current: number;
  /** Predicted score */
  predicted: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Prediction horizon (snapshots) */
  horizon: number;
  /** Predicted trend */
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Comparison between two snapshots
 */
export interface Comparison {
  /** Before snapshot */
  before: ScoreSnapshot;
  /** After snapshot */
  after: ScoreSnapshot;
  /** Overall score change */
  overallChange: number;
  /** Dimension changes */
  dimensionChanges: Record<string, {
    before: number;
    after: number;
    delta: number;
    trend: 'improving' | 'stable' | 'declining';
  }>;
  /** New issues added */
  addedIssues: ReportIssue[];
  /** Issues resolved */
  resolvedIssues: ReportIssue[];
  /** Summary of comparison */
  summary: string;
}

/**
 * Generated report
 */
export interface Report {
  /** Report format */
  format: ReportFormat;
  /** Report content */
  content: string;
  /** Report timestamp */
  timestamp: Date;
  /** Project path */
  projectPath: string;
  /** Score used for report */
  score: ExtendedProjectScore;
  /** Optional trend data */
  trend?: TrendAnalysis;
}

/**
 * History storage format
 */
export interface HistoryStorage {
  /** Project path */
  projectPath: string;
  /** Score snapshots */
  scores: ScoreSnapshot[];
  /** Storage version */
  version: number;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Chart configuration
 */
export interface ChartConfig {
  /** Chart width */
  width: number;
  /** Chart height */
  height: number;
  /** Primary color */
  color?: string;
  /** Secondary color */
  secondaryColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** Show grid */
  showGrid?: boolean;
  /** Show labels */
  showLabels?: boolean;
}

/**
 * Gauge chart options
 */
export interface GaugeOptions extends ChartConfig {
  /** Score value (0-100) */
  value: number;
  /** Gauge label */
  label: string;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Color zones */
  zones?: Array<{
    from: number;
    to: number;
    color: string;
  }>;
}

/**
 * Trend chart data point
 */
export interface TrendDataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Value */
  value: number;
  /** Optional label */
  label?: string;
}

/**
 * Bar chart data
 */
export interface BarChartData {
  /** Bar label */
  label: string;
  /** Bar value */
  value: number;
  /** Optional color override */
  color?: string;
}

/**
 * Report generation options
 */
export interface ReportOptions {
  /** Include trend data */
  includeTrend?: boolean;
  /** Include recommendations */
  includeRecommendations?: boolean;
  /** Theme for HTML reports */
  theme?: 'light' | 'dark' | 'auto';
  /** Number of historical snapshots to include */
  historyLimit?: number;
  /** Custom title */
  title?: string;
  /** Include charts in HTML report */
  includeCharts?: boolean;
}

/**
 * Test result for JUnit reports (re-export from test types)
 */
export interface TestResultForReport {
  /** Test name/identifier */
  name: string;
  /** Test file path */
  file: string;
  /** Test status */
  status: 'passed' | 'failed' | 'skipped' | 'timed-out';
  /** Execution duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Error stack trace if failed */
  stack?: string;
}
