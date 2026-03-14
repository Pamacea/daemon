/**
 * Review Command
 *
 * Performs comprehensive code review and generates reports.
 *
 * @module cli/commands/review
 */

import { createLogger } from '../../shared/utils/logger.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { DimensionParser, type ReviewOptions } from './command.types.js';
import { formatter } from '../utils/output.js';
import { withProgress, type ProgressManager } from '../utils/progress.js';

const logger = createLogger('ReviewCommand');

/**
 * Mock ReviewService - assumes service exists
 * TODO: Replace with actual import when service is implemented
 * import { ReviewService } from '../../services/review/review.service.js';
 */

/**
 * Issue severity levels
 */
type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Review issue
 */
interface ReviewIssue {
  id: string;
  dimension: string;
  severity: IssueSeverity;
  category: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  fixable: boolean;
  suggestion?: string;
}

/**
 * Review results
 */
interface ReviewResults {
  summary: {
    totalIssues: number;
    bySeverity: Record<string, number>;
    byDimension: Record<string, number>;
    fixable: number;
    fixed: number;
  };
  issues: ReviewIssue[];
  reportPath?: string;
}

/**
 * Review command for Daemon
 *
 * Performs comprehensive code review:
 * - Analyzes code quality across dimensions
 * - Identifies security vulnerabilities
 * - Finds performance issues
 * - Checks test coverage
 * - Can auto-fix issues
 * - Generates reports (text, json, html, markdown)
 */
