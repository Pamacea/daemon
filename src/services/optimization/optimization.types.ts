/**
 * Optimization Types
 *
 * Types for the optimization service including bug detection,
 * performance analysis, and code smell detection.
 */

/**
 * Bug types that can be detected
 */
export type BugType =
  | 'memory-leak'
  | 'race-condition'
  | 'null-reference'
  | 'infinite-loop'
  | 'missing-error-handling'
  | 'sql-injection'
  | 'xss'
  | 'missing-validation'
  | 'unused-variable'
  | 'dead-code';

/**
 * Severity levels for bugs and issues
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Performance issue categories
 */
export type PerfCategory =
  | 'react-rendering'
  | 'api-efficiency'
  | 'database-queries'
  | 'bundle-size'
  | 'asset-optimization'
  | 'css-optimization'
  | 'memory-usage'
  | 'network-requests';

/**
 * Code smell types
 */
export type CodeSmellType =
  | 'long-function'
  | 'deep-nesting'
  | 'magic-number'
  | 'god-object'
  | 'feature-envy'
  | 'inappropriate-intimacy'
  | 'duplicated-code'
  | 'complex-condition'
  | 'parameter-hell'
  | 'shotgun-surgery';

/**
 * File location in the project
 */
export interface Location {
  /** File path relative to project root */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column?: number;
  /** End line for multi-line issues */
  endLine?: number;
  /** End column for multi-line issues */
  endColumn?: number;
}

/**
 * A detected bug in the codebase
 */
export interface DetectedBug {
  /** Unique identifier for this bug */
  id: string;
  /** Type of bug */
  type: BugType;
  /** Severity level */
  severity: Severity;
  /** Human-readable description */
  description: string;
  /** Location in code */
  location: Location;
  /** Whether this bug can be auto-fixed */
  fixable: boolean;
  /** Suggested fix description or code */
  suggestedFix: string;
  /** Code snippet showing the issue */
  codeSnippet?: string;
  /** Related file paths (e.g., imports) */
  relatedFiles?: string[];
}

/**
 * A detected performance issue
 */
export interface PerformanceIssue {
  /** Unique identifier */
  id: string;
  /** Category of performance issue */
  category: PerfCategory;
  /** Impact level */
  impact: Severity;
  /** Human-readable description */
  description: string;
  /** Location in code */
  location: Location;
  /** Current metrics (if available) */
  currentMetrics: Metric[];
  /** Expected improvement description */
  expectedImprovement: string;
  /** Estimated performance gain percentage */
  estimatedGain?: number;
}

/**
 * A metric value for performance analysis
 */
export interface Metric {
  /** Metric name */
  name: string;
  /** Current value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** Target/optimal value */
  target?: number;
}

/**
 * A detected code smell
 */
export interface CodeSmell {
  /** Unique identifier */
  id: string;
  /** Type of code smell */
  type: CodeSmellType;
  /** Severity level */
  severity: Severity;
  /** Human-readable description */
  description: string;
  /** Location in code */
  location: Location;
  /** Why this is a problem */
  reason: string;
  /** Suggested refactoring */
  suggestion: string;
  /** Complexity score if applicable */
  complexityScore?: number;
}

/**
 * Complete optimization report for a project
 */
export interface OptimizationReport {
  /** Project path that was analyzed */
  projectPath: string;
  /** When the analysis was performed */
  timestamp: Date;
  /** All detected bugs */
  bugs: DetectedBug[];
  /** All performance issues */
  performanceIssues: PerformanceIssue[];
  /** All code smells */
  codeSmells: CodeSmell[];
  /** Total potential impact score (0-100) */
  totalPotentialImpact: number;
  /** Estimated time to fix all issues */
  estimatedFixTime?: string;
  /** Framework detected during analysis */
  framework?: string;
  /** Files analyzed */
  filesAnalyzed: number;
  /** Total lines of code */
  linesOfCode: number;
}

/**
 * An applied optimization change
 */
export interface AppliedOptimization {
  /** Unique identifier */
  id: string;
  /** Type of optimization applied */
  type: 'bug-fix' | 'performance' | 'refactoring';
  /** Description of what was done */
  description: string;
  /** Files that were modified */
  modifiedFiles: string[];
  /** Original code snippet */
  originalCode: string;
  /** Fixed code snippet */
  fixedCode: string;
  /** Location of change */
  location: Location;
}

/**
 * A suggestion that was not automatically applied
 */
