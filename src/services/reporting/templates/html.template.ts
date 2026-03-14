/**
 * HTML Report Template
 *
 * Generates modern, responsive HTML reports with interactive charts.
 */

import type { ExtendedProjectScore, TrendAnalysis, ReportIssue } from '../reporting.types.js';
import { ChartExporter } from '../export/chart.exporter.js';

/**
 * HTML report template generator
 */
export class HtmlTemplate {
  /**
   * Generate a complete HTML report
   *
   * @param score - Project score to report
   * @param trend - Optional trend analysis
   * @param theme - Color theme (light, dark, or auto)
   * @returns HTML string
   */
  static generate(score: ExtendedProjectScore, trend?: TrendAnalysis, theme: 'light' | 'dark' | 'auto' = 'auto'): string {
    const isDark = theme === 'dark' || (theme === 'auto' && this.shouldUseDarkMode());
    const colors = isDark ? this.getDarkColors() : this.getLightColors();

    return `<!DOCTYPE html>
<html lang="en" data-theme="${isDark ? 'dark' : 'light'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daemon Code Quality Report</title>
  <style>
    ${this.generateStyles(colors)}
  </style>
</head>
<body>
  <div class="container">
    ${this.generateHeader(score, colors)}

    <main>
      ${this.generateScoreCard(score, colors)}

      ${this.generateDimensionsSection(score, colors)}

      ${trend ? this.generateTrendSection(trend, score, colors) : ''}

      ${this.generateIssuesSection(score, colors)}

      ${this.generateRecommendationsSection(score, colors)}
    </main>

    ${this.generateFooter()}
  </div>

  <script>
    ${this.generateScripts()}
  </script>
</body>
</html>`;
  }

  /**
   * Generate CSS styles for the report
   */
  private static generateStyles(colors: Record<string, string>): string {
    return `:root {
      --color-primary: ${colors.primary};
      --color-secondary: ${colors.secondary};
      --color-success: ${colors.success};
      --color-warning: ${colors.warning};
      --color-error: ${colors.error};
      --color-background: ${colors.background};
      --color-surface: ${colors.surface};
      --color-border: ${colors.border};
      --color-text: ${colors.text};
      --color-text-muted: ${colors.textMuted};
      --shadow: ${colors.shadow};
      --radius: 12px;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--color-background);
      color: var(--color-text);
      line-height: 1.6;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: var(--color-text);
    }

    .header .meta {
      display: flex;
      gap: 24px;
      font-size: 14px;
      color: var(--color-text-muted);
    }

    .header .meta span {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Cards */
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow);
    }

    .card h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--color-text);
    }

    .card h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--color-text);
    }

    /* Score Section */
    .score-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
    }

    .score-card {
      text-align: center;
    }

    .score-value {
      font-size: 64px;
      font-weight: 800;
      line-height: 1;
      margin: 16px 0;
    }

    .score-value.excellent { color: var(--color-success); }
    .score-value.good { color: var(--color-primary); }
    .score-value.fair { color: var(--color-warning); }
    .score-value.poor { color: var(--color-error); }
    .score-value.critical { color: var(--color-error); }

    .score-label {
      font-size: 14px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .score-status {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 8px;
    }

    .score-status.excellent { background: var(--color-success); color: white; }
    .score-status.good { background: var(--color-primary); color: white; }
    .score-status.fair { background: var(--color-warning); color: white; }
    .score-status.poor { background: var(--color-error); color: white; }
    .score-status.critical { background: var(--color-error); color: white; }

    /* Dimensions Grid */
    .dimensions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .dimension-card {
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .dimension-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }

    .dimension-name {
      font-size: 14px;
      color: var(--color-text-muted);
      margin-bottom: 8px;
    }

    .dimension-score {
      font-size: 32px;
      font-weight: 700;
    }

    .dimension-bar {
      height: 8px;
      background: var(--color-border);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 12px;
    }

    .dimension-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    /* Issues List */
    .issues-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .issue-item {
      display: flex;
      gap: 16px;
      padding: 16px;
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      border-left: 4px solid;
    }

    .issue-item.severity-critical { border-left-color: var(--color-error); }
    .issue-item.severity-high { border-left-color: #f97316; }
    .issue-item.severity-medium { border-left-color: var(--color-warning); }
    .issue-item.severity-low { border-left-color: var(--color-primary); }
    .issue-item.severity-info { border-left-color: #6b7280; }

    .issue-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .issue-badge.critical { background: var(--color-error); color: white; }
    .issue-badge.high { background: #f97316; color: white; }
    .issue-badge.medium { background: var(--color-warning); color: white; }
    .issue-badge.low { background: var(--color-primary); color: white; }
    .issue-badge.info { background: #6b7280; color: white; }

    .issue-content {
      flex: 1;
    }

    .issue-message {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .issue-location {
      font-size: 12px;
      color: var(--color-text-muted);
      font-family: monospace;
    }

    .issue-suggestion {
      margin-top: 8px;
      padding: 8px 12px;
      background: var(--color-surface);
      border-radius: 6px;
      font-size: 14px;
    }

    /* Recommendations */
    .recommendations-list {
      display: grid;
      gap: 12px;
    }

    .recommendation-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      background: var(--color-background);
      border-radius: 8px;
    }

    .recommendation-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    /* Charts */
    .chart-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
    }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-item {
      text-align: center;
      padding: 16px;
      background: var(--color-background);
      border-radius: 8px;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: var(--color-primary);
    }

    .stat-label {
      font-size: 12px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      margin-top: 4px;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 32px 0;
      color: var(--color-text-muted);
      font-size: 14px;
    }

    .footer a {
      color: var(--color-primary);
      text-decoration: none;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        align-items: flex-start;
      }

      .score-section {
        grid-template-columns: 1fr;
      }

      .dimensions-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 480px) {
      .dimensions-grid {
        grid-template-columns: 1fr;
      }

      .score-value {
        font-size: 48px;
      }
    }`;
  }

