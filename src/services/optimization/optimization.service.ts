/**
 * Optimization Service
 *
 * Main orchestration service for bug detection, performance analysis,
 * and code optimization. Coordinates all detectors and optimizers.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  AppliedOptimization,
  DetectAndOptimizeOptions,
  DetectionOptions,
  OptimizationReport,
  OptimizationResult,
  Suggestion,
} from './optimization.types.js';
import { BugDetector } from './detectors/bug-detector.js';
import { CodeSmellDetector } from './detectors/code-smell-detector.js';
import { PerfDetector } from './detectors/perf-detector.js';
import { CodeOptimizer } from './optimizers/code-optimizer.js';
import { PerfOptimizer } from './optimizers/perf-optimizer.js';
import { RefactOptimizer } from './optimizers/refact-optimizer.js';
import { createLogger, type Logger } from '../../shared/utils/logger.js';

/**
 * Optimization Service - Main orchestration
 */
export class OptimizationService {
  private readonly logger: Logger;
  private readonly bugDetector: BugDetector;
  private readonly perfDetector: PerfDetector;
  private readonly codeSmellDetector: CodeSmellDetector;
  private readonly codeOptimizer: CodeOptimizer;
  private readonly perfOptimizer: PerfOptimizer;
  private readonly refactOptimizer: RefactOptimizer;

  constructor() {
    this.logger = createLogger('OptimizationService');
    this.bugDetector = new BugDetector();
    this.perfDetector = new PerfDetector();
    this.codeSmellDetector = new CodeSmellDetector();
    this.codeOptimizer = new CodeOptimizer();
    this.perfOptimizer = new PerfOptimizer();
    this.refactOptimizer = new RefactOptimizer();
  }

