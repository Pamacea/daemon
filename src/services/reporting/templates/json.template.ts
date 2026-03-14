/**
 * JSON Report Template
 *
 * Generates JSON format reports for CI/CD integration.
 */

import type { ExtendedProjectScore, TrendAnalysis, ReportIssue } from '../reporting.types.js';

/**
 * JSON report template generator
 */
export class JsonTemplate {
  /**
   * Generate a JSON report
   *
   * @param score - Project score to report
   * @param trend - Optional trend analysis
   * @returns JSON string
   */
  static generate(score: ExtendedProjectScore, trend?: TrendAnalysis): string {
    const report = {
      metadata: {
        version: '1.0.0',
        generatedAt: score.timestamp.toISOString(),
        projectPath: score.projectPath,
        commit: score.commit,
        branch: score.branch,
      },
      summary: {
        overall: score.overall,
        status: this.getStatus(score.overall),
        totalIssues: score.issues.length,
        criticalIssues: score.issues.filter(i => i.severity === 'critical').length,
        highIssues: score.issues.filter(i => i.severity === 'high').length,
      },
      dimensions: this.generateDimensionsJson(score),
      issues: this.generateIssuesJson(score.issues),
      trend: trend ? this.generateTrendJson(trend) : undefined,
      metrics: this.generateMetrics(score),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate a compact JSON report (single line)
   *
   * @param score - Project score to report
   * @returns Compact JSON string
   */
  static generateCompact(score: ExtendedProjectScore): string {
    const compact = {
      v: 1,
      ts: score.timestamp.getTime(),
      score: score.overall,
      issues: {
        total: score.issues.length,
        critical: score.issues.filter(i => i.severity === 'critical').length,
        high: score.issues.filter(i => i.severity === 'high').length,
      },
    };

    return JSON.stringify(compact);
  }

  /**
   * Generate metrics-only JSON for monitoring
   *
   * @param score - Project score to report
   * @returns Metrics JSON string
   */
  static generateMetricsJson(score: ExtendedProjectScore): string {
    const metrics = {
      timestamp: score.timestamp.toISOString(),
      gauge: {
        name: 'daemon_code_quality',
        value: score.overall,
        labels: {
          project: this.extractProjectName(score.projectPath),
          branch: score.branch || 'unknown',
        },
      },
      dimensions: Object.entries(score.dimensions).map(([key, dim]) => ({
        name: 'daemon_dimension_score',
        value: dim.score,
        labels: {
          project: this.extractProjectName(score.projectPath),
          dimension: key,
        },
      })),
      issues: {
        name: 'daemon_issue_count',
        value: score.issues.length,
        labels: {
          project: this.extractProjectName(score.projectPath),
        },
      },
    };

    return JSON.stringify(metrics);
  }

  /**
   * Generate SARIF-compatible JSON for static analysis tools
   *
   * @param score - Project score to report
   * @returns SARIF JSON string
   */
  static generateSarif(score: ExtendedProjectScore): string {
    const sarif = {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'Daemon',
              version: '0.7.0',
              informationUri: 'https://github.com/Pamacea/daemon',
              rules: this.extractRules(score.issues),
            },
          },
          results: this.generateSarifResults(score.issues),
          properties: {
            overallScore: score.overall,
            dimensions: Object.fromEntries(
              Object.entries(score.dimensions).map(([key, dim]) => [key, dim.score])
            ),
          },
        },
      ],
    };

    return JSON.stringify(sarif, null, 2);
  }

  /**
   * Generate dimensions JSON
   */
  private static generateDimensionsJson(score: ExtendedProjectScore) {
    const dimensions: Record<string, unknown> = {};

    for (const [key, dimension] of Object.entries(score.dimensions)) {
      dimensions[key] = {
        score: dimension.score,
        weight: dimension.weight,
        status: dimension.status,
        issueCount: dimension.issues.length,
        issues: dimension.issues.map(i => ({
          severity: i.severity,
          category: i.category,
          message: i.message,
          file: i.file,
          line: i.line,
        })),
      };
    }

    return dimensions;
  }

  /**
   * Generate issues JSON
   */
  private static generateIssuesJson(issues: ReportIssue[]) {
    return issues.map(issue => ({
      severity: issue.severity,
      category: issue.category,
      message: issue.message,
      file: issue.file,
      line: issue.line,
      rule: issue.rule,
      suggestion: issue.suggestion,
    }));
  }

  /**
   * Generate trend JSON
   */
  private static generateTrendJson(trend: TrendAnalysis) {
    return {
      overall: {
        current: trend.overallTrend.current,
        previous: trend.overallTrend.previous,
        delta: trend.overallTrend.delta,
        direction: trend.overallTrend.trend,
      },
      velocity: trend.velocity,
      regressions: trend.regressions.map(r => ({
        dimension: r.dimension,
        drop: r.drop,
        severity: r.severity,
      })),
      improvements: trend.improvements.map(i => ({
        dimension: i.dimension,
        increase: i.increase,
      })),
      period: {
        start: trend.period.start.toISOString(),
        end: trend.period.end.toISOString(),
        snapshots: trend.period.snapshotCount,
      },
    };
  }

  /**
   * Generate metrics object
   */
  private static generateMetrics(score: ExtendedProjectScore) {
    return {
      overall: score.overall,
      dimensions: Object.fromEntries(
        Object.entries(score.dimensions).map(([key, dim]) => [key, dim.score])
      ),
      issues: {
        total: score.issues.length,
        bySeverity: this.groupIssuesBySeverity(score.issues),
        byCategory: this.groupIssuesByCategory(score.issues),
      },
    };
  }

  /**
   * Group issues by severity
   */
  private static groupIssuesBySeverity(issues: ReportIssue[]) {
    const grouped: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const issue of issues) {
      const severity = issue.severity.toLowerCase();
      if (grouped[severity] !== undefined) {
        grouped[severity]++;
      }
    }

    return grouped;
  }

  /**
   * Group issues by category
   */
  private static groupIssuesByCategory(issues: ReportIssue[]) {
    const grouped: Record<string, number> = {};

    for (const issue of issues) {
      const category = issue.category || 'uncategorized';
      grouped[category] = (grouped[category] || 0) + 1;
    }

    return grouped;
  }

  /**
   * Extract rules from issues for SARIF
   */
  private static extractRules(issues: ReportIssue[]) {
    const ruleMap = new Map<string, { id: string; name: string; shortDescription: { text: string } }>();

    for (const issue of issues) {
      const ruleId = issue.rule || issue.category || 'general';
      if (!ruleMap.has(ruleId)) {
        ruleMap.set(ruleId, {
          id: ruleId,
          name: issue.category || 'General',
          shortDescription: { text: issue.message.split('.')[0] },
        });
      }
    }

    return Array.from(ruleMap.values());
  }

  /**
   * Generate SARIF results
   */
  private static generateSarifResults(issues: ReportIssue[]) {
    return issues.map((issue, index) => ({
      ruleId: issue.rule || issue.category || 'general',
      level: this.getSarifLevel(issue.severity),
      message: { text: issue.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: issue.file || 'unknown',
            },
            region: issue.line
              ? {
                  startLine: issue.line,
                }
              : undefined,
          },
        },
      ],
    }));
  }

  /**
   * Map severity to SARIF level
   */
  private static getSarifLevel(severity: string): string {
    const levelMap: Record<string, string> = {
      critical: 'error',
      high: 'error',
      medium: 'warning',
      low: 'note',
      info: 'note',
    };

    return levelMap[severity.toLowerCase()] || 'warning';
  }

  /**
   * Get status from score
   */
  private static getStatus(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'critical';
  }

  /**
   * Extract project name from path
   */
  private static extractProjectName(path: string): string {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || 'unknown';
  }
}
