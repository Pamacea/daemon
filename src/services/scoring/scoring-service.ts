/**
 * Scoring Service
 *
 * Main service for evaluating project quality across multiple dimensions.
 * Coordinates various analyzers to produce comprehensive project scores.
 *
 * @module services/scoring/scoring-service
 */

import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type {
  ProjectScore,
  DimensionScore,
  CodeDimension,
  ScoringOptions,
  Issue,
  Improvement,
  ScoreTrend,
  Recommendation,
  HistoricalScore,
  ScoreComparison,
  ScoreSummary,
  ScoreGrade,
  TrendDirection,
  IssueSeverity,
  IssueCategory,
  Priority,
  Effort,
  DimensionAnalyzerConfig,
  ScoringError,
} from '../../core/types/scoring.types.js';
import type { Framework } from '../../core/types/project.types.js';
import { FrameworkDetector } from '../detection/framework-detector.js';
import { CommandExecutor } from '../../shared/utils/command-executor.js';
import { createLogger, type Logger } from '../../shared/utils/logger.js';

/**
 * Default weights for each dimension (if not specified in options)
 */
const DEFAULT_DIMENSION_WEIGHTS: Record<CodeDimension, number> = {
  'test-coverage': 0.18,
  'code-quality': 0.14,
  'performance': 0.14,
  'security': 0.14,
  'accessibility': 0.09,
  'ui-ux': 0.09,
  'backend-logic': 0.09,
  'business-logic': 0.04,
  'seo': 0.09,
};

/**
 * Grade thresholds for converting numeric scores to letter grades
 */
const GRADE_THRESHOLDS: Record<ScoreGrade, { min: number; max: number }> = {
  A: { min: 90, max: 100 },
  B: { min: 75, max: 89 },
  C: { min: 60, max: 74 },
  D: { min: 40, max: 59 },
  F: { min: 0, max: 39 },
};

/**
 * Score history directory name
 */
const SCORE_HISTORY_DIR = '.daemon';
const SCORE_HISTORY_FILE = 'score-history.json';

/**
 * Daemon version (will be updated by build process)
 */
const DAEMON_VERSION = '0.7.0';

/**
 * Scoring Service Options interface
 *
 * Extended options for the ScoringService class.
 */
export interface ScoringServiceOptions {
  /** Custom storage directory for score history */
  historyDir?: string;
  /** Enable caching of detection results */
  enableCache?: boolean;
  /** Custom command executor instance */
  executor?: CommandExecutor;
  /** Custom logger instance */
  logger?: Logger;
  /** Framework detector instance */
  frameworkDetector?: FrameworkDetector;
}

/**
 * Dimension analyzer interface
 *
 * Implementations of this interface are responsible for analyzing
 * a specific code dimension.
 */
export interface DimensionAnalyzer {
  /** Configuration for this analyzer */
  readonly config: DimensionAnalyzerConfig;

  /**
   * Analyze the project for this dimension
   *
   * @param projectPath - Path to the project root
   * @param framework - Detected framework
   * @param options - Scoring options
   * @returns Dimension score with issues and improvements
   */
  analyze(
    projectPath: string,
    framework: Framework,
    options: ScoringOptions
  ): Promise<DimensionScore>;
}

/**
 * Main scoring service
 *
 * Orchestrates the scoring process across all dimensions,
 * manages historical data, and provides trend analysis.
 */
export class ScoringService {
  private readonly executor: CommandExecutor;
  private readonly logger: Logger;
  private readonly frameworkDetector: FrameworkDetector;
  private readonly historyDir: string;
  private readonly analyzers: Map<CodeDimension, DimensionAnalyzer> = new Map();

  constructor(options: ScoringServiceOptions = {}) {
    this.executor = options.executor ?? new CommandExecutor();
    this.logger = options.logger ?? createLogger('ScoringService');
    this.frameworkDetector = options.frameworkDetector ?? new FrameworkDetector();
    this.historyDir = options.historyDir ?? SCORE_HISTORY_DIR;
  }

