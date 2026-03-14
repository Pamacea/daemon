/**
 * Report Service
 *
 * Main service for generating reports in various formats.
 */

import type {
  Report,
  ReportFormat,
  ExtendedProjectScore,
  ReportOptions,
  TrendAnalysis,
  TestResultForReport,
} from './reporting.types.js';
import { HtmlTemplate } from './templates/html.template.js';
import { MarkdownTemplate } from './templates/markdown.template.js';
import { JsonTemplate } from './templates/json.template.js';
import { HistoryService } from './history.service.js';
import { ChartExporter } from './export/chart.exporter.js';

/**
 * Report service for generating code quality reports
 */
export class ReportService {
  private historyService: HistoryService;

  constructor() {
    this.historyService = new HistoryService();
  }

  /**
   * Generate a report in the specified format
   *
   * @param score - Project score to report
   * @param format - Report format
   * @param options - Report generation options
   * @returns Generated report
   */
  async generateReport(
    score: ExtendedProjectScore,
    format: ReportFormat,
    options: ReportOptions = {}
  ): Promise<Report> {
    const trend = options.includeTrend
      ? await this.historyService.getFullAnalysis(score.projectPath)
      : undefined;

    let content: string;

    switch (format) {
      case 'html':
        content = await this.generateHtmlReport(score, trend, options);
        break;
      case 'markdown':
        content = await this.generateMarkdownReport(score, trend);
        break;
      case 'json':
        content = await this.generateJsonReport(score, trend);
        break;
      case 'junit':
        content = await this.generateJUnitReport(score.issues.map(i => ({
          name: i.message,
          file: i.file || 'unknown',
          status: i.severity === 'critical' || i.severity === 'high' ? 'failed' : 'passed',
          duration: 0,
        } as TestResultForReport)));
        break;
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }

    return {
      format,
      content,
      timestamp: new Date(),
      projectPath: score.projectPath,
      score,
      trend,
    };
  }

  /**
   * Generate an HTML report
   *
   * @param score - Project score to report
   * @param trend - Optional trend analysis
   * @param options - Report options
   * @returns HTML string
   */
  async generateHtmlReport(
    score: ExtendedProjectScore,
    trend?: TrendAnalysis,
    options: ReportOptions = {}
  ): Promise<string> {
    const theme = options.theme ?? 'auto';
    return HtmlTemplate.generate(score, trend, theme);
  }

  /**
   * Generate a Markdown report
   *
   * @param score - Project score to report
   * @param trend - Optional trend analysis
   * @returns Markdown string
   */
  async generateMarkdownReport(
    score: ExtendedProjectScore,
    trend?: TrendAnalysis
  ): Promise<string> {
    return MarkdownTemplate.generate(score, trend);
  }

  /**
   * Generate a JSON report
   *
   * @param score - Project score to report
   * @param trend - Optional trend analysis
   * @returns JSON string
   */
  async generateJsonReport(
    score: ExtendedProjectScore,
    trend?: TrendAnalysis
  ): Promise<string> {
    return JsonTemplate.generate(score, trend);
  }

  /**
   * Generate a JUnit XML report
   *
   * @param results - Test results to convert
   * @returns JUnit XML string
   */
  async generateJUnitReport(results: TestResultForReport[]): Promise<string> {
    const now = new Date();
    const total = results.length;
    const failures = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'timed-out').length;

    // Group by file (test suite)
    const suites = new Map<string, TestResultForReport[]>();
    for (const result of results) {
      const file = result.file || 'default';
      if (!suites.has(file)) {
        suites.set(file, []);
      }
      suites.get(file)!.push(result);
    }

