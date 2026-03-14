/**
 * Scoring Types
 *
 * Core types for the project scoring system.
 * Provides a comprehensive framework for evaluating code quality across multiple dimensions.
 */

/**
 * Code dimensions that can be scored
 *
 * Each dimension represents a specific aspect of code quality that can be measured and improved.
 */
export type CodeDimension =
  | 'test-coverage'
  | 'code-quality'
  | 'performance'
  | 'security'
  | 'accessibility'
  | 'ui-ux'
  | 'backend-logic'
  | 'business-logic'
  | 'seo';

/**
 * Severity levels for issues
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Issue categories for grouping problems
 */
export type IssueCategory =
  | 'testing'
  | 'code-style'
  | 'performance'
  | 'security'
  | 'a11y'
  | 'ux'
  | 'architecture'
  | 'documentation'
  | 'error-handling'
  | 'type-safety'
  | 'seo';

/**
 * Improvement types for recommendations
 */
export type ImprovementType =
  | 'add-test'
  | 'refactor'
  | 'optimize'
  | 'secure'
  | 'document'
  | 'type-safe'
  | 'accessibility'
  | 'performance'
  | 'seo';

/**
 * Effort estimation for fixes/improvements
 */
export type Effort = 'quick' | 'moderate' | 'significant' | 'major';

/**
 * Impact level for improvements
 */
export type Impact = 'low' | 'medium' | 'high' | 'critical';

/**
 * Priority levels for recommendations
 */
export type Priority = 'p0' | 'p1' | 'p2' | 'p3';

/**
 * Score grade for overall assessment
 */
export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Trend direction for score changes
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Represents a single issue found during scoring
 *
 * Issues are specific problems identified in the code that negatively impact the score.
 */
export interface Issue {
  /** Severity level of the issue */
  severity: IssueSeverity;
  /** Category the issue belongs to */
  category: IssueCategory;
  /** Human-readable description of the issue */
  description: string;
  /** File path where the issue was found (if applicable) */
  location?: string;
  /** Line number (if applicable) */
  line?: number;
  /** Whether this issue can be automatically fixed */
  fixable: boolean;
  /** Suggested fix (if available) */
  suggestion?: string;
  /** Rule or check that triggered this issue */
  rule?: string;
}

/**
 * Represents a potential improvement for the codebase
 *
 * Improvements are actionable suggestions to enhance code quality beyond fixing issues.
 */
export interface Improvement {
  /** Type of improvement */
  type: ImprovementType;
  /** Description of what to improve */
  description: string;
  /** Estimated effort to implement */
  effort: Effort;
  /** Expected impact on quality */
  impact: Impact;
  /** Specific location if applicable */
  location?: string;
  /** Detailed steps to implement */
  steps?: string[];
}

/**
 * Score for a single dimension
 *
 * Contains the score, weight, issues found, and potential improvements for one dimension.
 */
export interface DimensionScore {
  /** The dimension being scored */
  dimension: CodeDimension;
  /** Score from 0-100 */
  score: number;
  /** Weight of this dimension in overall score (0-1) */
  weight: number;
  /** Weighted score contribution (calculated by ScoringService) */
  weightedScore?: number;
  /** Issues found in this dimension */
  issues: Issue[];
  /** Potential improvements for this dimension */
  improvements: Improvement[];
  /** Additional metadata about the scoring */
  metadata?: {
    /** Number of items checked (e.g., lines of code, files) */
    itemsChecked?: number;
    /** Number of items that passed */
    itemsPassed?: number;
    /** Custom metrics */
    metrics?: Record<string, number | string>;
    /** Error message if analysis failed */
    error?: string;
  };
}

/**
 * Trend information for score tracking over time
 */
export interface ScoreTrend {
  /** Current score value */
  current: number;
  /** Previous score value */
  previous: number;
  /** Difference between current and previous */
  delta: number;
  /** Direction of change */
  direction: TrendDirection;
  /** Timestamp of the current score */
  timestamp: Date;
  /** Timestamp of the previous score */
  previousTimestamp?: Date;
}

/**
 * Recommendation for improving the project
 *
 * Aggregates issues and improvements into actionable recommendations.
 */
export interface Recommendation {
  /** Priority level (P0 = highest) */
  priority: Priority;
  /** Category this recommendation belongs to */
  category: IssueCategory;
  /** Title of the recommendation */
  title: string;
  /** Detailed description */
  description: string;
  /** Estimated effort to implement */
  effort: Effort;
  /** Related dimension */
  dimension?: CodeDimension;
  /** Related issues that this recommendation addresses */
  issueCount: number;
  /** Specific action items */
  actions: string[];
}

