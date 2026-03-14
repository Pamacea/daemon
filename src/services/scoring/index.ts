/**
 * Scoring Service Barrel Export
 *
 * Central export point for the scoring system
 */

// Main scoring service
export {
  ScoringService,
  getScoringService,
  scoreProject,
  getScoringServiceWithDefaults,
} from './scoring-service.js';

// Types
export type {
  ScoringServiceOptions,
  DimensionAnalyzer,
} from './scoring-service.js';

// Re-export scoring types from core
export type {
  DimensionScore,
  CodeDimension,
  ProjectScore,
  Issue,
  Improvement,
  ScoreTrend,
  Recommendation,
  ScoringOptions,
  IssueSeverity,
  IssueCategory,
  ImprovementType,
  Effort,
  Impact,
  Priority,
  ScoreGrade,
  TrendDirection,
  HistoricalScore,
  DimensionAnalyzerConfig,
  ScoreComparison,
  ScoreSummary,
  ScoringError,
  ScoringErrorType,
} from '../../core/types/scoring.types.js';

// Dimension analyzers
export {
  TestCoverageAnalyzer,
  testCoverageAnalyzer,
  CodeQualityAnalyzer,
  codeQualityAnalyzer,
  PerformanceAnalyzer,
  performanceAnalyzer,
  SecurityAnalyzer,
  securityAnalyzer,
  AccessibilityAnalyzer,
  accessibilityAnalyzer,
  UiUxAnalyzer,
  uiUxAnalyzer,
  BackendLogicAnalyzer,
  backendLogicAnalyzer,
  BusinessLogicAnalyzer,
  businessLogicAnalyzer,
} from './dimensions/index.js';
