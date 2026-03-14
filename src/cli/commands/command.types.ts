/**
 * Command Types
 *
 * Shared types for CLI commands.
 *
 * @module cli/commands/command.types
 */

/**
 * Dimension type for scoring and analysis
 */
export type Dimension =
  | 'test'
  | 'security'
  | 'performance'
  | 'reliability'
  | 'maintainability'
  | 'coverage';

/**
 * Output format for commands
 */
export type OutputFormat = 'text' | 'json' | 'html' | 'markdown' | 'junit';

/**
 * Base command options
 */
export interface BaseCommandOptions {
  /** Verbose output */
  verbose?: boolean;
  /** Silent mode (minimal output) */
  silent?: boolean;
  /** JSON output */
  json?: boolean;
  /** Output format */
  format?: OutputFormat;
  /** Project directory (defaults to cwd) */
  projectDir?: string;
}

/**
 * Score command options
 */
export interface ScoreOptions extends BaseCommandOptions {
  /** Specific dimension(s) to show */
  dim?: Dimension | Dimension[];
  /** Show trend/history */
  trend?: boolean;
  /** Number of historical points to show */
  historyPoints?: number;
  /** Compare with previous score */
  compare?: boolean;
}

/**
 * Review command options
 */
export interface ReviewOptions extends BaseCommandOptions {
  /** Apply auto-fixes for issues found */
  fix?: boolean;
  /** Non-interactive mode (auto-confirm) */
  auto?: boolean;
  /** Report format */
  output?: OutputFormat;
  /** Specific dimension(s) to review */
  dim?: Dimension | Dimension[];
  /** Severity threshold */
  severity?: 'low' | 'medium' | 'high' | 'critical';
  /** Output file path */
  outputFile?: string;
}

/**
 * Optimize command options
 */
export interface OptimizeOptions extends BaseCommandOptions {
  /** Performance optimizations only */
  perf?: boolean;
  /** Bug fixes only */
  bugs?: boolean;
  /** Security fixes only */
  security?: boolean;
  /** Apply optimizations (dry-run if false) */
  apply?: boolean;
  /** Show what would be done without applying */
  dryRun?: boolean;
  /** Maximum number of optimizations to apply */
  maxChanges?: number;
}

/**
 * Command execution result
 */
export interface CommandResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Result message */
  message?: string;
  /** Additional data */
  data?: unknown;
  /** Error if any */
  error?: Error;
}

/**
 * Progress callback for long-running operations
 */
export interface ProgressCallbacks {
  /** Called when operation starts */
  onStart?: (message: string) => void;
  /** Called with progress update (0-100) */
  onProgress?: (percent: number, message?: string) => void;
  /** Called when operation completes */
  onComplete?: (message: string) => void;
  /** Called when operation fails */
  onError?: (error: Error) => void;
}

/**
 * Score breakdown by dimension
 */
export interface ScoreBreakdown {
  /** Dimension name */
  dimension: Dimension;
  /** Score (0-100) */
  score: number;
  /** Weight in overall score */
  weight: number;
  /** Status */
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  /** Issues found */
  issues: number;
  /** Recommendations */
  recommendations: number;
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Overall score */
  score: number;
  /** Breakdown by dimension */
  breakdown: Record<string, number>;
}

/**
 * Dimension parser helper
 */
export class DimensionParser {
  private static readonly ALL_DIMENSIONS: Dimension[] = [
    'test',
    'security',
    'performance',
    'reliability',
    'maintainability',
    'coverage',
  ] as const;

  // Explicit string array for 'all' validation
  private static readonly VALID_DIMENSIONS = [
    'test',
    'security',
    'performance',
    'reliability',
    'maintainability',
    'coverage',
    'all',
  ] as const;

  /**
   * Parse dimension argument(s) into array
   */
  static parse(dimInput?: string | string[]): Dimension[] {
    if (!dimInput) {
      return [...this.ALL_DIMENSIONS];
    }

    if (typeof dimInput === 'string') {
      if (dimInput === 'all') {
        return [...this.ALL_DIMENSIONS];
      }
      return dimInput.split(',').map((d) => this.validate(d.trim()));
    }

    return dimInput.map((d) => (typeof d === 'string' ? this.validate(d) : d));
  }

  /**
   * Validate a dimension string
   */
  static validate(dim: string): Dimension {
    if (this.VALID_DIMENSIONS.includes(dim as any)) {
      if (dim === 'all') {
        throw new Error(`Use 'all' as a standalone value, not as a dimension`);
      }
      return dim as Dimension;
    }
    throw new Error(`Invalid dimension: ${dim}. Valid: ${this.VALID_DIMENSIONS.filter(d => d !== 'all').join(', ')}`);
  }

  /**
   * Get all available dimensions
   */
  static getAll(): Dimension[] {
    return [...this.ALL_DIMENSIONS];
  }
}

/**
 * Report command options
 */
export interface ReportOptions extends BaseCommandOptions {
  /** Report format */
  format?: 'html' | 'markdown' | 'json' | 'junit' | 'text';
  /** Output file path */
  output?: string;
  /** Include trend data */
  includeTrend?: boolean;
  /** Include charts in HTML */
  includeCharts?: boolean;
  /** Theme for HTML report */
  theme?: 'light' | 'dark' | 'auto';
  /** Open report after generation */
  open?: boolean;
}

/**
 * History command options
 */
export interface HistoryOptions extends BaseCommandOptions {
  /** Maximum number of entries to show */
  limit?: number;
  /** Clear all history */
  clear?: boolean;
  /** Prune old entries */
  prune?: boolean;
  /** Compare with previous entry */
  compare?: boolean;
  /** Focus on specific dimension */
  dimension?: string;
}

/**
 * Init command options
 */
export interface InitOptions extends BaseCommandOptions {
  /** Force overwrite existing files */
  force?: boolean;
  /** Skip Dockerfile creation */
  skipDocker?: boolean;
  /** Custom test directory */
  testDir?: string;
}

/**
 * Detect command options
 */
export interface DetectOptions extends BaseCommandOptions {
  /** Show detailed output */
  detailed?: boolean;
  /** JSON output */
  json?: boolean;
}

/**
 * Test command options
 */
export interface TestOptions extends BaseCommandOptions {
  /** Run with coverage */
  coverage?: boolean;
  /** Watch mode */
  watch?: boolean;
  /** Specific test file/pattern */
  pattern?: string;
  /** Test runner to use */
  runner?: 'vitest' | 'jest' | 'mocha' | 'pytest';
}