  /**
   * Generate header section
   */
  private static generateHeader(score: ExtendedProjectScore, colors: Record<string, string>): string {
    return `<header class="header">
      <div>
        <h1>📊 Code Quality Report</h1>
      </div>
      <div class="meta">
        <span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13z"/>
            <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3.5a.5.5 0 01-.5-.5v-3.5A.5.5 0 018 4z"/>
          </svg>
          ${score.timestamp.toLocaleDateString()} ${score.timestamp.toLocaleTimeString()}
        </span>
        ${score.branch ? `<span>🌿 ${score.branch}</span>` : ''}
        ${score.commit ? `<span>📝 ${score.commit.substring(0, 7)}</span>` : ''}
      </div>
    </header>`;
  }

  /**
   * Generate score card section
   */
  private static generateScoreCard(score: ExtendedProjectScore, colors: Record<string, string>): string {
    const status = this.getScoreStatus(score.overall);
    const gauge = ChartExporter.generateGauge({
      value: score.overall,
      label: 'Overall Score',
      width: 300,
      height: 180,
      backgroundColor: colors.background,
      textColor: colors.text,
    });

    const issueStats = `
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${score.issues.length}</div>
          <div class="stat-label">Total Issues</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: ${colors.error}">${
            score.issues.filter((i: { severity: string }) => i.severity === 'critical').length
          }</div>
          <div class="stat-label">Critical</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: #f97316">${
            score.issues.filter((i: { severity: string }) => i.severity === 'high').length
          }</div>
          <div class="stat-label">High</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: ${colors.success}">${
            Object.values(score.dimensions).filter((d: { score: number }) => d.score >= 70).length
          }/${Object.keys(score.dimensions).length}</div>
          <div class="stat-label">Healthy</div>
        </div>
      </div>
    `;

    return `<section class="score-section">
      <div class="card score-card">
        <h2>Overall Score</h2>
        <div class="chart-container">${gauge}</div>
        <div class="score-status ${status}">${status.toUpperCase()}</div>
      </div>
      <div class="card">
        <h2>Statistics</h2>
        ${issueStats}
      </div>
    </section>`;
  }