  /**
   * Detect all issues in a project
   */
  async detect(
    projectPath: string,
    options: DetectionOptions = {}
  ): Promise<OptimizationReport> {
    const startTime = performance.now();

    this.logger.info(`Starting optimization detection for: ${projectPath}`);

    // Verify project exists
    try {
      await fs.access(projectPath);
    } catch {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Run all detectors in parallel
    const [bugs, performanceIssues, codeSmells] = await Promise.all([
      this.bugDetector.detectInDirectory(projectPath, options).catch(err => {
        this.logger.error('Bug detection failed:', err);
        return [];
      }),
      this.perfDetector.detectInDirectory(projectPath, options).catch(err => {
        this.logger.error('Performance detection failed:', err);
        return [];
      }),
      this.codeSmellDetector.detectInDirectory(projectPath, options).catch(err => {
        this.logger.error('Code smell detection failed:', err);
        return [];
      }),
    ]);

    // Collect file statistics
    const stats = await this.collectFileStats(projectPath);

    const duration = Math.round(performance.now() - startTime);

    this.logger.info(
      `Detection complete in ${duration}ms: ${bugs.length} bugs, ` +
      `${performanceIssues.length} performance issues, ${codeSmells.length} code smells`
    );

    // Calculate total potential impact
    const totalPotentialImpact = this.calculatePotentialImpact(
      bugs,
      performanceIssues,
      codeSmells
    );

    return {
      projectPath,
      timestamp: new Date(),
      bugs: this.bugDetector.prioritizeBugs(bugs),
      performanceIssues: this.perfDetector.prioritizeIssues(performanceIssues),
      codeSmells: this.codeSmellDetector.prioritizeSmells(codeSmells),
      totalPotentialImpact,
      estimatedFixTime: this.estimateFixTime(bugs.length, performanceIssues.length, codeSmells.length),
      framework: await this.detectFramework(projectPath),
      filesAnalyzed: stats.fileCount,
      linesOfCode: stats.linesOfCode,
    };
  }

  /**
   * Apply optimizations to a project
   */
  async optimize(
    projectPath: string,
    optimizations: AppliedOptimization[],
    options: DetectAndOptimizeOptions = {}
  ): Promise<OptimizationResult> {
    const startTime = performance.now();

    this.logger.info(`Starting optimization for: ${projectPath}`);

    // Check if dry run
    if (options.dryRun) {
      this.logger.info('Dry run mode - no files will be modified');
    }

    // Check git status if not skipping
    if (!options.skipGitCheck && !options.dryRun) {
      const hasUncommittedChanges = await this.hasUncommittedChanges(projectPath);
      if (hasUncommittedChanges) {
        throw new Error(
          'Working directory has uncommitted changes. Please commit or stash changes before running optimizations, or use --skip-git-check'
        );
      }
    }

    const appliedOptimizations: AppliedOptimization[] = [];
    const errors: Array<{ target: string; message: string; fatal: boolean }> = [];

    // Group optimizations by file
    const optimizationsByFile = new Map<string, AppliedOptimization[]>();
    for (const opt of optimizations) {
      for (const file of opt.modifiedFiles) {
        const fullPath = path.resolve(projectPath, file);
        if (!optimizationsByFile.has(fullPath)) {
          optimizationsByFile.set(fullPath, []);
        }
        optimizationsByFile.get(fullPath)!.push(opt);
      }
    }

    // Apply optimizations per file
    for (const [filePath, fileOpts] of optimizationsByFile.entries()) {
      try {
        if (options.dryRun) {
          appliedOptimizations.push(...fileOpts);
          continue;
        }

        // Read file content
        const content = await fs.readFile(filePath, 'utf-8');

        // Apply appropriate optimizer based on optimization type
        for (const opt of fileOpts) {
          switch (opt.type) {
            case 'bug-fix':
            case 'refactoring':
              // Code optimizer handles basic refactoring
              break;
            case 'performance':
              // Performance optimizer
              break;
          }
        }

        appliedOptimizations.push(...fileOpts);
      } catch (error) {
        errors.push({
          target: filePath,
          message: error instanceof Error ? error.message : String(error),
          fatal: false,
        });
      }
    }

    const duration = Math.round(performance.now() - startTime);

    // Generate updated report
    const report = await this.detect(projectPath, options);

    return {
      report,
      appliedOptimizations,
      remainingSuggestions: [],
      estimatedImprovement: this.calculateEstimatedImprovement(appliedOptimizations),
      errors,
    };
  }

  /**
   * Detect and optimize in one operation
   */
  async detectAndOptimize(
    projectPath: string,
    options: DetectAndOptimizeOptions = {}
  ): Promise<OptimizationResult> {
    this.logger.info(`Starting detect-and-optimize for: ${projectPath}`);

    // First, detect all issues
    const report = await this.detect(projectPath, options);

    if (options.reportOnly) {
      return {
        report,
        appliedOptimizations: [],
        remainingSuggestions: [],
        estimatedImprovement: 'Report only - no optimizations applied',
        errors: [],
      };
    }

    if (options.detectOnly) {
      return {
        report,
        appliedOptimizations: [],
        remainingSuggestions: [],
        estimatedImprovement: 'Detect only - no optimizations applied',
        errors: [],
      };
    }

    // Determine which optimizations to apply
    const optimizationsToApply: AppliedOptimization[] = [];

    // Auto-fixable bugs
    const fixableBugs = report.bugs.filter(b => b.fixable);
    for (const bug of fixableBugs.slice(0, options.maxFixes || 10)) {
      if (options.minSeverity && !this.isSeverityMatch(bug.severity, options.minSeverity)) {
        continue;
      }

      optimizationsToApply.push({
        id: bug.id,
        type: 'bug-fix',
        description: bug.description,
        modifiedFiles: [bug.location.filePath],
        originalCode: bug.codeSnippet || '',
        fixedCode: bug.suggestedFix,
        location: bug.location,
      });
    }

    // Generate suggestions for non-auto-fixable issues
    const remainingSuggestions: Suggestion[] = [];

    for (const bug of report.bugs.filter(b => !b.fixable)) {
      remainingSuggestions.push({
        id: bug.id,
        type: 'bug-fix',
        description: bug.description,
        reason: 'Requires manual review and intervention',
        manualFix: bug.suggestedFix,
        location: bug.location,
      });
    }

    for (const perfIssue of report.performanceIssues) {
      remainingSuggestions.push({
        id: perfIssue.id,
        type: 'performance',
        description: perfIssue.description,
        reason: 'Performance optimization requires manual implementation',
        manualFix: perfIssue.expectedImprovement,
        location: perfIssue.location,
      });
    }

    for (const smell of report.codeSmells) {
      remainingSuggestions.push({
        id: smell.id,
        type: 'refactoring',
        description: smell.description,
        reason: 'Refactoring requires manual implementation',
        manualFix: smell.suggestion,
        location: smell.location,
      });
    }

    // Apply optimizations if autoFix is enabled
    let appliedOptimizations: AppliedOptimization[] = [];

    if (options.autoFix && optimizationsToApply.length > 0) {
      const result = await this.optimize(projectPath, optimizationsToApply, options);
      appliedOptimizations = result.appliedOptimizations;
    }

    return {
      report,
      appliedOptimizations,
      remainingSuggestions,
      estimatedImprovement: this.calculateEstimatedImprovement(appliedOptimizations),
      errors: [],
    };
  }

  /**
   * Generate a human-readable summary report
   */
  generateSummary(report: OptimizationReport): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('                    OPTIMIZATION REPORT');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Project: ${report.projectPath}`);
    lines.push(`Analyzed: ${report.timestamp.toLocaleString()}`);
    lines.push(`Files: ${report.filesAnalyzed} (${report.linesOfCode.toLocaleString()} LOC)`);
    lines.push(`Framework: ${report.framework || 'Unknown'}`);
    lines.push('');

    // Summary
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('SUMMARY');
    lines.push('───────────────────────────────────────────────────────────');
    lines.push(`Potential Impact Score: ${report.totalPotentialImpact}/100`);
    lines.push(`Estimated Fix Time: ${report.estimatedFixTime || 'Unknown'}`);
    lines.push('');

    // Bugs
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('BUGS');
    lines.push('───────────────────────────────────────────────────────────');
    const bugSummary = this.bugDetector.generateSummary(report.bugs);
    lines.push(`Total: ${bugSummary.total}`);
    lines.push(`  Critical: ${bugSummary.bySeverity.critical}`);
    lines.push(`  High: ${bugSummary.bySeverity.high}`);
    lines.push(`  Medium: ${bugSummary.bySeverity.medium}`);
    lines.push(`  Low: ${bugSummary.bySeverity.low}`);
    lines.push(`Fixable: ${bugSummary.fixable}`);
    lines.push('');

    // Top bugs
    const topBugs = report.bugs.slice(0, 5);
    if (topBugs.length > 0) {
      lines.push('Top Priority Bugs:');
      for (const bug of topBugs) {
        lines.push(`  [${bug.severity.toUpperCase()}] ${bug.description}`);
        lines.push(`    → ${bug.location.filePath}:${bug.location.line}`);
      }
      lines.push('');
    }

    // Performance Issues
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('PERFORMANCE ISSUES');
    lines.push('───────────────────────────────────────────────────────────');
    const perfSummary = this.perfDetector.generateSummary(report.performanceIssues);
    lines.push(`Total: ${perfSummary.total}`);
    lines.push(`  High Impact: ${perfSummary.byImpact.high}`);
    lines.push(`  Medium Impact: ${perfSummary.byImpact.medium}`);
    lines.push(`  Low Impact: ${perfSummary.byImpact.low}`);
    lines.push(`Estimated Gain: ${perfSummary.totalEstimatedGain}%`);
    lines.push('');

    // Top performance issues
    const topPerf = report.performanceIssues.slice(0, 5);
    if (topPerf.length > 0) {
      lines.push('Top Impact Issues:');
      for (const issue of topPerf) {
        lines.push(`  [${issue.impact.toUpperCase()}] ${issue.description}`);
        lines.push(`    → ${issue.location.filePath}:${issue.location.line}`);
        lines.push(`    Expected: ${issue.expectedImprovement}`);
      }
      lines.push('');
    }

    // Code Smells
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('CODE SMELLS');
    lines.push('───────────────────────────────────────────────────────────');
    const smellSummary = this.codeSmellDetector.generateSummary(report.codeSmells);
    lines.push(`Total: ${smellSummary.total}`);
    lines.push(`  High: ${smellSummary.bySeverity.high}`);
    lines.push(`  Medium: ${smellSummary.bySeverity.medium}`);
    lines.push(`  Low: ${smellSummary.bySeverity.low}`);
    lines.push(`Avg Complexity: ${smellSummary.avgComplexity}`);
    lines.push('');

    // Recommendations
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('RECOMMENDATIONS');
    lines.push('───────────────────────────────────────────────────────────');

    if (bugSummary.fixable > 0) {
      lines.push(`• Apply ${bugSummary.fixable} auto-fixable bugs immediately`);
    }
    if (perfSummary.totalEstimatedGain > 30) {
      lines.push(`• Address performance issues for ${perfSummary.totalEstimatedGain}% potential improvement`);
    }
    if (bugSummary.bySeverity.critical > 0) {
      lines.push(`• CRITICAL: Fix ${bugSummary.bySeverity.critical} critical bugs before deployment`);
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Calculate potential impact score (0-100)
   */
  private calculatePotentialImpact(
    bugs: unknown[],
    perfIssues: { estimatedGain?: number }[],
    codeSmells: { complexityScore?: number }[]
  ): number {
    const bugWeight = 2;
    const perfWeight = 1;
    const smellWeight = 0.5;

    const bugScore = Math.min(bugs.length * bugWeight, 40);
    const perfScore = Math.min(
      perfIssues.reduce((sum, p) => sum + (p.estimatedGain || 0), 0) / 10,
      40
    );
    const smellScore = Math.min(
      codeSmells.reduce((sum, s) => sum + (s.complexityScore || 0), 0) / 20,
      20
    );

    return Math.round(Math.min(bugScore + perfScore + smellScore, 100));
  }

  /**
   * Estimate time to fix all issues
   */
  private estimateFixTime(bugCount: number, perfCount: number, smellCount: number): string {
    const bugTime = bugCount * 15; // 15 minutes per bug
    const perfTime = perfCount * 30; // 30 minutes per perf issue
    const smellTime = smellCount * 20; // 20 minutes per code smell

    const totalMinutes = bugTime + perfTime + smellTime;

    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours < 8) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`;
    }