export interface Suggestion {
  /** Unique identifier */
  id: string;
  /** Type of suggestion */
  type: 'bug-fix' | 'performance' | 'refactoring';
  /** Description */
  description: string;
  /** Why it couldn't be auto-applied */
  reason: string;
  /** Manual fix instructions */
  manualFix: string;
  /** Location */
  location: Location;
}

/**
 * Result of an optimization operation
 */
export interface OptimizationResult {
  /** The analysis report */
  report: OptimizationReport;
  /** Optimizations that were successfully applied */
  appliedOptimizations: AppliedOptimization[];
  /** Suggestions that need manual intervention */
  remainingSuggestions: Suggestion[];
  /** Estimated overall improvement */
  estimatedImprovement: string;
  /** Whether any errors occurred during optimization */
  errors: OptimizationError[];
}

/**
 * An error that occurred during optimization
 */
export interface OptimizationError {
  /** What was being optimized */
  target: string;
  /** Error message */
  message: string;
  /** Whether this is fatal */
  fatal: boolean;
}

/**
 * Options for detection operations
 */
export interface DetectionOptions {
  /** Which bug types to detect (all if empty) */
  bugTypes?: BugType[];
  /** Which performance categories to analyze */
  perfCategories?: PerfCategory[];
  /** Which code smells to detect */
  codeSmellTypes?: CodeSmellType[];
  /** Maximum number of issues to return per category */
  maxIssues?: number;
  /** Minimum severity level to report */
  minSeverity?: Severity;
  /** Whether to include code snippets */
  includeSnippets?: boolean;
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
}

/**
 * Options for optimization operations
 */
export interface OptimizationOptions {
  /** Whether to apply fixes automatically */
  autoFix?: boolean;
  /** Create backup before modifying */
  createBackup?: boolean;
  /** Maximum number of fixes to apply */
  maxFixes?: number;
  /** Dry run - don't actually modify files */
  dryRun?: boolean;
  /** Only fix issues with specific severity or higher */
  minSeverity?: Severity;
  /** Whether to skip git-tracked files check */
  skipGitCheck?: boolean;
}

/**
 * Combined options for detectAndOptimize
 */
export interface DetectAndOptimizeOptions extends DetectionOptions, OptimizationOptions {
  /** Whether to run detection first */
  detectOnly?: boolean;
  /** Whether to generate report only */
  reportOnly?: boolean;
}

/**
 * Priority score for an issue
 */
export interface PriorityScore {
  /** Overall priority (0-100) */
  score: number;
  /** Severity factor */
  severityFactor: number;
  /** Impact factor */
  impactFactor: number;
  /** Effort factor (lower is easier) */
  effortFactor: number;
}

/**
 * Anti-pattern definition
 */
export interface AntiPattern {
  /** Pattern identifier */
  id: string;
  /** Pattern name */
  name: string;
  /** Category (bug/perf/smell) */
  category: 'bug' | 'performance' | 'code-smell';
  /** Description */
  description: string;
  /** Default severity */
  severity: Severity;
  /** Detection pattern (regex or AST pattern) */
  pattern: string | RegExp | PatternMatcher;
  /** Recommended fix */
  fix: string;
  /** Example of the anti-pattern */
  badExample: string;
  /** Example of the correct pattern */
  goodExample: string;
  /** Links to resources */
  resources?: string[];
}

/**
 * Pattern matcher function for AST-based detection
 */
export interface PatternMatcher {
  /** Match function */
  match: (code: string, language: string) => boolean;
  /** Extract function to get location */
  extract?: (code: string, language: string) => Location[];
}

/**
 * File analysis result
 */
export interface FileAnalysis {
  /** File path */
  filePath: string;
  /** Language detected */
  language: string;
  /** Lines of code */
  linesOfCode: number;
  /** Bugs found */
  bugs: DetectedBug[];
  /** Performance issues found */
  performanceIssues: PerformanceIssue[];
  /** Code smells found */
  codeSmells: CodeSmell[];
  /** Overall file health score (0-100) */
  healthScore: number;
}

/**
 * Statistics for the optimization service
 */
export interface OptimizationStats {
  /** Total projects analyzed */
  totalProjects: number;
  /** Total bugs found */
  totalBugsFound: number;
  /** Total bugs fixed */
  totalBugsFixed: number;
  /** Total performance issues found */
  totalPerfIssuesFound: number;
  /** Total optimizations applied */
  totalOptimizationsApplied: number;
  /** Average project health score */
  avgHealthScore: number;
  /** Most common bug types */
  commonBugTypes: Array<{ type: BugType; count: number }>;
  /** Most common performance issues */
  commonPerfIssues: Array<{ category: PerfCategory; count: number }>;
}