  /**
   * Generate dimensions section
   */
  private static generateDimensionsSection(score: ExtendedProjectScore, colors: Record<string, string>): string {
    const dimensionCards = Object.entries(score.dimensions).map(([key, dimension]) => {
      const dim = dimension as { score: number; weight: number };
      const status = this.getScoreStatus(dim.score);
      const color = this.getScoreColor(dim.score, colors);
      const percentage = dim.score;

      return `<div class="dimension-card">
        <div class="dimension-name">${key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
        <div class="dimension-score" style="color: ${color}">${dimension.score}</div>
        <div class="dimension-bar">
          <div class="dimension-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
        </div>
      </div>`;
    }).join('\n');

    return `<section class="card">
      <h2>📐 Dimensions</h2>
      <div class="dimensions-grid">
        ${dimensionCards}
      </div>
    </section>`;
  }

  /**
   * Generate trend section
   */
  private static generateTrendSection(trend: TrendAnalysis, score: ExtendedProjectScore, colors: Record<string, string>): string {
    // Generate trend chart data
    const trendData = trend.overallTrend.history.map((value, i) => ({
      timestamp: trend.overallTrend.timestamps[i] || new Date(),
      value,
    }));

    const trendChart = trendData.length > 1
      ? ChartExporter.generateTrendChart(trendData, {
          width: 800,
          height: 200,
          backgroundColor: colors.surface,
          textColor: colors.text,
        })
      : '<p style="text-align: center; color: var(--color-text-muted);">Insufficient data for trend chart</p>';

    const dimensionBars = Object.entries(trend.dimensionTrends)
      .filter(([_, t]) => t.history.length > 1)
      .map(([key, t]) => {
        const trendIcon = t.trend === 'improving' ? '📈' : t.trend === 'declining' ? '📉' : '➡️';
        const color = t.delta > 0 ? colors.success : t.delta < 0 ? colors.error : colors.textMuted;
        return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid ${colors.border}">
          <span>${key.replace(/-/g, ' ')}</span>
          <span style="color: ${color}">${trendIcon} ${t.delta >= 0 ? '+' : ''}${t.delta}</span>
        </div>`;
      }).join('');

    return `<section class="card">
      <h2>📈 Trend Analysis</h2>
      <div class="chart-container" style="overflow-x: auto;">
        ${trendChart}
      </div>
      <div style="margin-top: 24px;">
        <h3>Dimension Trends</h3>
        ${dimensionBars || '<p style="color: var(--color-text-muted);">No trend data available</p>'}
      </div>
    </section>`;
  }

  /**
   * Generate issues section
   */
  private static generateIssuesSection(score: ExtendedProjectScore, colors: Record<string, string>): string {
    if (score.issues.length === 0) {
      return `<section class="card">
        <h2>✅ Issues</h2>
        <p style="text-align: center; color: ${colors.success}; font-size: 18px; padding: 32px;">
          No issues found! Great job! 🎉
        </p>
      </section>`;
    }

    const issuesList = score.issues.slice(0, 100).map((issue: { severity: string; file?: string; line?: number; suggestion?: string; message: string }) => {
      const location = issue.file
        ? `<span class="issue-location">📍 ${issue.file}${issue.line ? ':' + issue.line : ''}</span>`
        : '';

      const suggestion = issue.suggestion
        ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>`
        : '';

      return `<div class="issue-item severity-${issue.severity}">
        <span class="issue-badge ${issue.severity}">${issue.severity}</span>
        <div class="issue-content">
          <div class="issue-message">${issue.message}</div>
          ${location}
          ${suggestion}
        </div>
      </div>`;
    }).join('\n');

    const remainingCount = Math.max(0, score.issues.length - 100);
    const remainingMessage = remainingCount > 0
      ? `<p style="text-align: center; color: var(--color-text-muted); margin-top: 16px;">
          ... and ${remainingCount} more issues
        </p>`
      : '';

    return `<section class="card">
      <h2>⚠️ Issues (${score.issues.length})</h2>
      <div class="issues-list">
        ${issuesList}
      </div>
      ${remainingMessage}
    </section>`;
  }

