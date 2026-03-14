/**
 * Report Command
 *
 * Generates reports in various formats (HTML, Markdown, JSON, JUnit).
 *
 * @module cli/commands/report
 */

import { createLogger } from '../../shared/utils/logger.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { ReportOptions } from './command.types.js';
import { formatter } from '../utils/output.js';
import { withProgress, type ProgressManager } from '../utils/progress.js';

const logger = createLogger('ReportCommand');

/**
 * Mock ReportService integration
 * TODO: Replace with actual import when service is fully integrated
 * import { ReportService } from '../../services/reporting/report.service.js';
 */

/**
 * Report format types
 */
type ReportFormat = 'html' | 'markdown' | 'json' | 'junit' | 'text';

/**
 * Report generation result
 */
interface ReportResult {
  format: ReportFormat | undefined;
  outputPath?: string;
  content?: string;
  stats: {
    overallScore: number;
    dimensions: Record<string, number>;
    issueCount: number;
    criticalCount: number;
  };
  generatedAt: Date;
}

/**
 * Report command for Daemon
 *
 * Generates quality reports in multiple formats:
 * - HTML: Interactive dashboard with charts
 * - Markdown: Documentation-friendly format
 * - JSON: Machine-readable for CI/CD
 * - JUnit: Test result integration
 * - Text: Console output
 */