  /**
   * Register a dimension analyzer
   *
   * @param analyzer - The analyzer to register
   */
  registerAnalyzer(analyzer: DimensionAnalyzer): void {
    this.analyzers.set(analyzer.config.dimension, analyzer);
    this.logger.debug(`Registered analyzer for dimension: ${analyzer.config.dimension}`);
  }

  /**
   * Unregister a dimension analyzer
   *
   * @param dimension - The dimension to unregister
   */
  unregisterAnalyzer(dimension: CodeDimension): void {
    this.analyzers.delete(dimension);
    this.logger.debug(`Unregistered analyzer for dimension: ${dimension}`);
  }

  /**
   * Get all registered analyzers
   *
   * @returns Map of registered analyzers
   */
  getAnalyzers(): Map<CodeDimension, DimensionAnalyzer> {
    return new Map(this.analyzers);
  }

  /**
   * Get a specific analyzer by dimension
   *
   * @param dimension - The dimension to get the analyzer for
   * @returns The analyzer or undefined if not registered
   */
  getAnalyzer(dimension: CodeDimension): DimensionAnalyzer | undefined {
    return this.analyzers.get(dimension);
  }

  /**
   * Score a project across all dimensions
   *
   * @param projectPath - Path to the project root
   * @param options - Scoring options
   * @returns Complete project score
   */
  async scoreProject(projectPath: string, options: ScoringOptions = {}): Promise<ProjectScore> {
    const startTime = performance.now();

    this.logger.info(`Starting project scoring for: ${projectPath}`);

    // Detect framework first
    const detectionResult = await this.frameworkDetector.detect(projectPath);
    const framework = detectionResult.value ?? 'Unknown';

    this.logger.debug(`Detected framework: ${framework} (confidence: ${detectionResult.confidence})`);

    // Determine which dimensions to score
    const dimensionsToScore = options.dimensions ?? (Object.keys(DEFAULT_DIMENSION_WEIGHTS) as CodeDimension[]);

    // Filter out dimensions without analyzers
    const validDimensions = dimensionsToScore.filter((d) => this.analyzers.has(d));

    if (validDimensions.length === 0) {
      this.logger.warn('No analyzers registered for requested dimensions');
      return this.createEmptyScore(projectPath, framework);
    }

    // Combine default and custom weights
    const weights = { ...DEFAULT_DIMENSION_WEIGHTS, ...options.weights };

    // Score each dimension
    const dimensionScores: DimensionScore[] = [];
    const allIssues: Issue[] = [];
    const allImprovements: Improvement[] = [];

    for (const dimension of validDimensions) {
      try {
        this.logger.debug(`Scoring dimension: ${dimension}`);

        const analyzer = this.analyzers.get(dimension);
        if (!analyzer) continue;

        // Skip if not supported for this framework
        if (
          analyzer.config.supportedFrameworks &&
          analyzer.config.supportedFrameworks.length > 0 &&
          !analyzer.config.supportedFrameworks.includes(framework)
        ) {
          this.logger.debug(`Skipping ${dimension}: not supported for ${framework}`);
          continue;
        }

        const dimensionScore = await analyzer.analyze(projectPath, framework, options);

        // Apply weight
        const weight = weights[dimension] ?? DEFAULT_DIMENSION_WEIGHTS[dimension];
        dimensionScore.weight = weight;
        dimensionScore.weightedScore = dimensionScore.score * weight;

        dimensionScores.push(dimensionScore);
        allIssues.push(...dimensionScore.issues);
        allImprovements.push(...dimensionScore.improvements);

        this.logger.debug(`Dimension ${dimension} scored: ${dimensionScore.score}/100`);
      } catch (error) {
        this.logger.error(`Failed to score dimension ${dimension}:`, error);

        // Add a failed dimension entry
        dimensionScores.push({
          dimension,
          score: 0,
          weight: weights[dimension] ?? DEFAULT_DIMENSION_WEIGHTS[dimension],
          weightedScore: 0,
          issues: [],
          improvements: [],
          metadata: { error: String(error) },
        });
      }
    }

    // Calculate overall score
    const totalWeight = dimensionScores.reduce((sum, ds) => sum + ds.weight, 0);
    const overall = totalWeight > 0
      ? Math.round(dimensionScores.reduce((sum, ds) => sum + (ds.weightedScore ?? 0), 0) / totalWeight)
      : 0;

    // Get trend if requested
    let trend: ScoreTrend | undefined;
    if (options.includeTrend) {
      trend = await this.calculateTrend(projectPath, overall, options.trendHistorySize);
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(dimensionScores, allIssues, options.maxRecommendations);

    // Get grade
    const grade = this.getGrade(overall);

    const duration = Math.round(performance.now() - startTime);

    const projectScore: ProjectScore = {
      overall,
      grade,
      dimensions: dimensionScores,
      trend,
      recommendations,
      projectPath,
      framework,
      timestamp: new Date(),
      duration,
      daemonVersion: DAEMON_VERSION,
    };

    // Save for history if requested
    if (options.saveForHistory !== false) {
      await this.saveScore(projectPath, projectScore);
    }

    this.logger.info(`Project scoring complete: ${overall}/100 (${grade}) in ${duration}ms`);

    return projectScore;
  }

  /**
   * Score a single dimension
   *
   * @param projectPath - Path to the project root
   * @param dimension - The dimension to score
   * @param options - Scoring options
   * @returns Dimension score
   */
  async scoreDimension(
    projectPath: string,
    dimension: CodeDimension,
    options: ScoringOptions = {}
  ): Promise<DimensionScore> {
    this.logger.debug(`Scoring single dimension: ${dimension}`);

    const analyzer = this.analyzers.get(dimension);
    if (!analyzer) {
      throw new Error(`No analyzer registered for dimension: ${dimension}`);
    }

    // Detect framework
    const detectionResult = await this.frameworkDetector.detect(projectPath);
    const framework = detectionResult.value ?? 'Unknown';

    const dimensionScore = await analyzer.analyze(projectPath, framework, options);

    // Apply weight
    const weights = { ...DEFAULT_DIMENSION_WEIGHTS, ...options.weights };
    const weight = weights[dimension] ?? DEFAULT_DIMENSION_WEIGHTS[dimension];
    dimensionScore.weight = weight;
    dimensionScore.weightedScore = dimensionScore.score * weight;

    return dimensionScore;
  }

  /**
   * Get historical scores for a project
   *
   * @param projectPath - Path to the project root
   * @param limit - Maximum number of entries to return
   * @returns Array of historical scores
   */
  async getHistoricalScores(projectPath: string, limit: number = 10): Promise<HistoricalScore[]> {
    const historyFile = this.getHistoryFilePath(projectPath);

    try {
      if (!existsSync(historyFile)) {
        return [];
      }

      const content = await readFile(historyFile, 'utf-8');
      const history: HistoricalScore[] = JSON.parse(content);

      // Sort by timestamp descending and limit
      return history
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      this.logger.warn('Failed to read score history:', error);
      return [];
    }
  }

  /**
   * Save a score for historical tracking
   *
   * @param projectPath - Path to the project root
   * @param score - The score to save
   * @returns The historical score entry
   */
  async saveScore(projectPath: string, score: ProjectScore): Promise<HistoricalScore> {
    const historyFile = this.getHistoryFilePath(projectPath);

    // Ensure directory exists
    const historyDir = join(projectPath, this.historyDir);
    if (!existsSync(historyDir)) {
      await mkdir(historyDir, { recursive: true });
    }

    // Get existing history
    let history: HistoricalScore[] = [];
    if (existsSync(historyFile)) {
      try {
        const content = await readFile(historyFile, 'utf-8');
        history = JSON.parse(content);
      } catch {
        // File exists but is invalid, start fresh
      }
    }

    // Get current git info if available
    let commitHash: string | undefined;
    let branch: string | undefined;

    try {
      const hashResult = await this.executor.execute('git rev-parse HEAD', {
        timeout: 5000,
        silent: true,
      });
      if (hashResult.success && hashResult.data) {
        commitHash = hashResult.data.stdout.trim();
      }

      const branchResult = await this.executor.execute('git rev-parse --abbrev-ref HEAD', {
        timeout: 5000,
        silent: true,
      });
      if (branchResult.success && branchResult.data) {
        branch = branchResult.data.stdout.trim();
      }
    } catch {
      // Not a git repo or git not available
    }

    // Create historical entry
    const entry: HistoricalScore = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      projectPath,
      overallScore: score.overall,
      dimensions: score.dimensions,
      timestamp: score.timestamp,
      commitHash,
      branch,
      daemonVersion: score.daemonVersion,
    };

    // Add to history and save
    history.push(entry);

    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }

