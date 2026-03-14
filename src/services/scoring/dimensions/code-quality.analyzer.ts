/**
 * Code Quality Analyzer
 *
 * Analyzes code quality by running ESLint, checking cyclomatic complexity,
 * detecting code duplication, and enforcing naming conventions.
 *
 * @module services/scoring/dimensions/code-quality
 */

import { readFile, access, readdir, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
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
 * ESLint result structure
 */
interface EslintResult {
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  filePath?: string;
  messages?: Array<{
    ruleId: string | null;
    severity: number;
    message: string;
    line: number;
    column: number;
  }>;
}

/**
 * Complexity metrics for a file
 */
interface FileComplexity {
  filepath: string;
  complexity: number;
  lineCount: number;
  functionCount: number;
}

/**
 * Code duplication entry
 */
interface DuplicationEntry {
  filepath: string;
  lines: string;
  occurrences: number;
}

/**
 * Code quality analyzer configuration
 */
export interface CodeQualityAnalyzerOptions {
  /** Maximum cyclomatic complexity threshold */
  maxComplexity?: number;
  /** Maximum function length in lines */
  maxFunctionLength?: number;
  /** Duplication threshold percentage */
  duplicationThreshold?: number;
  /** Custom ESLint command */
  eslintCommand?: string;
  /** Check for TypeScript-specific issues */
  checkTypeScript?: boolean;
}

/**
 * Code Quality Analyzer
 *
 * Evaluates code quality across multiple dimensions:
 * - ESLint violations
 * - Cyclomatic complexity
 * - Code duplication
 * - Function length
 * - Naming conventions
 */
export class CodeQualityAnalyzer {
  /** Analyzer configuration */
  readonly config: DimensionAnalyzerConfig = {
    dimension: 'code-quality' as CodeDimension,
    defaultWeight: 0.15,
    estimatedDuration: 45000,
    supportedFrameworks: ['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'NestJS', 'Angular', 'Remix', 'SvelteKit', 'Astro', 'Gatsby'],
  };

  private readonly logger: Logger;
  private readonly executor: CommandExecutor;
  private readonly maxComplexity: number;
  private readonly maxFunctionLength: number;
  private readonly duplicationThreshold: number;
  private readonly eslintCommand: string;
  private readonly checkTypeScript: boolean;

  constructor(options: CodeQualityAnalyzerOptions = {}) {
    this.logger = createLogger('CodeQualityAnalyzer');
    this.executor = new CommandExecutor();
    this.maxComplexity = options.maxComplexity ?? 10;
    this.maxFunctionLength = options.maxFunctionLength ?? 50;
    this.duplicationThreshold = options.duplicationThreshold ?? 5;
    this.eslintCommand = options.eslintCommand ?? 'npx eslint';
    this.checkTypeScript = options.checkTypeScript ?? true;
  }

  /**
   * Get the dimension this analyzer handles
   */
  getDimension(): CodeDimension {
    return 'code-quality';
  }

  /**
   * Get the default weight for this dimension
   */
  getWeight(): number {
    return 0.15; // 15% weight in overall score
  }

  /**
   * Analyze code quality for a project
   *
   * @param projectPath - Path to the project root
   * @param _framework - Detected framework (optional, for framework-specific analysis)
   * @param _options - Scoring options (optional)
   * @returns Dimension score with quality metrics
   */
  async analyze(projectPath: string, _framework?: Framework, _options?: ScoringOptions): Promise<DimensionScore> {
    const startTime = performance.now();

    this.logger.info(`Analyzing code quality for: ${projectPath}`);

    const issues: Issue[] = [];
    const improvements: Improvement[] = [];

    try {
      // Run ESLint
      const eslintResults = await this.runEslint(projectPath);

      // Analyze complexity
      const complexityMetrics = await this.analyzeComplexity(projectPath);

      // Check for code duplication
      const duplications = await this.detectDuplications(projectPath);

      // Check function lengths
      const longFunctions = await this.findLongFunctions(projectPath);

      // Check naming conventions
      const namingViolations = await this.checkNamingConventions(projectPath);

      // Build issues list
      issues.push(...this.identifyQualityIssues(eslintResults, complexityMetrics, duplications, longFunctions, namingViolations));

      // Build improvements list
      improvements.push(...this.generateQualityImprovements(eslintResults, complexityMetrics, duplications, longFunctions));

      // Calculate final score
      const score = this.calculateQualityScore(eslintResults, complexityMetrics, duplications, longFunctions);

      const duration = Math.round(performance.now() - startTime);

      return {
        dimension: this.getDimension(),
        score,
        weight: this.getWeight(),
        weightedScore: score * this.getWeight(),
        issues,
        improvements,
        metadata: {
          itemsChecked: await this.countSourceFiles(projectPath),
          itemsPassed: await this.countPassedChecks(eslintResults, complexityMetrics, duplications),
          metrics: {
            eslintErrors: eslintResults.reduce((sum, r) => sum + r.errorCount, 0),
            eslintWarnings: eslintResults.reduce((sum, r) => sum + r.warningCount, 0),
            avgComplexity: this.calculateAverageComplexity(complexityMetrics),
            maxComplexity: Math.max(0, ...complexityMetrics.map((m) => m.complexity)),
            duplications: duplications.length,
            longFunctions: longFunctions.length,
            namingViolations: namingViolations.length,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error analyzing code quality', error);

      issues.push({
        severity: 'high' as IssueSeverity,
        category: 'code-style' as IssueCategory,
        description: `Failed to analyze code quality: ${error instanceof Error ? error.message : String(error)}`,
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
   * Run ESLint and parse results
   */
  private async runEslint(projectPath: string): Promise<EslintResult[]> {
    const results: EslintResult[] = [];

    try {
      // Check for ESLint config
      const hasEslintConfig = await this.hasEslintConfig(projectPath);
      if (!hasEslintConfig) {
        this.logger.info('No ESLint config found, skipping ESLint analysis');
        return results;
      }

      // Run ESLint with JSON formatter
      const command = `${this.eslintCommand} . --format json --max-warnings 0`;
      const execResult = await this.executor.execute(command, {
        cwd: projectPath,
        timeout: 60000,
        silent: true,
      });

      if (!execResult.success || !execResult.data) {
        // ESLint may have found issues, try to parse output
        if (execResult.error) {
          this.logger.warn('ESLint execution failed', execResult.error);
        }
        return results;
      }

      try {
        const eslintOutput = JSON.parse(execResult.data.stdout) as EslintResult[] | EslintResult;
        return Array.isArray(eslintOutput) ? eslintOutput : [eslintOutput];
      } catch {
        // Output not in expected format
        return results;
      }
    } catch (error) {
      this.logger.warn('Failed to run ESLint', error);
      return results;
    }
  }

  /**
   * Check if project has ESLint configuration
   */
  private async hasEslintConfig(projectPath: string): Promise<boolean> {
    const configFiles = [
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
      '.eslintrc.yaml',
      '.eslintrc.yml',
      'eslint.config.js',
      'eslint.config.mjs',
      '.eslintrc',
    ];

    for (const file of configFiles) {
      try {
        await access(join(projectPath, file));
        return true;
      } catch {
        continue;
      }
    }

    // Also check package.json for eslintConfig
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      if (pkg.eslintConfig) {
        return true;
      }
    } catch {
      // Ignore
    }

    return false;
  }

  /**
   * Analyze cyclomatic complexity of source files
   */
  private async analyzeComplexity(projectPath: string): Promise<FileComplexity[]> {
    const complexities: FileComplexity[] = [];
    const srcDir = join(projectPath, 'src');

    if (!existsSync(srcDir)) {
      return complexities;
    }

    await this.scanDirectoryForComplexity(srcDir, projectPath, complexities);

    return complexities;
  }

  /**
   * Recursively scan directory and calculate complexity
   */
  private async scanDirectoryForComplexity(
    dir: string,
    projectPath: string,
    complexities: FileComplexity[]
  ): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }
          await this.scanDirectoryForComplexity(fullPath, projectPath, complexities);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            const metrics = await this.calculateFileComplexity(fullPath);
            if (metrics) {
              complexities.push(metrics);
            }
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Calculate cyclomatic complexity for a single file
   */
  private async calculateFileComplexity(filepath: string): Promise<FileComplexity | null> {
    try {
      const content = await readFile(filepath, 'utf-8');
      const lines = content.split('\n');

      // Simplified complexity calculation
      // Count decision points: if, else, for, while, case, catch, ?, &&, ||
      let complexity = 1; // Base complexity
      let functionCount = 0;

      const decisionKeywords = [
        /\bif\b/g,
        /\belse\b/g,
        /\bfor\b/g,
        /\bwhile\b/g,
        /\bswitch\b/g,
        /\bcase\b/g,
        /\bcatch\b/g,
        /\?/g,
        /&&/g,
        /\|\|/g,
      ];

      for (const line of lines) {
        const trimmed = line.trim();

        // Count function declarations
        if (/^\s*(async\s+)?(function\s+\w+|const\s+\w+\s*=\s*(async\s+)?\(?[\w\s,]*\)?\s*=>)/.test(trimmed)) {
          functionCount++;
        }

        // Count decision points
        for (const keyword of decisionKeywords) {
          const matches = trimmed.match(keyword);
          if (matches) {
            complexity += matches.length;
          }
        }
      }

      return {
        filepath: relative(process.cwd(), filepath),
        complexity,
        lineCount: lines.length,
        functionCount,
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect code duplication using simplified token analysis
   */
  private async detectDuplications(projectPath: string): Promise<DuplicationEntry[]> {
    const duplications: DuplicationEntry[] = [];
    const srcDir = join(projectPath, 'src');

    if (!existsSync(srcDir)) {
      return duplications;
    }

    // Collect all normalized lines from source files
    const lineMap = new Map<string, string[]>();

    await this.collectNormalizedLines(srcDir, lineMap);

    // Find duplicated lines
    for (const [line, files] of Array.from(lineMap.entries())) {
      if (files.length >= this.duplicationThreshold && line.length > 30) {
        // Skip very short lines (likely not meaningful duplication)
        duplications.push({
          filepath: files[0],
          lines: line,
          occurrences: files.length,
        });
      }
    }

    return duplications.slice(0, 50); // Limit results
  }

  /**
   * Collect normalized lines from source files for duplication detection
   */
  private async collectNormalizedLines(
    dir: string,
    lineMap: Map<string, string[]>
  ): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }
          await this.collectNormalizedLines(fullPath, lineMap);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');
              const lines = content.split('\n');

              for (const line of lines) {
                const trimmed = line.trim();
                // Normalize: remove string literals, extra whitespace
                const normalized = trimmed
                  .replace(/['"`].*?['"`]/g, '""')
                  .replace(/\s+/g, ' ')
                  .toLowerCase();

                if (normalized.length > 20 && !normalized.startsWith('//') && !normalized.startsWith('*')) {
                  if (!lineMap.has(normalized)) {
                    lineMap.set(normalized, []);
                  }
                  lineMap.get(normalized)!.push(relative(process.cwd(), fullPath));
                }
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Find functions that exceed maximum length
   */
  private async findLongFunctions(projectPath: string): Promise<Array<{ filepath: string; functionName: string; lineCount: number }>> {
    const longFunctions: Array<{ filepath: string; functionName: string; lineCount: number }> = [];
    const srcDir = join(projectPath, 'src');

    if (!existsSync(srcDir)) {
      return longFunctions;
    }

    await this.scanForLongFunctions(srcDir, projectPath, longFunctions);

    return longFunctions;
  }

  /**
   * Scan directory for long functions
   */
  private async scanForLongFunctions(
    dir: string,
    projectPath: string,
    longFunctions: Array<{ filepath: string; functionName: string; lineCount: number }>
  ): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }
          await this.scanForLongFunctions(fullPath, projectPath, longFunctions);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            await this.analyzeFileForLongFunctions(fullPath, longFunctions);
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Analyze a single file for long functions
   */
  private async analyzeFileForLongFunctions(
    filepath: string,
    longFunctions: Array<{ filepath: string; functionName: string; lineCount: number }>
  ): Promise<void> {
    try {
      const content = await readFile(filepath, 'utf-8');
      const lines = content.split('\n');

      let currentFunction: { name: string; startLine: number; braceCount: number } | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect function start
        const functionMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(?[\w\s,]*\)?\s*=>)|(\w+)\s*\([^)]*\)\s*{)/);
        if (functionMatch && !line.includes('=>')) {
          const functionName = functionMatch[1] || functionMatch[2] || functionMatch[3] || 'anonymous';
          currentFunction = { name: functionName, startLine: i, braceCount: 0 };
        }

        // Track braces for function scope
        if (currentFunction) {
          if (line.includes('{')) {
            currentFunction.braceCount += (line.match(/{/g) || []).length;
          }
          if (line.includes('}')) {
            currentFunction.braceCount -= (line.match(/}/g) || []).length;

            // Function ended
            if (currentFunction.braceCount === 0) {
              const lineCount = i - currentFunction.startLine;
              if (lineCount > this.maxFunctionLength) {
                longFunctions.push({
                  filepath: relative(process.cwd(), filepath),
                  functionName: currentFunction.name,
                  lineCount,
                });
              }
              currentFunction = null;
            }
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  /**
   * Check naming conventions
   */
  private async checkNamingConventions(projectPath: string): Promise<Array<{ filepath: string; issue: string }>> {
    const violations: Array<{ filepath: string; issue: string }> = [];
    const srcDir = join(projectPath, 'src');

    if (!existsSync(srcDir)) {
      return violations;
    }

    await this.scanForNamingViolations(srcDir, violations);

    return violations;
  }

  /**
   * Scan directory for naming convention violations
   */
  private async scanForNamingViolations(dir: string, violations: Array<{ filepath: string; issue: string }>): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }
          await this.scanForNamingViolations(fullPath, violations);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);

          // Check file naming
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            const expectedPattern = /^(?:[a-z][a-z0-9-]*|[A-Z][a-zA-Z0-9]*)$/;

            if (!expectedPattern.test(entry.name.replace(ext, '')) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
              violations.push({
                filepath: relative(process.cwd(), fullPath),
                issue: `File name "${entry.name}" does not follow kebab-case or PascalCase conventions`,
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
   * Identify quality issues from metrics
   */
  private identifyQualityIssues(
    eslintResults: EslintResult[],
    complexityMetrics: FileComplexity[],
    duplications: DuplicationEntry[],
    longFunctions: Array<{ filepath: string; functionName: string; lineCount: number }>,
    namingViolations: Array<{ filepath: string; issue: string }>
  ): Issue[] {
    const issues: Issue[] = [];

    // ESLint issues
    const totalErrors = eslintResults.reduce((sum, r) => sum + r.errorCount, 0);
    const totalWarnings = eslintResults.reduce((sum, r) => sum + r.warningCount, 0);

    if (totalErrors > 0) {
      issues.push({
        severity: 'high' as IssueSeverity,
        category: 'code-style' as IssueCategory,
        description: `ESLint found ${totalErrors} error(s) and ${totalWarnings} warning(s)`,
        fixable: eslintResults.reduce((sum, r) => sum + r.fixableErrorCount, 0) > 0,
        suggestion: 'Run eslint with --fix to auto-fix some issues',
      });
    }

    // Complexity issues
    const highComplexityFiles = complexityMetrics.filter((m) => m.complexity > this.maxComplexity);
    if (highComplexityFiles.length > 0) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'code-style' as IssueCategory,
        description: `${highComplexityFiles.length} file(s) exceed complexity threshold of ${this.maxComplexity}`,
        fixable: false,
        suggestion: 'Refactor complex functions into smaller, more manageable pieces',
      });
    }

    // Duplication issues
    if (duplications.length > 0) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'code-style' as IssueCategory,
        description: `Found ${duplications.length} duplicated code pattern(s)`,
        fixable: false,
        suggestion: 'Extract duplicated code into reusable functions or utilities',
      });
    }

    // Long function issues
    if (longFunctions.length > 0) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'code-style' as IssueCategory,
        description: `${longFunctions.length} function(s) exceed ${this.maxFunctionLength} lines`,
        fixable: false,
        suggestion: 'Break down long functions into smaller, single-purpose functions',
      });
    }

    // Naming violations
    if (namingViolations.length > 0) {
      issues.push({
        severity: 'low' as IssueSeverity,
        category: 'code-style' as IssueCategory,
        description: `${namingViolations.length} file(s) have naming convention violations`,
        fixable: true,
        suggestion: 'Rename files to follow kebab-case or PascalCase conventions',
      });
    }

    return issues;
  }

  /**
   * Generate improvement suggestions
   */
  private generateQualityImprovements(
    eslintResults: EslintResult[],
    complexityMetrics: FileComplexity[],
    duplications: DuplicationEntry[],
    longFunctions: Array<{ filepath: string; functionName: string; lineCount: number }>
  ): Improvement[] {
    const improvements: Improvement[] = [];

    // ESLint improvements
    if (eslintResults.length > 0) {
      const fixableIssues = eslintResults.reduce((sum, r) => sum + r.fixableErrorCount + r.fixableWarningCount, 0);
      if (fixableIssues > 0) {
        improvements.push({
          type: 'refactor' as ImprovementType,
          description: `Run eslint --fix to resolve ${fixableIssues} auto-fixable issue(s)`,
          effort: 'quick' as Effort,
          impact: 'medium' as Impact,
        });
      }
    }

    // Complexity improvements
    const highComplexityFiles = complexityMetrics.filter((m) => m.complexity > this.maxComplexity);
    if (highComplexityFiles.length > 0) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: `Reduce complexity in ${highComplexityFiles.length} file(s) by extracting complex logic`,
        effort: 'moderate' as Effort,
        impact: 'high' as Impact,
      });
    }

    // Duplication improvements
    if (duplications.length > 0) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: `Eliminate ${duplications.length} code duplication pattern(s)`,
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
      });
    }

    // Long function improvements
    if (longFunctions.length > 0 && longFunctions.length <= 5) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Break down long functions into smaller components',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Identify the core responsibility of each function',
          'Extract auxiliary logic into separate functions',
          'Consider using design patterns for complex logic',
        ],
      });
    }

    return improvements;
  }

  /**
   * Calculate final quality score
   */
  private calculateQualityScore(
    eslintResults: EslintResult[],
    complexityMetrics: FileComplexity[],
    duplications: DuplicationEntry[],
    longFunctions: Array<{ filepath: string; functionName: string; lineCount: number }>
  ): number {
    let score = 100;

    // ESLint penalty
    const totalErrors = eslintResults.reduce((sum, r) => sum + r.errorCount, 0);
    const totalWarnings = eslintResults.reduce((sum, r) => sum + r.warningCount, 0);
    score -= totalErrors * 2;
    score -= totalWarnings * 0.5;

    // Complexity penalty
    const avgComplexity = this.calculateAverageComplexity(complexityMetrics);
    if (avgComplexity > this.maxComplexity) {
      score -= (avgComplexity - this.maxComplexity) * 3;
    }

    // Duplication penalty
    score -= duplications.length * 2;

    // Long function penalty
    score -= longFunctions.length * 3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate average complexity
   */
  private calculateAverageComplexity(metrics: FileComplexity[]): number {
    if (metrics.length === 0) return 0;
    const total = metrics.reduce((sum, m) => sum + m.complexity, 0);
    return total / metrics.length;
  }

  /**
   * Count source files in project
   */
  private async countSourceFiles(projectPath: string): Promise<number> {
    const srcDir = join(projectPath, 'src');
    if (!existsSync(srcDir)) return 0;

    let count = 0;
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    async function countDir(dir: string): Promise<void> {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
              await countDir(fullPath);
            }
          } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
            count++;
          }
        }
      } catch {
        // Ignore
      }
    }

    await countDir(srcDir);
    return count;
  }

  /**
   * Count passed checks
   */
  private async countPassedChecks(
    eslintResults: EslintResult[],
    complexityMetrics: FileComplexity[],
    duplications: DuplicationEntry[]
  ): Promise<number> {
    const totalErrors = eslintResults.reduce((sum, r) => sum + r.errorCount, 0);
    const highComplexity = complexityMetrics.filter((m) => m.complexity > this.maxComplexity).length;
    const passedIssues = totalErrors === 0 ? 1 : 0;
    const passedComplexity = highComplexity === 0 ? 1 : 0;
    const passedDuplications = duplications.length === 0 ? 1 : 0;

    return passedIssues + passedComplexity + passedDuplications;
  }
}

/**
 * Default analyzer instance
 */
export const codeQualityAnalyzer = new CodeQualityAnalyzer();