export class ReportCommand {
  /**
   * Execute the report command
   */
  async execute(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    try {
      if (options.verbose) {
        logger.debug('Generating report...', { options });
      }

      const result = await withProgress(
        async (progress) => {
          progress.report(10, 'Loading project data...');
          return await this.generateReport(options, progress);
        },
        {
          onStart: (msg) => logger.info(msg),
          onComplete: (msg) => logger.success(msg),
          onError: (err) => logger.error('Report generation failed', err),
        }
      );

      // Output results
      if (!options.silent) {
        this.displayResults(result, options);
      }

      // Write to file if output specified
      if (options.output) {
        await this.writeReport(result, options);
      }
    } catch (error) {
      logger.error('Report command failed', error);
      throw error;
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): ReportOptions {
    const options: ReportOptions = {
      verbose: false,
      silent: false,
      format: 'text',
      output: undefined,
      includeTrend: false,
      includeCharts: true,
      theme: 'auto',
      open: false,
    };

    for (const arg of args) {
      switch (arg) {
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--silent':
        case '-s':
          options.silent = true;
          break;
        case '--trend':
        case '-t':
          options.includeTrend = true;
          break;
        case '--no-charts':
          options.includeCharts = false;
          break;
        case '--open':
        case '-o':
          options.open = true;
          break;
        default:
          if (arg.startsWith('--format=')) {
            const value = arg.split('=')[1];
            if (value && ['html', 'markdown', 'json', 'junit', 'text'].includes(value)) {
              options.format = value as ReportFormat;
            }
          } else if (arg.startsWith('--output=')) {
            const value = arg.split('=')[1];
            if (value) {
              options.output = value;
            }
          } else if (arg.startsWith('--theme=')) {
            const value = arg.split('=')[1];
            if (value && ['light', 'dark', 'auto'].includes(value)) {
              options.theme = value as 'light' | 'dark' | 'auto';
            }
          } else if (arg.startsWith('-o')) {
            // Short form for output (single char)
            const value = arg.slice(2);
            if (value) {
              options.output = value;
            }
          } else if (arg.startsWith('-f')) {
            // Short form for format (single char)
            const value = arg.slice(2);
            if (value && ['html', 'markdown', 'json', 'junit', 'text'].includes(value)) {
              options.format = value as ReportFormat;
            }
          }
      }
    }

    return options;
  }

  /**
   * Generate the report
   */
  private async generateReport(options: ReportOptions, progress: ProgressManager): Promise<ReportResult> {
    const projectDir = process.cwd();

    progress.report(20, 'Analyzing project...');
    await this.delay(300);

    progress.report(40, 'Calculating scores...');
    await this.delay(500);

    if (options.includeTrend) {
      progress.report(60, 'Loading historical data...');
      await this.delay(300);
    }

    progress.report(80, `Generating ${options.format} report...`);
    await this.delay(400);

    // Mock score data - replace with actual ReportService call
    const stats = {
      overallScore: 76,
      dimensions: {
        'test-coverage': 82,
        'code-complexity': 71,
        'code-style': 88,
        'documentation': 65,
        'security': 91,
        'performance': 68,
      },
      issueCount: 24,
      criticalCount: 2,
    };

    let content: string | undefined;
    let outputPath: string | undefined;

    // Generate content based on format
    switch (options.format) {
      case 'html':
        content = this.generateHtmlReport(stats, options);
        outputPath = options.output || 'daemon-report.html';
        break;
      case 'markdown':
        content = this.generateMarkdownReport(stats, options);
        outputPath = options.output || 'DAEMON_REPORT.md';
        break;
      case 'json':
        content = this.generateJsonReport(stats);
        outputPath = options.output || 'daemon-report.json';
        break;
      case 'junit':
        content = this.generateJUnitReport(stats);
        outputPath = options.output || 'daemon-junit.xml';
        break;
      case 'text':
        content = undefined; // Text uses console output
        break;
    }

    progress.report(100, 'Report generated');

    return {
      format: options.format,
      outputPath,
      content,
      stats,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(stats: ReportResult['stats'], options: ReportOptions): string {
    const theme = options.theme === 'auto' ? 'auto' : options.theme;
    const now = new Date().toISOString();

    return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daemon Code Quality Report</title>
  <style>
    :root {
      --color-primary: #3b82f6;
      --color-success: #10b981;
      --color-warning: #f59e0b;
      --color-error: #ef4444;
      --color-bg: #ffffff;
      --color-surface: #f9fafb;
      --color-text: #1f2937;
      --color-border: #e5e7eb;
    }
    [data-theme="dark"] {
      --color-primary: #60a5fa;
      --color-success: #34d399;
      --color-warning: #fbbf24;
      --color-error: #f87171;
      --color-bg: #111827;
      --color-surface: #1f2937;
      --color-text: #f9fafb;
      --color-border: #374151;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--color-bg); color: var(--color-text); line-height: 1.6; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
    .header h1 { font-size: 28px; font-weight: 700; }
    .score-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 24px; }
    .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 24px; }
    .score-card { text-align: center; }
    .score-value { font-size: 64px; font-weight: 800; }
    .score-value.excellent { color: var(--color-success); }
    .score-value.good { color: var(--color-primary); }
    .score-value.fair { color: var(--color-warning); }
    .score-value.poor { color: var(--color-error); }
    .dimension-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .dimension-card { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; text-align: center; }
    .dimension-score { font-size: 32px; font-weight: 700; margin: 8px 0; }
    .dimension-bar { height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden; }
    .dimension-bar-fill { height: 100%; transition: width 0.3s; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Code Quality Report</h1>
      <span style="color: var(--color-text-muted);">${now}</span>
    </div>

    <div class="score-section">
      <div class="card score-card">
        <div class="score-label">Overall Score</div>
        <div class="score-value ${this.getScoreClass(stats.overallScore)}">${stats.overallScore}</div>
        <div class="score-status">${this.getScoreStatus(stats.overallScore)}</div>
      </div>

      <div class="card">
        <h3>Statistics</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 16px;">
          <div style="text-align: center;">
            <div style="font-size: 32px; font-weight: 700; color: var(--color-text);">${stats.issueCount}</div>
            <div style="font-size: 12px; color: var(--color-text-muted);">Total Issues</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 32px; font-weight: 700; color: var(--color-error);">${stats.criticalCount}</div>
            <div style="font-size: 12px; color: var(--color-text-muted);">Critical</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>📐 Dimensions</h2>
      <div class="dimension-grid">
        ${Object.entries(stats.dimensions).map(([key, value]) => `
          <div class="dimension-card">
            <div style="font-size: 12px; color: var(--color-text-muted);">${key}</div>
            <div class="dimension-score" style="color: ${this.getScoreColor(value)}">${value}</div>
            <div class="dimension-bar">
              <div class="dimension-bar-fill" style="width: ${value}%; background: ${this.getScoreColor(value)}"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <script>
    // Animate scores on load
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.dimension-bar-fill').forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => bar.style.width = width, 100);
      });
    });
  </script>
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(stats: ReportResult['stats'], options: ReportOptions): string {
    const lines: string[] = [];

    lines.push('# 📊 Code Quality Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toLocaleString()}\n`);

    // Overall Score
    lines.push('## 🎯 Overall Score');
    lines.push('');
    lines.push(`### ${this.getScoreEmoji(stats.overallScore)} **${stats.overallScore}/100**`);
    lines.push('');

    // Statistics
    lines.push('## 📈 Statistics');
    lines.push('');
    lines.push(`- **Total Issues:** ${stats.issueCount}`);
    lines.push(`- **Critical Issues:** ${stats.criticalCount}`);
    lines.push('');

    // Dimensions
    lines.push('## 📐 Dimensions');
    lines.push('');
    lines.push('| Dimension | Score | Status |');
    lines.push('|-----------|-------|--------|');

    for (const [key, value] of Object.entries(stats.dimensions)) {
      const status = this.getScoreStatus(value);
      const emoji = this.getStatusEmoji(status);
      lines.push(`| ${key} | **${value}**/100 | ${emoji} ${status} |`);
    }
    lines.push('');

    // Recommendations
    lines.push('## 💡 Recommendations');
    lines.push('');
    const recommendations = this.getRecommendations(stats);
    for (const rec of recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate JSON report
   */
  private generateJsonReport(stats: ReportResult['stats']): string {
    return JSON.stringify({
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      summary: {
        overall: stats.overallScore,
        status: this.getScoreStatus(stats.overallScore),
        totalIssues: stats.issueCount,
        criticalIssues: stats.criticalCount,
      },
      dimensions: stats.dimensions,
      metrics: {
        bySeverity: {
          critical: stats.criticalCount,
          high: Math.floor(stats.issueCount * 0.3),
          medium: Math.floor(stats.issueCount * 0.4),
          low: Math.floor(stats.issueCount * 0.3) - stats.criticalCount,
        },
      },
    }, null, 2);
  }

  /**
   * Generate JUnit XML report
   */
  private generateJUnitReport(stats: ReportResult['stats']): string {
    const now = new Date();
    const timestamp = now.toISOString();
    const time = (stats.issueCount * 0.1).toFixed(3);

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Daemon" tests="6" failures="${stats.criticalCount}" errors="${Math.floor(stats.issueCount * 0.2)}" skipped="0" time="${time}">
  <testsuite name="Code Quality" id="0" tests="6" failures="${stats.criticalCount}" errors="${Math.floor(stats.issueCount * 0.2)}" skipped="0" time="${time}" timestamp="${timestamp}">
    ${Object.entries(stats.dimensions).map(([key, value], i) => {
      const failed = value < 70 ? 'failure' : '';
      return `    <testcase name="${key}" classname="Daemon.Quality" time="${(value * 0.01).toFixed(3)}">
      ${failed ? `<failure message="Score below threshold (70)">Dimension ${key} scored ${value}/100</failure>` : ''}
    </testcase>`;
    }).join('\n    ')}
  </testsuite>
</testsuites>`;
  }

  /**
   * Display formatted results
   */
  private displayResults(result: ReportResult, options: ReportOptions): void {
    console.log('');
    console.log(formatter.header('Code Quality Report', 1));

    // Overall score
    const overallColor = result.stats.overallScore >= 90 ? 'green' : result.stats.overallScore >= 75 ? 'cyan' : result.stats.overallScore >= 60 ? 'yellow' : 'red';
    console.log(`\n${formatter.bold('Overall Score:')} ${formatter.color(`${result.stats.overallScore}/100`, overallColor)} ${formatter.dim(`(${this.getScoreStatus(result.stats.overallScore)})`)}`);
    console.log(formatter.divider('·', 40));

    // Dimensions
    console.log(formatter.bold('\nDimensions:'));
    for (const [key, value] of Object.entries(result.stats.dimensions)) {
      const color = value >= 80 ? 'green' : value >= 60 ? 'yellow' : 'red';
      const bar = '█'.repeat(Math.floor(value / 10)) + '░'.repeat(10 - Math.floor(value / 10));
      console.log(`  ${formatter.key(key.padEnd(20))} ${formatter.color(`${value}`.padStart(3), color)} ${formatter.dim(bar)}`);
    }

    // Statistics
    console.log(formatter.bold('\nStatistics:'));
    console.log(`  ${formatter.key('Total Issues:')} ${result.stats.issueCount}`);
    console.log(`  ${formatter.key('Critical:')} ${formatter.red(String(result.stats.criticalCount))}`);

    // Output info
    if (result.outputPath) {
      console.log(`\n${formatter.dim('Report saved to:')} ${formatter.color(result.outputPath, 'cyan')}`);
    }

    console.log('');
  }

  /**
   * Write report to file
   */
  private async writeReport(result: ReportResult, options: ReportOptions): Promise<void> {
    if (!result.content) {
      logger.warn('No content to write (text format uses console output)');
      return;
    }

    const outputPath = result.outputPath || `daemon-report.${options.format}`;
    const fullPath = join(process.cwd(), outputPath);

    try {
      await fs.writeFile(fullPath, result.content, 'utf-8');
      logger.success(`Report saved to ${fullPath}`);

      // Open in browser if requested
      if (options.open && options.format === 'html') {
        const { exec } = await import('node:child_process');
        const platform = process.platform;

        if (platform === 'darwin') {
          exec(`open ${fullPath}`);
        } else if (platform === 'win32') {
          exec(`start ${fullPath}`);
        } else {
          exec(`xdg-open ${fullPath}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to write report to ${fullPath}`, error);
    }
  }

  /**
   * Get recommendations based on stats
   */
  private getRecommendations(stats: ReportResult['stats']): string[] {
    const recommendations: string[] = [];

    for (const [key, value] of Object.entries(stats.dimensions)) {
      if (value < 60) {
        recommendations.push(`🔴 Focus on **${key}** - Score is ${value}/100`);
      } else if (value < 80) {
        recommendations.push(`🟡 Improve **${key}** - Score is ${value}/100`);
      }
    }

    if (stats.criticalCount > 0) {
      recommendations.push(`⚠️ Address ${stats.criticalCount} critical issue(s) immediately`);
    }

    if (stats.overallScore >= 80) {
      recommendations.push('✅ Great job maintaining high code quality!');
    }

    return recommendations;
  }

  /**
   * Get CSS class for score
   */
  private getScoreClass(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  /**
   * Get status text for score
   */
  private getScoreStatus(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  /**
   * Get emoji for score
   */
  private getScoreEmoji(score: number): string {
    if (score >= 90) return '🌟';
    if (score >= 75) return '👍';
    if (score >= 60) return '😐';
    return '👎';
  }

  /**
   * Get emoji for status
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      excellent: '✅',
      good: '👍',
      fair: '😐',
      poor: '👎',
      critical: '⚠️',
    };
    return emojis[status] || '❓';
  }

  /**
   * Get color for score value
   */
  private getScoreColor(score: number): string {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#3b82f6';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export type { ReportOptions, ReportFormat, ReportResult };
