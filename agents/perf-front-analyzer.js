/**
 * Daemon - Frontend Performance Analyzer
 *
 * Analyzes frontend performance using Lighthouse:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Performance score
 * - Accessibility
 * - Best Practices
 * - SEO
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  container: 'daemon-tools',
  docker: 'docker exec',
};

/**
 * Run Lighthouse audit
 */
function runLighthouse(url, options = {}) {
  const outputPath = options.output || path.join(process.cwd(), 'lighthouse-report.json');
  const htmlOutput = outputPath.replace('.json', '.html');

  const cmd = [
    `docker exec ${CONFIG.container} npx lighthouse`,
    url,
    `--output=json --output=html`,
    `--chrome-flags="--headless --no-sandbox --disable-gpu"`,
    `--quiet`,
    options.onlyCategories ? `--only-categories=${options.onlyCategories}` : '',
    options.formFactor ? `--form-factor=${options.formFactor}` : '--throttling-method=devtools',
    options.screenEmulation ? `--screen-emulation=${options.screenEmulation}` : '',
  ].filter(Boolean).join(' ');

  try {
    execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 });

    // Read the JSON report (container writes to /app)
    const reportPath = path.join(process.cwd(), 'lighthouse-report.json');
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      return { success: true, report, htmlOutput };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Analyze Lighthouse results
 */
function analyzeResults(report) {
  const categories = report.categories || {};
  const audits = report.audits || {};

  return {
    scores: {
      performance: categories.performance?.score || 0,
      accessibility: categories.accessibility?.score || 0,
      bestPractices: categories['best-practices']?.score || 0,
      seo: categories.seo?.score || 0,
      pwa: categories.pwa?.score || 0,
    },
    coreWebVitals: {
      lcp: audits['largest-contentful-paint']?.displayValue || 'N/A',
      fid: audits['max-potential-fid']?.displayValue || 'N/A',
      cls: audits['cumulative-layout-shift']?.displayValue || 'N/A',
      ttfb: audits['time-to-first-byte']?.displayValue || 'N/A',
      fcp: audits['first-contentful-paint']?.displayValue || 'N/A',
      tti: audits['interactive']?.displayValue || 'N/A',
      si: audits['speed-index']?.displayValue || 'N/A',
    },
    opportunities: (opportunities || []).map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      score: item.score,
      displayValue: item.displayValue,
    })),
    diagnostics: Object.values(audits)
      .filter(audit => audit.details && audit.details.type === 'table')
      .map(audit => ({
        id: audit.id,
        title: audit.title,
        description: audit.description,
        items: audit.details?.items || [],
      })),
  };
}

/**
 * Get performance opportunities
 */
function getOpportunities(report) {
  const opportunities = [];

  if (!report.audits) return opportunities;

  const opportunityAudits = [
    'render-blocking-resources',
    'unminified-css',
    'unminified-javascript',
    'unused-css-rules',
    'unused-javascript',
    'modern-image-formats',
    'offscreen-images',
    'scaled-images',
    'efficient-animated-content',
    'text-compression',
    'uses-long-cache-ttl',
    'total-byte-weight',
    'uses-optimized-images',
  ];

  for (const id of opportunityAudits) {
    const audit = report.audits[id];
    if (audit && audit.score !== null && audit.score < 1) {
      opportunities.push({
        id,
        title: audit.title,
        description: audit.description,
        score: audit.score,
        displayValue: audit.displayValue,
        severity: audit.score < 0.5 ? 'high' : 'medium',
      });
    }
  }

  return opportunities.sort((a, b) => a.score - b.score);
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(results) {
  const recommendations = [];
  const { scores, coreWebVitals, opportunities } = results;

  // Performance score recommendations
  if (scores.performance < 0.5) {
    recommendations.push({
      type: 'critical',
      message: `Performance score is ${(scores.performance * 100).toFixed(0)}/100. Immediate optimization required.`,
    });
  } else if (scores.performance < 0.8) {
    recommendations.push({
      type: 'warning',
      message: `Performance score is ${(scores.performance * 100).toFixed(0)}/100. Optimization recommended.`,
    });
  }

  // Core Web Vitals recommendations
  if (coreWebVitals.lcp) {
    const lcpValue = parseFloat(coreWebVitals.lcp);
    if (lcpValue > 4000) {
      recommendations.push({
        type: 'critical',
        metric: 'LCP',
        message: `LCP is ${coreWebVitals.lcp} (target: <2.5s). Consider lazy loading, code splitting, or optimizing images.`,
      });
    }
  }

  if (coreWebVitals.cls) {
    const clsValue = parseFloat(coreWebVitals.cls);
    if (clsValue > 0.25) {
      recommendations.push({
        type: 'critical',
        metric: 'CLS',
        message: `CLS is ${coreWebVitals.cls} (target: <0.1). Reserve space for dynamic content.`,
      });
    }
  }

  // Opportunity-based recommendations
  for (const opp of opportunities.slice(0, 5)) {
    recommendations.push({
      type: opp.severity === 'high' ? 'warning' : 'info',
      message: `${opp.title}: ${opp.displayValue || 'Needs improvement'}`,
    });
  }

  return recommendations;
}

/**
 * Run mobile audit
 */
function runMobileAudit(url) {
  return runLighthouse(url, {
    formFactor: 'mobile',
    screenEmulation: 'mobile',
  });
}

/**
 * Run desktop audit
 */
function runDesktopAudit(url) {
  return runLighthouse(url, {
    formFactor: 'desktop',
  });
}

/**
 * Run performance-only audit (faster)
 */
function runPerformanceOnlyAudit(url) {
  return runLighthouse(url, {
    onlyCategories: 'performance',
  });
}

module.exports = {
  runLighthouse,
  analyzeResults,
  getOpportunities,
  generateRecommendations,
  runMobileAudit,
  runDesktopAudit,
  runPerformanceOnlyAudit,
};