    await writeFile(historyFile, JSON.stringify(history, null, 2), 'utf-8');

    this.logger.debug(`Saved score to history: ${entry.id}`);

    return entry;
  }

  /**
   * Compare two scores to identify changes
   *
   * @param before - Score before changes
   * @param after - Score after changes
   * @returns Detailed comparison
   */
  compareScores(before: ProjectScore, after: ProjectScore): ScoreComparison {
    const overallChange = after.overall - before.overall;

    const dimensionChanges = new Map<CodeDimension, number>();

    // Build lookup map for before dimensions
    const beforeDimensions = new Map(before.dimensions.map((d) => [d.dimension, d]));

    // Calculate changes for each dimension
    for (const afterDim of after.dimensions) {
      const beforeDim = beforeDimensions.get(afterDim.dimension);
      const beforeScore = beforeDim?.score ?? 0;
      dimensionChanges.set(afterDim.dimension, afterDim.score - beforeScore);
    }

    // Find new and resolved issues
    const beforeIssues = new Set(before.dimensions.flatMap((d) => d.issues.map(this.issueKey)));
    const afterIssues = new Set(after.dimensions.flatMap((d) => d.issues.map(this.issueKey)));

    const newIssues = after.dimensions
      .flatMap((d) => d.issues)
      .filter((issue) => !beforeIssues.has(this.issueKey(issue)));

    const resolvedIssues = before.dimensions
      .flatMap((d) => d.issues)
      .filter((issue) => !afterIssues.has(this.issueKey(issue)));

    const issueCountDelta = after.dimensions.reduce((sum, d) => sum + d.issues.length, 0) -
      before.dimensions.reduce((sum, d) => sum + d.issues.length, 0);

    return {
      before,
      after,
      overallChange,
      dimensionChanges,
      newIssues,
      resolvedIssues,
      issueCountDelta,
    };
  }

  /**
   * Generate a summary of the score
   *
   * @param score - The project score
   * @returns Concise summary
   */
  generateSummary(score: ProjectScore): ScoreSummary {
    const issuesBySeverity: Record<IssueSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    // Count issues by severity
    for (const dimension of score.dimensions) {
      for (const issue of dimension.issues) {
        issuesBySeverity[issue.severity]++;
      }
    }

    // Find weak and strong dimensions
    const sortedDimensions = [...score.dimensions].sort((a, b) => a.score - b.score);
    const weakDimensions = sortedDimensions.slice(0, 3).map((d) => d.dimension);
    const strongDimensions = sortedDimensions.slice(-3).reverse().map((d) => d.dimension);

    // Count priority recommendations
    const priorityRecommendations = score.recommendations.filter((r) =>
      r.priority === 'p0' || r.priority === 'p1'
    ).length;

    return {
      overall: score.overall,
      grade: score.grade,
      issuesBySeverity,
      weakDimensions,
      strongDimensions,
      priorityRecommendations,
    };
  }

  /**
   * Calculate trend information
   *
   * @param projectPath - Path to the project
   * @param currentScore - Current overall score
   * @param historySize - Number of historical entries to consider
   * @returns Trend information
   */
  private async calculateTrend(
    projectPath: string,
    currentScore: number,
    historySize: number = 5
  ): Promise<ScoreTrend | undefined> {
    const history = await this.getHistoricalScores(projectPath, historySize);

    if (history.length === 0) {
      return undefined;
    }

    // Get most recent score
    const previous = history[0];
    const previousScore = previous.overallScore;

    const delta = currentScore - previousScore;
    let direction: TrendDirection = 'stable';

    if (delta > 2) {
      direction = 'up';
    } else if (delta < -2) {
      direction = 'down';
    }

    return {
      current: currentScore,
      previous: previousScore,
      delta,
      direction,
      timestamp: new Date(),
      previousTimestamp: new Date(previous.timestamp),
    };
  }

  /**
   * Generate prioritized recommendations from issues and improvements
   *
   * @param dimensionScores - All dimension scores
   * @param allIssues - All issues found
   * @param maxRecommendations - Maximum number of recommendations
   * @returns Prioritized recommendations
   */
  private generateRecommendations(
    dimensionScores: DimensionScore[],
    allIssues: Issue[],
    maxRecommendations: number = 10
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Group issues by category
    const issuesByCategory = new Map<IssueCategory, Issue[]>();
    for (const issue of allIssues) {
      const existing = issuesByCategory.get(issue.category) ?? [];
      existing.push(issue);
      issuesByCategory.set(issue.category, existing);
    }

    // Create recommendations for each category with issues
    for (const [category, issues] of issuesByCategory.entries()) {
      if (issues.length === 0) continue;

      // Calculate priority based on severity
      const criticalCount = issues.filter((i) => i.severity === 'critical').length;
      const highCount = issues.filter((i) => i.severity === 'high').length;

      let priority: Priority;
      if (criticalCount > 0) {
        priority = 'p0';
      } else if (highCount > 0) {
        priority = 'p1';
      } else if (issues.length > 5) {
        priority = 'p2';
      } else {
        priority = 'p3';
      }

      // Find related dimension
      const relatedDimension = dimensionScores.find((ds) =>
        ds.issues.some((issue) => issue.category === category)
      )?.dimension;

      // Estimate effort
      const effort: Effort = criticalCount > 2 || highCount > 5 ? 'major' :
        criticalCount > 0 || highCount > 2 ? 'significant' :
        issues.length > 3 ? 'moderate' : 'quick';

      // Generate action items from fixable issues
      const actions = issues
        .filter((i) => i.fixable)
        .slice(0, 5)
        .map((i) => i.suggestion ?? `Fix: ${i.description}`);

      recommendations.push({
        priority,
        category,
        title: this.generateCategoryTitle(category),
        description: `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} found in ${category}.`,
        effort,
        dimension: relatedDimension,
        issueCount: issues.length,
        actions,
      });
    }

    // Sort by priority and count
    const priorityOrder: Record<Priority, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };
    recommendations.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.issueCount - a.issueCount;
    });

    return recommendations.slice(0, maxRecommendations);
  }

  /**
   * Get letter grade from numeric score
   *
   * @param score - Numeric score (0-100)
   * @returns Letter grade
   */
  private getGrade(score: number): ScoreGrade {
    if (score >= GRADE_THRESHOLDS.A.min) return 'A';
    if (score >= GRADE_THRESHOLDS.B.min) return 'B';
    if (score >= GRADE_THRESHOLDS.C.min) return 'C';
    if (score >= GRADE_THRESHOLDS.D.min) return 'D';
    return 'F';
  }

  /**
   * Get the file path for storing score history
   *
   * @param projectPath - Path to the project
   * @returns Full path to history file
   */
  private getHistoryFilePath(projectPath: string): string {
    return join(projectPath, this.historyDir, SCORE_HISTORY_FILE);
  }

  /**
   * Generate a unique key for an issue (for comparison)
   *
   * @param issue - The issue
   * @returns Unique key
   */
  private issueKey(issue: Issue): string {
    return `${issue.category}:${issue.description}:${issue.location ?? ''}`;
  }

  /**
   * Generate a human-readable title for a category
   *
   * @param category - The issue category
   * @returns Title
   */
  private generateCategoryTitle(category: IssueCategory): string {
    const titles: Record<IssueCategory, string> = {
      testing: 'Improve Test Coverage',
      'code-style': 'Code Style Issues',
      performance: 'Performance Optimizations',
      security: 'Security Vulnerabilities',
      a11y: 'Accessibility Improvements',
      ux: 'User Experience Enhancements',
      architecture: 'Architecture Concerns',
      documentation: 'Documentation Needs',
      'error-handling': 'Error Handling Improvements',
      'type-safety': 'Type Safety Improvements',
      'seo': 'SEO Optimizations',
    };
    return titles[category] ?? category;
  }

  /**
   * Create an empty score result when no analyzers are available
   *
   * @param projectPath - Project path
   * @param framework - Detected framework
   * @returns Empty project score
   */
  private createEmptyScore(projectPath: string, framework: string): ProjectScore {
    return {
      overall: 0,
      grade: 'F',
      dimensions: [],
      recommendations: [],
      projectPath,
      framework,
      timestamp: new Date(),
      duration: 0,
      daemonVersion: DAEMON_VERSION,
    };
  }

  /**
   * Clear score history for a project
   *
   * @param projectPath - Path to the project root
   */
  async clearHistory(projectPath: string): Promise<void> {
    const historyFile = this.getHistoryFilePath(projectPath);

    if (existsSync(historyFile)) {
      await writeFile(historyFile, '[]', 'utf-8');
      this.logger.debug(`Cleared score history for: ${projectPath}`);
    }
  }
}