    const xmlLines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuites name="Daemon" tests="${total}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${results.reduce((sum, r) => sum + r.duration, 0) / 1000}">`,
    ];

    // Add timezone attribute
    xmlLines.push(`  <testsuite name="Daemon" id="0" tests="${total}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${results.reduce((sum, r) => sum + r.duration, 0) / 1000}" timestamp="${now.toISOString()}">`);

    // Generate test cases
    for (const result of results) {
      const testCase = this.generateJUnitTestCase(result);
      xmlLines.push(`    ${testCase}`);
    }

    xmlLines.push('  </testsuite>');
    xmlLines.push('</testsuites>');

    return xmlLines.join('\n');
  }

  /**
   * Generate a summary report (compact format)
   *
   * @param score - Project score to summarize
   * @returns Summary string
   */
  async generateSummary(score: ExtendedProjectScore): Promise<string> {
    return MarkdownTemplate.generateSummary(score);
  }

  /**
   * Save report to file
   *
   * @param report - Report to save
   * @param outputPath - File path to save to
   * @returns Promise resolving when saved
   */
  async saveReport(report: Report, outputPath: string): Promise<void> {
    const { promises: fs } = await import('fs');
    const { dirname } = await import('path');

    // Ensure directory exists
    await fs.mkdir(dirname(outputPath), { recursive: true });

    // Write report
    await fs.writeFile(outputPath, report.content, 'utf-8');
  }

  /**
   * Generate report with automatic file naming
   *
   * @param score - Project score to report
   * @param format - Report format
   * @param outputDir - Output directory
   * @param options - Report options
   * @returns Path to generated report
   */
  async generateReportToFile(
    score: ExtendedProjectScore,
    format: ReportFormat,
    outputDir: string,
    options: ReportOptions = {}
  ): Promise<string> {
    const report = await this.generateReport(score, format, options);

    const extension = this.getFileExtension(format);
    const timestamp = score.timestamp.toISOString().replace(/[:.]/g, '-');
    const filename = options.title
      ? `${options.title.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.${extension}`
      : `daemon-report-${timestamp}.${extension}`;

    const outputPath = `${outputDir}/${filename}`;
    await this.saveReport(report, outputPath);

    return outputPath;
  }

  /**
   * Generate multiple formats at once
   *
   * @param score - Project score to report
   * @param formats - Array of formats to generate
   * @param outputDir - Output directory
   * @param options - Report options
   * @returns Map of format to file path
   */
  async generateMultipleReports(
    score: ExtendedProjectScore,
    formats: ReportFormat[],
    outputDir: string,
    options: ReportOptions = {}
  ): Promise<Map<ReportFormat, string>> {
    const results = new Map<ReportFormat, string>();

    for (const format of formats) {
      try {
        const path = await this.generateReportToFile(score, format, outputDir, options);
        results.set(format, path);
      } catch (error) {
        console.error(`Failed to generate ${format} report:`, error);
      }
    }

    return results;
  }

  /**
   * Get file extension for format
   */
  private getFileExtension(format: ReportFormat): string {
    const extensions: Record<ReportFormat, string> = {
      html: 'html',
      markdown: 'md',
      json: 'json',
      junit: 'xml',
    };
    return extensions[format];
  }

  /**
   * Generate JUnit XML for a single test case
   */
  private generateJUnitTestCase(result: TestResultForReport): string {
    const escapedName = this.escapeXml(result.name);
    const className = result.file ? this.escapeXml(result.file) : 'Daemon.Test';

    let testCase = `<testcase name="${escapedName}" classname="${className}" time="${result.duration / 1000}">`;

    if (result.status === 'failed' || result.status === 'timed-out') {
      const errorType = result.status === 'timed-out' ? 'error' : 'failure';
      const message = this.escapeXml(result.error || result.name || 'Test failed');
      const text = this.escapeXml(result.stack || result.error || result.name || '');

      testCase += `\n      <${errorType} message="${message}">`;
      testCase += `\n        <![CDATA[${text}]]>`;
      testCase += `\n      </${errorType}>`;
    } else if (result.status === 'skipped') {
      testCase += `\n      <skipped/>`;
    }

    testCase += '\n    </testcase>';

    return testCase;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