  /**
   * Generate recommendations section
   */
  private static generateRecommendationsSection(score: ExtendedProjectScore, colors: Record<string, string>): string {
    const recommendations = this.generateRecommendations(score);

    const items = recommendations.map(rec => {
      const [icon, text] = rec.split(/ (.+)/);
      return `<div class="recommendation-item">
        <span class="recommendation-icon">${icon}</span>
        <span>${text}</span>
      </div>`;
    }).join('\n');

    return `<section class="card">
      <h2>💡 Recommendations</h2>
      <div class="recommendations-list">
        ${items}
      </div>
    </section>`;
  }

  /**
   * Generate footer
   */
  private static generateFooter(): string {
    return `<footer class="footer">
      <p>Generated by <a href="https://github.com/Pamacea/daemon" target="_blank">Daemon</a> v0.7.0</p>
      <p style="margin-top: 8px; font-size: 12px;">Automated code quality analysis and testing framework</p>
    </footer>`;
  }

  /**
   * Generate inline scripts
   */
  private static generateScripts(): string {
    return `// Theme toggle
    document.addEventListener('DOMContentLoaded', function() {
      // Add smooth scrolling
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          document.querySelector(this.getAttribute('href'))?.scrollIntoView({
            behavior: 'smooth'
          });
        });
      });

      // Animate score on load
      const scoreValue = document.querySelector('.score-value');
      if (scoreValue) {
        const target = parseInt(scoreValue.textContent || '0');
        let current = 0;
        const increment = target / 50;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            scoreValue.textContent = target;
            clearInterval(timer);
          } else {
            scoreValue.textContent = Math.floor(current);
          }
        }, 20);
      }

      // Animate dimension bars
      document.querySelectorAll('.dimension-bar-fill').forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => {
          bar.style.width = width;
        }, 100);
      });
    });`;
  }

  /**
   * Get light color scheme
   */
  private static getLightColors(): Record<string, string> {
    return {
      primary: '#3b82f6',
      secondary: '#6366f1',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      background: '#ffffff',
      surface: '#f9fafb',
      border: '#e5e7eb',
      text: '#1f2937',
      textMuted: '#6b7280',
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    };
  }

  /**
   * Get dark color scheme
   */
  private static getDarkColors(): Record<string, string> {
    return {
      primary: '#60a5fa',
      secondary: '#818cf8',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      background: '#111827',
      surface: '#1f2937',
      border: '#374151',
      text: '#f9fafb',
      textMuted: '#9ca3af',
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    };
  }

  /**
   * Check if dark mode should be used
   */
  private static shouldUseDarkMode(): boolean {
    return false; // Default to light, can be enhanced with system preference detection
  }

  /**
   * Get status from score
   */
  private static getScoreStatus(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'critical';
  }

  /**
   * Get color for score
   */
  private static getScoreColor(score: number, colors: Record<string, string>): string {
    if (score >= 90) return colors.success;
    if (score >= 70) return colors.primary;
    if (score >= 50) return colors.warning;
    return colors.error;
  }

  /**
   * Generate recommendations based on score
   */
  private static generateRecommendations(score: ExtendedProjectScore): string[] {
    const recommendations: string[] = [];

    // Analyze dimensions
    for (const [key, dimension] of Object.entries(score.dimensions)) {
      const dim = dimension as { score: number };
      if (dim.score < 50) {
        recommendations.push(`🔴 Focus on **${key}** - Score is ${dim.score}/100`);
      } else if (dim.score < 70) {
        recommendations.push(`🟡 Improve **${key}** - Score is ${dim.score}/100`);
      }
    }

    // Check for critical issues
    const criticalIssues = score.issues.filter((i: { severity: string }) => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`⚠️ Address ${criticalIssues.length} critical issue(s) immediately`);
    }

    // Check for high severity issues
    const highIssues = score.issues.filter((i: { severity: string }) => i.severity === 'high');
    if (highIssues.length > 0) {
      recommendations.push(`🔠 Fix ${highIssues.length} high severity issue(s) soon`);
    }

    // Add positive reinforcement
    if (score.overall >= 80) {
      recommendations.push('✅ Great job maintaining high code quality!');
    } else if (score.overall >= 60) {
      recommendations.push('💪 Keep working on code quality - you\'re on the right track!');
    }

    return recommendations;
  }
}
