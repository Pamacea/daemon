/**
 * Test Coverage Analyzer
 *
 * Analyzes test coverage for a project by parsing Vitest/Jest coverage reports.
 * Evaluates lines, branches, functions, and statements coverage.
 *
 * @module services/scoring/dimensions/test-coverage
 */

import { readFile, readdir, stat, access } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';

import type {
  DimensionScore,
  Issue,
  Improvement,
  CodeDimension,
  IssueSeverity,
  IssueCategory,
  ImprovementType,
  Effort,
  Impact,
  DimensionAnalyzerConfig,
} from '../../../core/types/scoring.types.js';
import type { Framework } from '../../../core/types/project.types.js';
import type { ScoringOptions } from '../../../core/types/scoring.types.js';
import { CommandExecutor } from '../../../shared/utils/command-executor.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Coverage report structure (Vitest/Istanbul compatible)
 */
interface CoverageReport {
  total: {
    lines: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
  };
}

/**
 * File coverage entry
 */
interface FileCoverage {
  filepath: string;
  lines: { pct: number };
  branches: { pct: number };
  functions: { pct: number };
  statements: { pct: number };
}

/**
 * Test coverage analyzer configuration
 */
export interface TestCoverageAnalyzerOptions {
  /** Target coverage percentage (default: 80) */
  targetCoverage?: number;
  /** Minimum acceptable coverage (default: 50) */
  minCoverage?: number;
  /** Coverage file paths to check */
  coveragePaths?: string[];
  /** Custom test runner command */
  testCommand?: string;
}

/**
 * Test Coverage Analyzer
 *
 * Evaluates test coverage across multiple metrics:
 * - Line coverage
 * - Branch coverage
 * - Function coverage
 * - Statement coverage
 */