/**
 * Default scoring service instance
 */
let defaultService: ScoringService | null = null;

/**
 * Get or create the default scoring service
 *
 * @param options - Optional configuration
 * @returns Scoring service instance
 */
export function getScoringService(options?: ScoringServiceOptions): ScoringService {
  if (!defaultService) {
    defaultService = new ScoringService(options);
  }
  return defaultService;
}

/**
 * Quick score function using default service
 *
 * @param projectPath - Path to the project root
 * @param options - Scoring options
 * @returns Project score
 */
export async function scoreProject(
  projectPath: string,
  options?: ScoringOptions
): Promise<ProjectScore> {
  const service = getScoringService();
  return service.scoreProject(projectPath, options);
}

/**
 * Get or create a scoring service with all default analyzers registered
 *
 * This function creates a new ScoringService instance and registers
 * all built-in dimension analyzers automatically.
 *
 * @param options - Optional configuration
 * @returns Scoring service instance with all analyzers registered
 */
export async function getScoringServiceWithDefaults(
  options?: ScoringServiceOptions
): Promise<ScoringService> {
  const service = new ScoringService(options);

  // Import all dimension analyzers
  const {
    testCoverageAnalyzer,
    codeQualityAnalyzer,
    performanceAnalyzer,
    securityAnalyzer,
    accessibilityAnalyzer,
    uiUxAnalyzer,
    backendLogicAnalyzer,
    businessLogicAnalyzer,
    seoAnalyzer,
  } = await import('./dimensions/index.js');

  // Register all analyzers
  service.registerAnalyzer(testCoverageAnalyzer);
  service.registerAnalyzer(codeQualityAnalyzer);
  service.registerAnalyzer(performanceAnalyzer);
  service.registerAnalyzer(securityAnalyzer);
  service.registerAnalyzer(accessibilityAnalyzer);
  service.registerAnalyzer(uiUxAnalyzer);
  service.registerAnalyzer(backendLogicAnalyzer);
  service.registerAnalyzer(businessLogicAnalyzer);
  service.registerAnalyzer(seoAnalyzer);

  return service;
}