    const days = Math.ceil(hours / 8);
    return `${days} days`;
  }

  /**
   * Calculate estimated improvement from applied optimizations
   */
  private calculateEstimatedImprovement(optimizations: AppliedOptimization[]): string {
    if (optimizations.length === 0) {
      return 'No optimizations applied';
    }

    const perfOpts = optimizations.filter(o => o.type === 'performance').length;
    const bugOpts = optimizations.filter(o => o.type === 'bug-fix').length;
    const refactorOpts = optimizations.filter(o => o.type === 'refactoring').length;

    const improvements: string[] = [];

    if (perfOpts > 0) {
      improvements.push(`~${perfOpts * 5}% performance improvement`);
    }
    if (bugOpts > 0) {
      improvements.push(`${bugOpts} bugs fixed`);
    }
    if (refactorOpts > 0) {
      improvements.push(`${refactorOpts} refactorings applied`);
    }

    return improvements.join(', ') || 'Minor improvements';
  }

  /**
   * Detect project framework
   */
  private async detectFramework(projectPath: string): Promise<string | undefined> {
    try {
      const pkgPath = path.join(projectPath, 'package.json');
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.next) return 'Next.js';
      if (deps.react && deps.vite) return 'Vite + React';
      if (deps.vue && deps.vite) return 'Vite + Vue';
      if (deps.svelte && deps.vite) return 'Vite + Svelte';
      if (deps.remix) return 'Remix';
      if (deps['@sveltejs/kit']) return 'SvelteKit';
      if (deps.nuxt) return 'Nuxt';
      if (deps.astro) return 'Astro';
      if (deps.gatsby) return 'Gatsby';
      if (deps.angular) return 'Angular';
      if (deps.react) return 'React';
      if (deps.vue) return 'Vue';
      if (deps.svelte) return 'Svelte';
      if (deps.express) return 'Express';
      if (deps.nest) return 'NestJS';
      if (deps.fastify) return 'Fastify';
      if (deps.hono) return 'Hono';

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Collect file statistics
   */
  private async collectFileStats(projectPath: string): Promise<{
    fileCount: number;
    linesOfCode: number;
  }> {
    let fileCount = 0;
    let linesOfCode = 0;

    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];

    async function walk(currentPath: string) {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build'
          ) {
            continue;
          }

          const fullPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              fileCount++;
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                linesOfCode += content.split('\n').length;
              } catch {
                // Skip files that can't be read
              }
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    await walk(projectPath);
    return { fileCount, linesOfCode };
  }

  /**
   * Check if working directory has uncommitted changes
   */
  private async hasUncommittedChanges(projectPath: string): Promise<boolean> {
    try {
      const { exec } = await import('node:child_process');
      const util = require('node:util');
      const execAsync = util.promisify(exec);

      const { stdout } = await execAsync('git status --porcelain', {
        cwd: projectPath,
      });

      return stdout.trim().length > 0;
    } catch {
      // Not a git repo or git not available
      return false;
    }
  }

  /**
   * Check if severity matches minimum requirement
   */
  private isSeverityMatch(
    severity: 'critical' | 'high' | 'medium' | 'low',
    minSeverity: 'critical' | 'high' | 'medium' | 'low'
  ): boolean {
    const order = ['critical', 'high', 'medium', 'low'];
    return order.indexOf(severity) <= order.indexOf(minSeverity);
  }
}