/**
 * Historical score entry for tracking progress
 */
export interface HistoricalScore {
  /** Unique identifier for this score entry */
  id: string;
  /** Project path this score is for */
  projectPath: string;
  /** Overall score at this point in time */
  overallScore: number;
  /** All dimension scores */
  dimensions: DimensionScore[];
  /** Timestamp when the score was recorded */
  timestamp: Date;
  /** Git commit hash if available */
  commitHash?: string;
  /** Git branch if available */
  branch?: string;
  /** Daemon version that generated this score */
  daemonVersion?: string;
}

/**
 * Complete project score result
 *
 * The main output of the scoring system containing all dimension scores,
 * overall score, trends, and recommendations.
 */
export interface ProjectScore {
  /** Overall project score (0-100) */
  overall: number;
  /** Letter grade representation */
  grade: ScoreGrade;
  /** Individual dimension scores */
  dimensions: DimensionScore[];
  /** Trend information if historical data exists */
  trend?: ScoreTrend;
  /** Prioritized recommendations for improvement */
  recommendations: Recommendation[];
  /** Project path that was scored */
  projectPath: string;
  /** Detected framework (for context) */
  framework?: string;
  /** Timestamp of scoring */
  timestamp: Date;
  /** Duration of the scoring process in milliseconds */
  duration: number;
  /** Daemon version that generated this score */
  daemonVersion: string;
}

/**
 * Options for scoring a project
 */
export interface ScoringOptions {
  /** Specific dimensions to score (default: all) */
  dimensions?: CodeDimension[];
  /** Enable historical trend tracking */
  includeTrend?: boolean;
  /** Maximum number of recommendations to return */
  maxRecommendations?: number;
  /** Minimum severity level for issues to include */
  minSeverity?: IssueSeverity;
  /** Custom weights for dimensions (default: equal weights) */
  weights?: Partial<Record<CodeDimension, number>>;
  /** Enable verbose output */
  verbose?: boolean;
  /** Skip dimensions that aren't applicable */
  skipInapplicable?: boolean;
  /** Number of historical entries to compare for trend */
  trendHistorySize?: number;
  /** Whether to save the score for future comparisons */
  saveForHistory?: boolean;
  /** Custom project path (defaults to current directory) */
  projectPath?: string;
}

/**
 * Configuration for a specific dimension analyzer
 */
export interface DimensionAnalyzerConfig {
  /** The dimension this analyzer handles */
  dimension: CodeDimension;
  /** Default weight for this dimension (0-1) */
  defaultWeight: number;
  /** Whether this dimension requires the project to be running */
  requiresRunningProject?: boolean;
  /** Estimated time to analyze this dimension */
  estimatedDuration?: number;
  /** Frameworks this analyzer supports (empty = all) */
  supportedFrameworks?: string[];
  /** Languages this analyzer supports (empty = all) */
  supportedLanguages?: string[];
}

/**
 * Result of comparing two scores
 */
export interface ScoreComparison {
  /** Score before changes */
  before: ProjectScore;
  /** Score after changes */
  after: ProjectScore;
  /** Overall change */
  overallChange: number;
  /** Per-dimension changes */
  dimensionChanges: Map<CodeDimension, number>;
  /** New issues introduced */
  newIssues: Issue[];
  /** Issues that were resolved */
  resolvedIssues: Issue[];
  /** Net change in issue count */
  issueCountDelta: number;
}

/**
 * Score summary for quick reporting
 */
export interface ScoreSummary {
  /** Overall score */
  overall: number;
  /** Letter grade */
  grade: ScoreGrade;
  /** Total issues by severity */
  issuesBySeverity: Record<IssueSeverity, number>;
  /** Top dimensions needing improvement */
  weakDimensions: CodeDimension[];
  /** Strong dimensions */
  strongDimensions: CodeDimension[];
  /** Priority recommendation count */
  priorityRecommendations: number;
}

/**
 * Scoring error types
 */
export type ScoringErrorType =
  | 'project-not-found'
  | 'invalid-framework'
  | 'analyzer-failed'
  | 'timeout'
  | 'permission-denied'
  | 'invalid-dimension'
  | 'history-save-failed';

/**
 * Error result from scoring operation
 */
export interface ScoringError {
  /** Type of error */
  type: ScoringErrorType;
  /** Error message */
  message: string;
  /** Dimension that caused the error (if applicable) */
  dimension?: CodeDimension;
  /** Original error if wrapping another error */
  cause?: Error;
}