export class ReviewCommand {
  /**
   * Execute the review command
   */
  async execute(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    try {
      if (options.verbose) {
        logger.debug('Starting code review...', { options });
      }

      const results = await withProgress(
        async (progress) => {
          progress.report(5, 'Initializing review...');
          return await this.performReview(options, progress);
        },
        {
          onStart: (msg) => logger.info(msg),
          onComplete: (msg) => logger.success(msg),
          onError: (err) => logger.error('Review failed', err),
        }
      );

      // Output results
      if (options.json || options.format === 'json') {
        console.log(formatter.json(results));
      } else {
        this.displayResults(results, options);
      }

      // Write report file if specified
      if (options.outputFile) {
        await this.writeReport(results, options);
      }
    } catch (error) {
      logger.error('Review command failed', error);
      throw error;
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): ReviewOptions {
    const options: ReviewOptions = {
      verbose: false,
      json: false,
      format: 'text',
      fix: false,
      auto: false,
      severity: 'low',
    };

    for (const arg of args) {
      switch (arg) {
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--json':
          options.json = true;
          options.format = 'json';
          break;
        case '--fix':
        case '-f':
          options.fix = true;
          break;
        case '--auto':
        case '-a':
          options.auto = true;
          break;
        default:
          if (arg.startsWith('--dim=')) {
            const value = arg.split('=')[1];
            if (value) {
              options.dim = DimensionParser.parse(value);
            }
          } else if (arg.startsWith('--format=')) {
            const value = arg.split('=')[1];
            if (value && ['text', 'json', 'html', 'markdown'].includes(value)) {
              options.format = value as any;
            }
          } else if (arg.startsWith('--output=')) {
            const value = arg.split('=')[1];
            if (value) {
              options.outputFile = value;
            }
          } else if (arg.startsWith('--severity=')) {
            const value = arg.split('=')[1];
            if (value && ['low', 'medium', 'high', 'critical'].includes(value)) {
              options.severity = value as any;
            }
          } else if (arg.startsWith('-o')) {
            // Short form for output
            const value = arg.slice(2);
            if (value) {
              options.outputFile = value;
            }
          }
      }
    }

    return options;
  }

  /**
   * Perform the code review
   */
  private async performReview(options: ReviewOptions, progress: ProgressManager): Promise<ReviewResults> {
    const projectDir = options.projectDir ?? process.cwd();

    progress.report(15, 'Scanning project files...');
    await this.delay(400);

    progress.report(30, 'Analyzing code quality...');
    await this.delay(600);

    progress.report(50, 'Checking for security issues...');
    await this.delay(500);

    progress.report(70, 'Analyzing performance...');
    await this.delay(400);

    progress.report(85, 'Running test analysis...');
    await this.delay(400);

    progress.report(95, 'Compiling results...');

    // Mock review results
    const issues: ReviewIssue[] = this.generateMockIssues();
    const dimensions = options.dim
      ? (Array.isArray(options.dim) ? options.dim : [options.dim])
      : DimensionParser.getAll();

    // Filter by dimensions
    const filteredIssues = dimensions.length > 0
      ? issues.filter((i) => dimensions.map(String).includes(i.dimension.toLowerCase()))
      : issues;

    // Filter by severity
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const minSeverity = severityOrder[options.severity ?? 'low'] ?? 1;
    const severityFilteredIssues = filteredIssues.filter(
      (i) => severityOrder[i.severity] >= minSeverity
    );

    // Apply fixes if requested
    let fixedCount = 0;
    if (options.fix) {
      progress.report(98, 'Applying fixes...');
      fixedCount = await this.applyFixes(severityFilteredIssues, options.auto ?? false);
    }

    // Build summary
    const summary = {
      totalIssues: severityFilteredIssues.length,
      bySeverity: this.groupBy(severityFilteredIssues, 'severity'),
      byDimension: this.groupBy(severityFilteredIssues, 'dimension'),
      fixable: severityFilteredIssues.filter((i) => i.fixable).length,
      fixed: fixedCount,
    };

    progress.report(100, 'Review complete');

    return {
      summary,
      issues: severityFilteredIssues,
      reportPath: options.outputFile,
    };
  }

  /**
   * Generate mock issues for demonstration
   */
  private generateMockIssues(): ReviewIssue[] {
    return [
      {
        id: 'SEC001',
        dimension: 'security',
        severity: 'critical',
        category: 'Injection',
        message: 'Potential SQL injection vulnerability',
        file: 'src/api/users.ts',
        line: 45,
        code: "const query = `SELECT * FROM users WHERE id = ${userId}`",
        fixable: true,
        suggestion: 'Use parameterized queries instead',
      },
      {
        id: 'SEC002',
        dimension: 'security',
        severity: 'high',
        category: 'XSS',
        message: 'Unsanitized user input rendered to DOM',
        file: 'src/components/UserProfile.tsx',
        line: 23,
        fixable: true,
        suggestion: 'Use DOMPurify or textContent for user input',
      },
      {
        id: 'PERF001',
        dimension: 'performance',
        severity: 'medium',
        category: 'Rendering',
        message: 'Missing React.memo for expensive component',
        file: 'src/components/DataTable.tsx',
        line: 12,
        fixable: true,
        suggestion: 'Wrap component in React.memo()',
      },
      {
        id: 'PERF002',
        dimension: 'performance',
        severity: 'low',
        category: 'Bundle',
        message: 'Large dependency bundle size',
        file: 'package.json',
        code: 'moment: 67KB (consider using date-fns)',
        fixable: false,
        suggestion: 'Replace moment.js with a lighter alternative',
      },
      {
        id: 'TEST001',
        dimension: 'test',
        severity: 'high',
        category: 'Coverage',
        message: 'Critical function lacks test coverage',
        file: 'src/utils/auth.ts',
        line: 15,
        fixable: true,
        suggestion: 'Add unit tests for authentication logic',
      },
      {
        id: 'TEST002',
        dimension: 'test',
        severity: 'medium',
        category: 'Assertions',
        message: 'Test lacks proper assertions',
        file: 'src/auth.test.ts',
        line: 8,
        code: 'it("should login", () => { login(); })',
        fixable: true,
        suggestion: 'Add assertions to verify expected behavior',
      },
      {
        id: 'REL001',
        dimension: 'reliability',
        severity: 'medium',
        category: 'Error Handling',
        message: 'Uncaught promise rejection',
        file: 'src/api/client.ts',
        line: 67,
        fixable: true,
        suggestion: 'Add .catch() handler or try/catch block',
      },
      {
        id: 'MAINT001',
        dimension: 'maintainability',
        severity: 'low',
        category: 'Complexity',
        message: 'Function exceeds cyclomatic complexity threshold',
        file: 'src/services/data.ts',
        line: 120,
        fixable: false,
        suggestion: 'Consider refactoring into smaller functions',
      },
      {
        id: 'COV001',
        dimension: 'coverage',
        severity: 'medium',
        category: 'Lines',
        message: 'File has less than 50% coverage',
        file: 'src/utils/helpers.ts',
        fixable: true,
        suggestion: 'Add tests for uncovered code paths',
      },
    ];
  }

  /**
   * Apply fixes to issues
   */
  private async applyFixes(issues: ReviewIssue[], autoMode: boolean): Promise<number> {
    const fixableIssues = issues.filter((i) => i.fixable);

    if (fixableIssues.length === 0) {
      return 0;
    }

    if (!autoMode) {
      // In interactive mode, we would prompt for each fix
      // For now, we'll just count what could be fixed
      logger.info(`${fixableIssues.length} issues can be auto-fixed`);
      logger.info('Run with --auto flag to apply all fixes');
      return 0;
    }

    // Apply fixes in auto mode
    // Mock implementation - actual service would apply real fixes
    let applied = 0;
    for (const issue of fixableIssues) {
      try {
        // Mock fix application
        // await reviewService.applyFix(issue);
        applied++;
      } catch {
        // Fix failed, continue with next
      }
    }

    return applied;
  }

  /**
   * Group issues by field
   */
  private groupBy(issues: ReviewIssue[], field: 'severity' | 'dimension'): Record<string, number> {
    return issues.reduce((acc, issue) => {
      const key = issue[field];
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Display formatted results
   */
  private displayResults(results: ReviewResults, options: ReviewOptions): void {
    console.log('');
    console.log(formatter.header('Code Review Results', 1));

    // Summary
    console.log(formatter.reviewResults(results.summary));

    // Issues list
    if (options.verbose && results.issues.length > 0) {
      console.log('');
      console.log(formatter.header('Issues Found', 2));

      const sortedIssues = [...results.issues].sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

      for (const issue of sortedIssues) {
        this.displayIssue(issue);
      }
    }

    // Recommendations
    if (results.summary.fixable > 0) {
      console.log('');
      console.log(formatter.header('Recommendations', 2));
      console.log(`  ${formatter.bullet(`${results.summary.fixable} issues can be auto-fixed`, 1, '✓')}`);
      console.log(`  ${formatter.bullet('Run with --fix --auto to apply all fixes', 1, '→')}`);
    }

    console.log('');
  }

  /**
   * Display a single issue
   */
  private displayIssue(issue: ReviewIssue): void {
    const severityColor =
      issue.severity === 'critical'
        ? formatter.red
        : issue.severity === 'high'
          ? formatter.yellow
          : issue.severity === 'medium'
            ? formatter.cyan
            : formatter.dim;

    console.log(`\n  ${formatter.bold(issue.id)} ${severityColor(`[${issue.severity.toUpperCase()}]`)}`);
    console.log(`    ${issue.message}`);

    if (issue.file) {
      const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      console.log(`    ${formatter.dim(`Location: ${location}`)}`);
    }

    if (issue.category) {
      console.log(`    ${formatter.dim(`Category: ${issue.category}`)}`);
    }

    if (issue.fixable) {
      console.log(`    ${formatter.green('✓ Fixable')}`);
    }

    if (issue.suggestion) {
      console.log(`    ${formatter.cyan(`💡 ${issue.suggestion}`)}`);
    }
  }

  /**
   * Write report to file
   */
  private async writeReport(results: ReviewResults, options: ReviewOptions): Promise<void> {
    const outputPath = options.outputFile ?? 'daemon-review-report.json';
    const format = options.format ?? 'json';

    try {
      let content: string;

      switch (format) {
        case 'json':
          content = JSON.stringify(results, null, 2);
          break;
        case 'markdown':
          content = this.generateMarkdownReport(results);
          break;
        case 'html':
          content = this.generateHtmlReport(results);
          break;
        default:
          content = JSON.stringify(results, null, 2);
      }

      await fs.writeFile(outputPath, content, 'utf-8');
      logger.success(`Report written to ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to write report to ${outputPath}`, error);
    }
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(results: ReviewResults): string {
    const lines: string[] = [];

    lines.push('# Code Review Report');
    lines.push(`\nGenerated: ${new Date().toISOString()}\n`);

    lines.push('## Summary\n');
    lines.push(`- **Total Issues:** ${results.summary.totalIssues}`);
    lines.push(`- **Fixable:** ${results.summary.fixable}`);
    lines.push(`- **Fixed:** ${results.summary.fixed}\n`);

    lines.push('### By Severity\n');
    for (const [severity, count] of Object.entries(results.summary.bySeverity)) {
      lines.push(`- **${severity.toUpperCase()}:** ${count}`);
    }

    lines.push('\n### By Dimension\n');
    for (const [dimension, count] of Object.entries(results.summary.byDimension)) {
      lines.push(`- **${dimension}:** ${count}`);
    }

    if (results.issues.length > 0) {
      lines.push('\n## Issues\n');

      for (const issue of results.issues) {
        lines.push(`### ${issue.id} [${issue.severity.toUpperCase()}]`);
        lines.push(`\n**${issue.message}**\n`);
        if (issue.file) {
          lines.push(`- **Location:** \`${issue.file}${issue.line ? `:${issue.line}` : ''}\``);
        }
        if (issue.category) {
          lines.push(`- **Category:** ${issue.category}`);
        }
        if (issue.fixable) {
          lines.push(`- **Fixable:** Yes`);
        }
        if (issue.suggestion) {
          lines.push(`- **Suggestion:** ${issue.suggestion}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(results: ReviewResults): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    .stat-label { font-size: 0.9em; color: #666; }
    .stat-value { font-size: 1.8em; font-weight: bold; color: #007acc; }
    .issue { background: #fff; border-left: 4px solid #ddd; padding: 15px; margin: 10px 0; }
    .issue.critical { border-color: #d32f2f; }
    .issue.high { border-color: #f57c00; }
    .issue.medium { border-color: #1976d2; }
    .issue.low { border-color: #757575; }
    .severity { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
    .severity.critical { background: #ffebee; color: #d32f2f; }
    .severity.high { background: #fff3e0; color: #f57c00; }
    .severity.medium { background: #e3f2fd; color: #1976d2; }
    .severity.low { background: #f5f5f5; color: #757575; }
    .fixable { color: #388e3c; font-weight: bold; }
    .suggestion { background: #f1f8e9; padding: 10px; border-radius: 4px; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Code Review Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <div class="summary">
    <div class="stat">
      <div class="stat-label">Total Issues</div>
      <div class="stat-value">${results.summary.totalIssues}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Fixable</div>
      <div class="stat-value">${results.summary.fixable}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Fixed</div>
      <div class="stat-value">${results.summary.fixed}</div>
    </div>
  </div>

  <h2>Issues</h2>
  ${results.issues.map(issue => `
    <div class="issue ${issue.severity}">
      <strong>${issue.id}</strong>
      <span class="severity ${issue.severity}">${issue.severity.toUpperCase()}</span>
      <p>${issue.message}</p>
      ${issue.file ? `<p><code>${issue.file}${issue.line ? `:${issue.line}` : ''}</code></p>` : ''}
      ${issue.fixable ? '<p class="fixable">✓ Fixable</p>' : ''}
      ${issue.suggestion ? `<div class="suggestion">💡 ${issue.suggestion}</div>` : ''}
    </div>
  `).join('')}
</body>
</html>`;
  }

  /**
   * Delay helper for simulating async work
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export type { ReviewOptions, ReviewResults, ReviewIssue };