export class TestCoverageAnalyzer {
  /** Analyzer configuration */
  readonly config: DimensionAnalyzerConfig = {
    dimension: 'test-coverage' as CodeDimension,
    defaultWeight: 0.15,
    estimatedDuration: 30000,
    supportedFrameworks: ['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'NestJS', 'Angular', 'Remix', 'SvelteKit', 'Astro', 'Gatsby'],
  };

  private readonly logger: Logger;
  private readonly executor: CommandExecutor;
  private readonly targetCoverage: number;
  private readonly minCoverage: number;
  private readonly coveragePaths: string[];
  private readonly testCommand: string;

  constructor(options: TestCoverageAnalyzerOptions = {}) {
    this.logger = createLogger('TestCoverageAnalyzer');
    this.executor = new CommandExecutor();
    this.targetCoverage = options.targetCoverage ?? 80;
    this.minCoverage = options.minCoverage ?? 50;
    this.coveragePaths = options.coveragePaths ?? this.getDefaultCoveragePaths();
    this.testCommand = options.testCommand ?? 'npm test -- --coverage';
  }

  /**
   * Get default coverage file paths
   */
  private getDefaultCoveragePaths(): string[] {
    return [
      'coverage/coverage-summary.json',
      'coverage/coverage-final.json',
      'coverage/lcov.info',
      '.nyc_output/out.json',
    ];
  }

  /**
   * Get the dimension this analyzer handles
   */
  getDimension(): CodeDimension {
    return 'test-coverage';
  }

  /**
   * Get the default weight for this dimension
   */
  getWeight(): number {
    return 0.15; // 15% weight in overall score
  }

  /**
   * Analyze test coverage for a project
   *
   * @param projectPath - Path to the project root
   * @returns Dimension score with coverage metrics
   */
  async analyze(projectPath: string): Promise<DimensionScore> {
    const startTime = performance.now();

    this.logger.info(`Analyzing test coverage for: ${projectPath}`);

    const issues: Issue[] = [];
    const improvements: Improvement[] = [];

    try {
      // Try to read existing coverage report
      const coverageReport = await this.readCoverageReport(projectPath);

      if (!coverageReport) {
        // No coverage report found - try to generate one
        this.logger.info('No coverage report found, attempting to generate...');

        const generated = await this.generateCoverageReport(projectPath);
        if (!generated) {
          return this.createNoCoverageResult(issues, improvements);
        }
      }

      // Read coverage data
      const coverage = await this.readCoverageReport(projectPath);
      if (!coverage) {
        return this.createNoCoverageResult(issues, improvements);
      }

      // Calculate scores
      const metrics = this.extractCoverageMetrics(coverage);

      // Find uncovered files
      const uncoveredFiles = await this.findUncoveredFiles(projectPath, coverage);

      // Build issues list
      issues.push(...this.identifyCoverageIssues(metrics, uncoveredFiles));

      // Build improvements list
      improvements.push(...this.generateCoverageImprovements(metrics, uncoveredFiles));

      // Calculate final score
      const score = this.calculateCoverageScore(metrics);

      const duration = Math.round(performance.now() - startTime);

      return {
        dimension: this.getDimension(),
        score,
        weight: this.getWeight(),
        weightedScore: score * this.getWeight(),
        issues,
        improvements,
        metadata: {
          itemsChecked: metrics.totalFiles,
          itemsPassed: metrics.fullyCoveredFiles,
          metrics: {
            lineCoverage: metrics.lines.pct,
            branchCoverage: metrics.branches.pct,
            functionCoverage: metrics.functions.pct,
            statementCoverage: metrics.statements.pct,
            totalFiles: metrics.totalFiles,
            uncoveredFiles: uncoveredFiles.length,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error analyzing test coverage', error);

      issues.push({
        severity: 'high' as IssueSeverity,
        category: 'testing' as IssueCategory,
        description: `Failed to analyze test coverage: ${error instanceof Error ? error.message : String(error)}`,
        fixable: false,
      });

      const duration = Math.round(performance.now() - startTime);

      return {
        dimension: this.getDimension(),
        score: 0,
        weight: this.getWeight(),
        weightedScore: 0,
        issues,
        improvements,
        metadata: { error: String(error) },
      };
    }
  }

  /**
   * Read coverage report from standard locations
   */
  private async readCoverageReport(projectPath: string): Promise<CoverageReport | null> {
    for (const relativePath of this.coveragePaths) {
      const fullPath = join(projectPath, relativePath);

      try {
        await access(fullPath);
        const content = await readFile(fullPath, 'utf-8');

        if (relativePath.endsWith('.json')) {
          return JSON.parse(content) as CoverageReport;
        }

        // Parse lcov.info if needed (simplified)
        if (relativePath.endsWith('lcov.info')) {
          return this.parseLcovInfo(content);
        }
      } catch {
        // File doesn't exist or can't be read
        continue;
      }
    }

    return null;
  }

  /**
   * Parse lcov.info format to coverage summary
   */
  private parseLcovInfo(content: string): CoverageReport | null {
    // Simplified parsing - in production would use a proper lcov parser
    const lines = content.split('\n');

    let totalLines = 0;
    let coveredLines = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;

    for (const line of lines) {
      if (line.startsWith('LF:')) {
        totalLines += parseInt(line.substring(3), 10);
      } else if (line.startsWith('LH:')) {
        coveredLines += parseInt(line.substring(3), 10);
      } else if (line.startsWith('BRF:')) {
        totalBranches += parseInt(line.substring(4), 10);
      } else if (line.startsWith('BRH:')) {
        coveredBranches += parseInt(line.substring(4), 10);
      } else if (line.startsWith('FNF:')) {
        totalFunctions += parseInt(line.substring(4), 10);
      } else if (line.startsWith('FNH:')) {
        coveredFunctions += parseInt(line.substring(4), 10);
      }
    }

    return {
      total: {
        lines: {
          total: totalLines,
          covered: coveredLines,
          pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        },
        branches: {
          total: totalBranches,
          covered: coveredBranches,
          pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
        },
        functions: {
          total: totalFunctions,
          covered: coveredFunctions,
          pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
        },
        statements: {
          total: totalLines,
          covered: coveredLines,
          pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        },
      },
    };
  }

  /**
   * Generate coverage report by running tests
   */
  private async generateCoverageReport(projectPath: string): Promise<boolean> {
    try {
      const result = await this.executor.execute(this.testCommand, {
        cwd: projectPath,
        timeout: 120000, // 2 minutes
        silent: true,
      });

      return result.success;
    } catch (error) {
      this.logger.warn('Failed to generate coverage report', error);
      return false;
    }
  }

  /**
   * Extract coverage metrics from report
   */
  private extractCoverageMetrics(report: CoverageReport): {
    lines: { pct: number };
    branches: { pct: number };
    functions: { pct: number };
    statements: { pct: number };
    totalFiles: number;
    fullyCoveredFiles: number;
  } {
    return {
      lines: report.total.lines,
      branches: report.total.branches,
      functions: report.total.functions,
      statements: report.total.statements,
      totalFiles: 0, // Would need detailed report
      fullyCoveredFiles: 0,
    };
  }

  /**
   * Find files with low or no coverage
   */
  private async findUncoveredFiles(
    projectPath: string,
    coverage: CoverageReport
  ): Promise<Array<{ filepath: string; coverage: number }>> {
    const uncovered: Array<{ filepath: string; coverage: number }> = [];

    // Scan source directory for uncovered files
    const srcDir = join(projectPath, 'src');

    if (!existsSync(srcDir)) {
      return uncovered;
    }

    try {
      await this.scanDirectoryForCoverage(srcDir, projectPath, uncovered);
    } catch (error) {
      this.logger.warn('Error scanning for uncovered files', error);
    }

    return uncovered;
  }

  /**
   * Recursively scan directory for source files
   */
  private async scanDirectoryForCoverage(
    dir: string,
    projectPath: string,
    uncovered: Array<{ filepath: string; coverage: number }>
  ): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories
          if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }

          await this.scanDirectoryForCoverage(fullPath, projectPath, uncovered);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            // Check if file has tests (simplified check)
            const relativePath = fullPath.substring(projectPath.length + 1);
            const testPath = fullPath.replace(ext, `.test${ext}`);

            try {
              await access(testPath);
            } catch {
              // No test file found
              uncovered.push({
                filepath: relativePath,
                coverage: 0,
              });
            }
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Identify coverage issues
   */
  private identifyCoverageIssues(
    metrics: {
      lines: { pct: number };
      branches: { pct: number };
      functions: { pct: number };
      statements: { pct: number };
    },
    uncoveredFiles: Array<{ filepath: string; coverage: number }>
  ): Issue[] {
    const issues: Issue[] = [];

    // Check overall coverage
    const avgCoverage =
      (metrics.lines.pct + metrics.branches.pct + metrics.functions.pct + metrics.statements.pct) / 4;

    if (avgCoverage < this.minCoverage) {
      issues.push({
        severity: 'critical' as IssueSeverity,
        category: 'testing' as IssueCategory,
        description: `Overall test coverage (${avgCoverage.toFixed(1)}%) is below minimum threshold (${this.minCoverage}%)`,
        fixable: false,
        suggestion: `Add tests to increase coverage to at least ${this.targetCoverage}%`,
      });
    } else if (avgCoverage < this.targetCoverage) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'testing' as IssueCategory,
        description: `Overall test coverage (${avgCoverage.toFixed(1)}%) is below target (${this.targetCoverage}%)`,
        fixable: false,
        suggestion: `Add tests to reach ${this.targetCoverage}% coverage`,
      });
    }

    // Check specific metrics
    if (metrics.lines.pct < this.targetCoverage) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'testing' as IssueCategory,
        description: `Line coverage (${metrics.lines.pct.toFixed(1)}%) is below target`,
        fixable: false,
      });
    }

    if (metrics.branches.pct < this.targetCoverage) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'testing' as IssueCategory,
        description: `Branch coverage (${metrics.branches.pct.toFixed(1)}%) is below target`,
        fixable: false,
        suggestion: 'Add tests for conditional branches and edge cases',
      });
    }

    if (metrics.functions.pct < this.targetCoverage) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'testing' as IssueCategory,
        description: `Function coverage (${metrics.functions.pct.toFixed(1)}%) is below target`,
        fixable: false,
        suggestion: 'Add tests for uncovered functions',
      });
    }

    // Check for files without tests
    if (uncoveredFiles.length > 0) {
      issues.push({
        severity: 'low' as IssueSeverity,
        category: 'testing' as IssueCategory,
        description: `${uncoveredFiles.length} source files lack corresponding test files`,
        fixable: false,
        suggestion: 'Create test files for uncovered source files',
      });
    }

    return issues;
  }

  /**
   * Generate improvement suggestions
   */
  private generateCoverageImprovements(
    metrics: {
      lines: { pct: number };
      branches: { pct: number };
      functions: { pct: number };
      statements: { pct: number };
    },
    uncoveredFiles: Array<{ filepath: string; coverage: number }>
  ): Improvement[] {
    const improvements: Improvement[] = [];

    const avgCoverage =
      (metrics.lines.pct + metrics.branches.pct + metrics.functions.pct + metrics.statements.pct) / 4;

    // Overall coverage improvement
    if (avgCoverage < this.targetCoverage) {
      const gap = this.targetCoverage - avgCoverage;
      improvements.push({
        type: 'add-test' as ImprovementType,
        description: `Increase overall test coverage by ${gap.toFixed(1)}% to reach target of ${this.targetCoverage}%`,
        effort: 'moderate' as Effort,
        impact: gap > 20 ? ('high' as Impact) : ('medium' as Impact),
        steps: [
          'Identify critical code paths lacking coverage',
          'Write unit tests for business logic functions',
          'Add integration tests for API endpoints',
          'Include edge case and error scenario tests',
        ],
      });
    }

    // Branch coverage improvement
    if (metrics.branches.pct < this.targetCoverage) {
      improvements.push({
        type: 'add-test' as ImprovementType,
        description: 'Improve branch coverage by testing conditional logic',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Review functions with complex conditionals',
          'Add tests for each branch path',
          'Test error handling paths',
          'Include boundary value tests',
        ],
      });
    }

    // Add tests for uncovered files
    if (uncoveredFiles.length > 0 && uncoveredFiles.length <= 10) {
      improvements.push({
        type: 'add-test' as ImprovementType,
        description: `Create test files for ${uncoveredFiles.length} uncovered source files`,
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: uncoveredFiles.slice(0, 5).map((f) => `Create tests for ${f.filepath}`),
      });
    }

    return improvements;
  }

  /**
   * Calculate final coverage score
   */
  private calculateCoverageScore(metrics: {
    lines: { pct: number };
    branches: { pct: number };
    functions: { pct: number };
    statements: { pct: number };
  }): number {
    // Weighted average of coverage metrics
    // Lines and statements are more important than functions and branches
    const weights = {
      lines: 0.3,
      branches: 0.25,
      functions: 0.2,
      statements: 0.25,
    };

    const weightedAverage =
      metrics.lines.pct * weights.lines +
      metrics.branches.pct * weights.branches +
      metrics.functions.pct * weights.functions +
      metrics.statements.pct * weights.statements;

    // Apply curve - scores above 80% get bonus, below 50% get penalty
    if (weightedAverage >= this.targetCoverage) {
      return Math.min(100, weightedAverage + 5);
    } else if (weightedAverage >= this.minCoverage) {
      return weightedAverage;
    } else {
      // Penalize very low coverage
      return (weightedAverage / this.minCoverage) * 50;
    }
  }

  /**
   * Create result when no coverage data is available
   */
  private createNoCoverageResult(issues: Issue[], improvements: Improvement[]): DimensionScore {
    issues.unshift({
      severity: 'critical' as IssueSeverity,
      category: 'testing' as IssueCategory,
      description: 'No test coverage data found. Configure test coverage reporting.',
      fixable: true,
      suggestion: `Set up test coverage for your test runner (Vitest: --coverage, Jest: --coverage)`,
    });

    improvements.push({
      type: 'add-test' as ImprovementType,
      description: 'Set up test coverage reporting',
      effort: 'quick' as Effort,
      impact: 'high' as Impact,
      steps: [
        'Install coverage dependencies (c8, istanbul, or vitest/coverage)',
        'Configure coverage in test config file',
        'Add coverage script to package.json',
        'Run tests with coverage flag',
      ],
    });

    return {
      dimension: this.getDimension(),
      score: 0,
      weight: this.getWeight(),
      weightedScore: 0,
      issues,
      improvements,
      metadata: {
        metrics: { hasCoverage: 0 },
      },
    };
  }
}

/**
 * Default analyzer instance
 */
export const testCoverageAnalyzer = new TestCoverageAnalyzer();
