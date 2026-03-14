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

// Scoring services
export {
  ScoringService,
  getScoringService,
  scoreProject,
} from './scoring/index.js';
export type {
  ScoringServiceOptions,
  DimensionAnalyzer,
} from './scoring/index.js';

// Re-export scoring types
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
} from '../core/types/scoring.types.js';

// Reporting & History services
export {
  ReportService,
  HistoryService,
  TrendAnalyzer,
  HtmlTemplate,
  MarkdownTemplate,
  JsonTemplate,
  ChartExporter,
  PdfExporter,
  PrintPdfExporter,
} from './reporting/index.js';

export type {
  ReportFormat,
  ScoreSnapshot,
  Regression,
  TrendAnalysis,
  TrendPrediction,
  Comparison,
  Report,
  HistoryStorage,
  ChartConfig,
  GaugeOptions,
  TrendDataPoint,
  BarChartData,
  ReportOptions,
  PdfExportOptions,
} from './reporting/index.js';

// Optimization services
export {
  OptimizationService,
  BugDetector,
  PerfDetector,
  CodeSmellDetector,
  CodeOptimizer,
  PerfOptimizer,
  RefactOptimizer,
  optimizationService,
  detectOptimizations,
  detectAndOptimize as detectAndOptimizeCode,
  generateReport as generateOptimizationReport,
  ANTI_PATTERNS,
  getAntiPatternsByCategory,
  getAntiPatternById,
  getAntiPatternsBySeverity,
  findMatchingAntiPatterns,
} from './optimization/index.js';

// Review & Fix services
export {
  ReviewService,
  getReviewService,
  analyzeProject,
  analyzeAndFixProject,
} from './review/index.js';

export type {
  Issue as ReviewIssue,
  Fix as ReviewFix,
  Suggestion as ReviewSuggestion,
  ProjectScore as ReviewProjectScore,
  ReviewResult,
  ReviewOptions,
  FixResult as ReviewFixResult,
  FixOptions as ReviewFixOptions,
  ReportOptions as ReviewReportOptions,
  ReportFormat as ReviewReportFormat,
  IssueCategory as ReviewIssueCategory,
  IssueSeverity as ReviewIssueSeverity,
  Location as ReviewLocation,
  DependencyInfo,
  DependencyAnalysis,
  PerformanceMetrics as ReviewPerformanceMetrics,
  CoverageStats as ReviewCoverageStats,
  StaticAnalyzerConfig,
  SecurityAnalyzerConfig,
  DependencyAnalyzerConfig,
  PerformanceAnalyzerConfig,
  GeneratedTest,
  TestGenerationResult,
} from './review/index.js';

// Review analyzers
export {
  StaticAnalyzer,
  SecurityAnalyzer,
  DependencyAnalyzer,
  PerformanceAnalyzer,
} from './review/analyzers/index.js';

// Review fixers
export {
  AutoFixer,
  TestGenerator,
  RefactorSuggester,
} from './review/fixers/index.js';

// Review reporters
export {
  ScoreReporter,
  FixReporter,
} from './review/reporters/index.js';

export type {
  BugType,
  DetectedBug,
  Location,
  Severity,
  PerfCategory,
  PerformanceIssue,
  Metric,
  CodeSmellType,
  CodeSmell,
  OptimizationReport,
  OptimizationResult,
  OptimizationStats,
  AppliedOptimization,
  Suggestion,
  OptimizationError,
  PriorityScore,
  DetectionOptions as OptimizationDetectionOptions,
  OptimizationOptions,
  DetectAndOptimizeOptions,
  AntiPattern,
  PatternMatcher,
  FileAnalysis,
} from './optimization/index.js';
