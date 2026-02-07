/**
 * Daemon - Reporter
 *
 * Generates test reports and summaries.
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate test report
 */
function generateReport(results, options = {}) {
  const report = {
    summary: generateSummary(results),
    details: results,
    recommendations: generateRecommendations(results),
    timestamp: new Date().toISOString(),
  };

  if (options.output) {
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  }

  return report;
}

/**
 * Generate summary
 */
function generateSummary(results) {
  const summary = {
    totalTests: 0,
    passing: 0,
    failing: 0,
    skipped: 0,
    coverage: results.coverage || null,
    performance: results.performance || null,
  };

  // Count unit tests
  if (results.unit) {
    summary.totalTests += results.unit.total || 0;
    summary.passing += results.unit.passing || 0;
    summary.failing += results.unit.failing || 0;
    summary.skipped += results.unit.skipped || 0;
  }

  // Count integration tests
  if (results.integration) {
    summary.totalTests += results.integration.total || 0;
    summary.passing += results.integration.passing || 0;
    summary.failing += results.integration.failing || 0;
    summary.skipped += results.integration.skipped || 0;
  }

  // Count E2E tests
  if (results.e2e) {
    summary.totalTests += results.e2e.total || 0;
    summary.passing += results.e2e.passing || 0;
    summary.failing += results.e2e.failing || 0;
    summary.skipped += results.e2e.skipped || 0;
  }

  summary.passRate = summary.totalTests > 0
    ? ((summary.passing / summary.totalTests) * 100).toFixed(2) + '%'
    : 'N/A';

  return summary;
}

/**
 * Generate recommendations
 */
function generateRecommendations(results) {
  const recommendations = [];

  // Coverage recommendations
  if (results.coverage) {
    const coverage = results.coverage;
    if (coverage.lines && coverage.lines < 80) {
      recommendations.push({
        type: 'coverage',
        priority: 'high',
        message: `Line coverage is ${coverage.lines}%. Aim for at least 80%.`,
      });
    }
    if (coverage.branches && coverage.branches < 80) {
      recommendations.push({
        type: 'coverage',
        priority: 'medium',
        message: `Branch coverage is ${coverage.branches}%. Add tests for conditional logic.`,
      });
    }
  }

  // Performance recommendations
  if (results.performance) {
    const perf = results.performance;
    if (perf.p95 && perf.p95 > 200) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `API p95 is ${perf.p95}ms. Target is <200ms. Consider optimization.`,
      });
    }
    if (perf.failureRate && perf.failureRate > 1) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `Failure rate is ${perf.failureRate}%. Check for infrastructure issues.`,
      });
    }
  }

  // Test failure recommendations
  if (results.unit && results.unit.failing > 0) {
    recommendations.push({
      type: 'tests',
      priority: 'high',
      message: `${results.unit.failing} unit test(s) failing. Review and fix.`,
    });
  }

  if (results.e2e && results.e2e.failing > 0) {
    recommendations.push({
      type: 'tests',
      priority: 'medium',
      message: `${results.e2e.failing} E2E test(s) failing. Check for flaky tests.`,
    });
  }

  return recommendations;
}

/**
 * Format report as markdown
 */
function formatMarkdown(report) {
  const lines = [];

  lines.push('# Daemon Test Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date(report.timestamp).toLocaleString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Tests | ${report.summary.totalTests} |`);
  lines.push(`| Passing | ${report.summary.passing} |`);
  lines.push(`| Failing | ${report.summary.failing} |`);
  lines.push(`| Skipped | ${report.summary.skipped} |`);
  lines.push(`| Pass Rate | ${report.summary.passRate} |`);

  if (report.summary.coverage) {
    lines.push(`| Coverage | ${report.summary.coverage.lines || 'N/A'}% (lines) |`);
  }

  if (report.summary.performance) {
    const perf = report.summary.performance;
    lines.push(`| API p95 | ${perf.p95 || 'N/A'}ms |`);
    lines.push(`| API p99 | ${perf.p99 || 'N/A'}ms |`);
  }

  lines.push('');

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');

    for (const rec of report.recommendations) {
      const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      lines.push(`### ${icon} ${rec.type}`);
      lines.push('');
      lines.push(rec.message);
      lines.push('');
    }
  }

  // Details by layer
  lines.push('## Details by Layer');
  lines.push('');

  for (const [layer, data] of Object.entries(report.details)) {
    if (!data || typeof data !== 'object') continue;

    lines.push(`### ${layer.charAt(0).toUpperCase() + layer.slice(1)}`);
    lines.push('');
    lines.push(`| Tests | Pass | Fail | Skip |`);
    lines.push(`|-------|------|------|------|`);
    lines.push(
      `| ${data.total || 0} | ${data.passing || 0} | ${data.failing || 0} | ${data.skipped || 0} |`
    );
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format report as JSON
 */
function formatJSON(report) {
  return JSON.stringify(report, null, 2);
}

/**
 * Format report as console output
 */
function formatConsole(report) {
  const lines = [];

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('  Daemon Test Report');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  const summary = report.summary;

  lines.push(`  Total Tests:  ${summary.totalTests}`);
  lines.push(`  Passing:      ${summary.passing} ✓`);
  lines.push(`  Failing:      ${summary.failing} ✗`);
  lines.push(`  Skipped:      ${summary.skipped} ○`);
  lines.push(`  Pass Rate:    ${summary.passRate}`);

  if (summary.coverage) {
    lines.push(`  Coverage:     ${summary.coverage.lines || 'N/A'}%`);
  }

  if (summary.performance) {
    lines.push(`  API p95:      ${summary.performance.p95 || 'N/A'}ms`);
  }

  lines.push('');

  if (report.recommendations.length > 0) {
    lines.push('  Recommendations:');
    for (const rec of report.recommendations) {
      const icon = rec.priority === 'high' ? '✗' : rec.priority === 'medium' ? '⚠' : 'ℹ';
      lines.push(`    ${icon} ${rec.message}`);
    }
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  return lines.join('\n');
}

/**
 * Save report to file
 */
function saveReport(report, format, outputPath) {
  let content;

  switch (format) {
    case 'markdown':
      content = formatMarkdown(report);
      break;
    case 'json':
      content = formatJSON(report);
      break;
    case 'console':
      content = formatConsole(report);
      break;
    default:
      throw new Error(`Unknown format: ${format}`);
  }

  fs.writeFileSync(outputPath, content);
  return outputPath;
}

/**
 * Print report to console
 */
function printReport(report) {
  console.log(formatConsole(report));
}

module.exports = {
  generateReport,
  generateSummary,
  generateRecommendations,
  formatMarkdown,
  formatJSON,
  formatConsole,
  saveReport,
  printReport,
};
