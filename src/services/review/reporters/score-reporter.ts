/**
 * Score Reporter
 *
 * Génération de rapports de score:
 * - Calcul du score de qualité du projet
 * - Comparaison avec le scan précédent
 * - Mise en évidence des améliorations
 * - Export en plusieurs formats (JSON, HTML, Markdown)
 *
 * @module services/review/reporters/score-reporter
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

import type { ProjectScore, ReviewResult, ReportFormat, ReportOptions, Issue } from '../review.types.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Poids des catégories pour le score global
 */
const CATEGORY_WEIGHTS = {
  static: 0.25,
  security: 0.30,
  dependency: 0.15,
  performance: 0.15,
  testing: 0.10,
  codeQuality: 0.05,
};

/**
 * Score maximum par catégorie
 */
const MAX_SCORE = 100;

/**
 * Reporter de score
 */
export class ScoreReporter {
  private readonly logger: Logger;
  private previousScores: Map<string, { score: ProjectScore; timestamp: Date }> = new Map();

  constructor() {
    this.logger = createLogger('ScoreReporter');
  }

  /**
   * Génère un rapport de score à partir d'un résultat de review
   *
   * @param result - Résultat de la review
   * @param options - Options de génération
   */
  async generateReport(result: ReviewResult, options: ReportOptions): Promise<void> {
    this.logger.info(`Generating ${options.format} score report`);

    // Charger le score précédent pour comparaison
    if (options.showDelta) {
      await this.loadPreviousScore(result.projectPath);
    }

    switch (options.format) {
      case 'json':
        await this.generateJsonReport(result, options);
        break;
      case 'html':
        await this.generateHtmlReport(result, options);
        break;
      case 'markdown':
        await this.generateMarkdownReport(result, options);
        break;
      case 'console':
        this.generateConsoleReport(result, options);
        break;
    }

    // Sauvegarder le score pour la prochaine fois
    await this.saveScore(result);
  }

  /**
   * Génère un rapport JSON
   */
  private async generateJsonReport(result: ReviewResult, options: ReportOptions): Promise<void> {
    const outputPath = options.outputPath ?? join(result.projectPath, 'review-score.json');

    const report = {
      projectPath: result.projectPath,
      timestamp: result.timestamp,
      duration: result.duration,
      score: result.score,
      summary: result.summary,
      issues: result.issues,
      fixes: result.fixes,
      suggestions: options.includeSuggestions ? result.suggestions : [],
      coverage: result.coverage,
      dependencies: result.dependencies,
      performance: result.performance,
    };

    await this.ensureDirectoryExists(outputPath);
    await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

    this.logger.info(`JSON report saved to: ${outputPath}`);
  }

  /**
   * Génère un rapport HTML
   */
  private async generateHtmlReport(result: ReviewResult, options: ReportOptions): Promise<void> {
    const outputPath = options.outputPath ?? join(result.projectPath, 'review-score.html');

    const html = this.generateHtmlContent(result, options);

    await this.ensureDirectoryExists(outputPath);
    await writeFile(outputPath, html, 'utf-8');

    this.logger.info(`HTML report saved to: ${outputPath}`);
  }

  /**
   * Génère un rapport Markdown
   */
  private async generateMarkdownReport(result: ReviewResult, options: ReportOptions): Promise<void> {
    const outputPath = options.outputPath ?? join(result.projectPath, 'REVIEW-SCORE.md');

    const markdown = this.generateMarkdownContent(result, options);

    await this.ensureDirectoryExists(outputPath);
    await writeFile(outputPath, markdown, 'utf-8');

    this.logger.info(`Markdown report saved to: ${outputPath}`);
  }

  /**
   * Génère un rapport console
   */
  private generateConsoleReport(result: ReviewResult, options: ReportOptions): void {
    const { score, summary, issues } = result;
    const delta = score.delta ?? 0;
    const deltaStr = delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : '';

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           CODE REVIEW & QUALITY REPORT                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Project: ${result.projectPath}`);
    console.log(`Date: ${result.timestamp.toISOString()}`);
    console.log(`Duration: ${result.duration}ms\n`);

    // Score global
    const scoreColor = score.overall >= 80 ? '🟢' : score.overall >= 60 ? '🟡' : '🔴';
    console.log(`${scoreColor} Overall Score: ${score.overall}/100${deltaStr}\n`);

    // Scores par catégorie
    console.log('Category Scores:');
    console.log('─────────────────────────────────────────────────────────────');
    this.printCategoryScore('Static Analysis', score.categories.static);
    this.printCategoryScore('Security', score.categories.security);
    this.printCategoryScore('Dependencies', score.categories.dependency);
    this.printCategoryScore('Performance', score.categories.performance);
    this.printCategoryScore('Testing', score.categories.testing);
    this.printCategoryScore('Code Quality', score.categories.codeQuality);
    console.log('─────────────────────────────────────────────────────────────\n');

    // Résumé
    console.log(`Total Issues: ${summary.totalIssues}`);
    console.log(`Fixable: ${summary.fixableIssues} | Fixed: ${summary.fixedIssues}`);
    console.log(`Suggestions: ${summary.suggestions}\n`);

    // Issues par sévérité
    console.log('Issues by Severity:');
    console.log(`  🔴 Critical: ${score.issueCounts.critical}`);
    console.log(`  🟠 High:     ${score.issueCounts.high}`);
    console.log(`  🟡 Medium:   ${score.issueCounts.medium}`);
    console.log(`  🟢 Low:      ${score.issueCounts.low}`);
    console.log(`  ℹ️  Info:     ${score.issueCounts.info}\n`);

    // Top issues si verbose
    if (options.verbosity === 'detailed') {
      const topIssues = issues.slice(0, 10);
      console.log('Top Issues:');
      console.log('─────────────────────────────────────────────────────────────');
      for (const issue of topIssues) {
        const icon = this.getSeverityIcon(issue.severity);
        const file = issue.location.file.replace(result.projectPath, '');
        console.log(`${icon} [${issue.severity.toUpperCase()}] ${file}:${issue.location.line}`);
        console.log(`   ${issue.description}`);
      }
    }
  }

  /**
   * Affiche le score d'une catégorie
   */
  private printCategoryScore(name: string, score: number): void {
    const bar = '█'.repeat(Math.round(score / 10));
    const empty = '░'.repeat(10 - Math.round(score / 10));
    const color = score >= 80 ? '\x1b[32m' : score >= 60 ? '\x1b[33m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`  ${name.padEnd(20)} ${color}${bar}${empty}${reset} ${score}/100`);
  }

  /**
   * Génère le contenu HTML du rapport
   */
  private generateHtmlContent(result: ReviewResult, options: ReportOptions): string {
    const { score, issues } = result;

    // Grader le score
    const grade = score.overall >= 90 ? 'A' : score.overall >= 80 ? 'B' : score.overall >= 70 ? 'C' : score.overall >= 60 ? 'D' : 'F';
    const gradeColor = grade === 'A' ? '#10b981' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#f59e0b' : grade === 'D' ? '#f97316' : '#ef4444';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Report - ${result.projectPath}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .header {
      text-align: center;
      padding: 2rem;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 1rem;
      margin-bottom: 2rem;
    }
    .score-circle {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      background: ${gradeColor};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 1rem auto;
      font-size: 3rem;
      font-weight: bold;
      box-shadow: 0 0 30px ${gradeColor}40;
    }
    .grade {
      position: absolute;
      font-size: 1.5rem;
      background: rgba(0,0,0,0.3);
      padding: 0.5rem 1rem;
      border-radius: 1rem;
    }
    .categories {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .category {
      background: #1e293b;
      padding: 1.5rem;
      border-radius: 0.75rem;
    }
    .category-name { font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.5rem; }
    .progress-bar {
      height: 8px;
      background: #334155;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 0.5rem;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      transition: width 0.3s;
    }
    .issues {
      background: #1e293b;
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .issue-item {
      padding: 1rem;
      background: #0f172a;
      border-radius: 0.5rem;
      margin-bottom: 0.5rem;
      border-left: 3px solid;
    }
    .issue-critical { border-color: #ef4444; }
    .issue-high { border-color: #f97316; }
    .issue-medium { border-color: #f59e0b; }
    .issue-low { border-color: #22c55e; }
    .severity-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      margin-right: 0.5rem;
    }
    .sev-critical { background: #ef444420; color: #ef4444; }
    .sev-high { background: #f9731620; color: #f97316; }
    .sev-medium { background: #f59e0b20; color: #f59e0b; }
    .sev-low { background: #22c55e20; color: #22c55e; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: #1e293b;
      padding: 1.5rem;
      border-radius: 0.75rem;
      text-align: center;
    }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .stat-label { font-size: 0.875rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Code Review Report</h1>
      <p style="opacity: 0.8">${result.projectPath}</p>
      <p style="opacity: 0.6; font-size: 0.875rem">${result.timestamp.toLocaleString()}</p>
      <div style="position: relative; display: inline-block;">
        <div class="score-circle">${score.overall}</div>
        <div class="grade">${grade}</div>
      </div>
      <p style="margin-top: 1rem;">Overall Quality Score</p>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${result.summary.totalIssues}</div>
        <div class="stat-label">Total Issues</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${result.summary.fixableIssues}</div>
        <div class="stat-label">Fixable Issues</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${result.summary.fixedIssues}</div>
        <div class="stat-label">Issues Fixed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${(result.duration / 1000).toFixed(1)}s</div>
        <div class="stat-label">Analysis Time</div>
      </div>
    </div>

    <div class="categories">
      ${this.renderCategory('Static Analysis', score.categories.static)}
      ${this.renderCategory('Security', score.categories.security)}
      ${this.renderCategory('Dependencies', score.categories.dependency)}
      ${this.renderCategory('Performance', score.categories.performance)}
      ${this.renderCategory('Testing', score.categories.testing)}
      ${this.renderCategory('Code Quality', score.categories.codeQuality)}
    </div>

    ${options.verbosity !== 'summary' ? `
    <div class="issues">
      <h2 style="margin-bottom: 1rem;">Issues by Severity</h2>
      <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
        <span class="severity-badge sev-critical">🔴 Critical: ${score.issueCounts.critical}</span>
        <span class="severity-badge sev-high">🟠 High: ${score.issueCounts.high}</span>
        <span class="severity-badge sev-medium">🟡 Medium: ${score.issueCounts.medium}</span>
        <span class="severity-badge sev-low">🟢 Low: ${score.issueCounts.low}</span>
      </div>
      ${issues.slice(0, 50).map(issue => `
        <div class="issue-item issue-${issue.severity}">
          <span class="severity-badge sev-${issue.severity}">${issue.severity.toUpperCase()}</span>
          <strong>${issue.description}</strong>
          <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem;">
            ${issue.location.file.replace(result.projectPath, '')}:${issue.location.line}
          </p>
        </div>
      `).join('')}
    </div>
    ` : ''}
  </div>
</body>
</html>`;
  }

  /**
   * Rendu d'une catégorie pour HTML
   */
  private renderCategory(name: string, score: number): string {
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';

    return `
    <div class="category">
      <div class="category-name">${name}</div>
      <div style="font-size: 1.5rem; font-weight: bold;">${score}/100</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${score}%; background: ${color};"></div>
      </div>
    </div>`;
  }

  /**
   * Génère le contenu Markdown du rapport
   */
  private generateMarkdownContent(result: ReviewResult, options: ReportOptions): string {
    const { score, issues } = result;
    const grade = score.overall >= 90 ? 'A' : score.overall >= 80 ? 'B' : score.overall >= 70 ? 'C' : score.overall >= 60 ? 'D' : 'F';

    let md = `# Code Review Report

**Project:** ${result.projectPath}
**Date:** ${result.timestamp.toLocaleString()}
**Duration:** ${(result.duration / 1000).toFixed(1)}s

---

## Overall Score: ${score.overall}/100 (Grade: ${grade})

`;

    // Scores par catégorie
    md += `### Category Scores\n\n`;
    md += `| Category | Score |\n`;
    md += `|----------|-------|\n`;
    md += `| Static Analysis | ${score.categories.static}/100 |\n`;
    md += `| Security | ${score.categories.security}/100 |\n`;
    md += `| Dependencies | ${score.categories.dependency}/100 |\n`;
    md += `| Performance | ${score.categories.performance}/100 |\n`;
    md += `| Testing | ${score.categories.testing}/100 |\n`;
    md += `| Code Quality | ${score.categories.codeQuality}/100 |\n\n`;

    // Résumé
    md += `## Summary\n\n`;
    md += `- **Total Issues:** ${result.summary.totalIssues}\n`;
    md += `- **Fixable Issues:** ${result.summary.fixableIssues}\n`;
    md += `- **Issues Fixed:** ${result.summary.fixedIssues}\n`;
    md += `- **Suggestions:** ${result.summary.suggestions}\n\n`;

    // Issues par sévérité
    md += `### Issues by Severity\n\n`;
    md += `- 🔴 **Critical:** ${score.issueCounts.critical}\n`;
    md += `- 🟠 **High:** ${score.issueCounts.high}\n`;
    md += `- 🟡 **Medium:** ${score.issueCounts.medium}\n`;
    md += `- 🟢 **Low:** ${score.issueCounts.low}\n`;
    md += `- ℹ️ **Info:** ${score.issueCounts.info}\n\n`;

    // Top issues
    if (options.verbosity === 'detailed' && issues.length > 0) {
      md += `## Top Issues\n\n`;
      for (const issue of issues.slice(0, 20)) {
        const icon = this.getSeverityIcon(issue.severity);
        md += `### ${icon} ${issue.description}\n\n`;
        md += `**Location:** \`${issue.location.file.replace(result.projectPath, '')}:${issue.location.line}\`\n`;
        md += `**Severity:** ${issue.severity.toUpperCase()}\n`;
        if (issue.fixable) {
          md += `**Fixable:** Yes (Effort: ${issue.effort}/10)\n`;
        }
        md += `\n`;
      }
    }

    md += `\n---\n*Generated by Daemon v0.7.0*`;

    return md;
  }

  /**
   * Retourne l'icône pour une sévérité
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Calcule le score du projet à partir des issues
   */
  calculateScore(issues: Issue[], previousScore?: ProjectScore): ProjectScore {
    // Calculer les scores par catégorie
    const categories = {
      static: this.calculateCategoryScore(issues, 'static'),
      security: this.calculateCategoryScore(issues, 'security'),
      dependency: this.calculateCategoryScore(issues, 'dependency'),
      performance: this.calculateCategoryScore(issues, 'performance'),
      testing: this.calculateCategoryScore(issues, 'testing'),
      codeQuality: this.calculateCategoryScore(issues, 'code-quality'),
      documentation: this.calculateCategoryScore(issues, 'documentation'),
    };

    // Score pondéré
    const overall = Math.round(
      categories.static * CATEGORY_WEIGHTS.static +
      categories.security * CATEGORY_WEIGHTS.security +
      categories.dependency * CATEGORY_WEIGHTS.dependency +
      categories.performance * CATEGORY_WEIGHTS.performance +
      categories.testing * CATEGORY_WEIGHTS.testing +
      categories.codeQuality * CATEGORY_WEIGHTS.codeQuality
    );

    // Compter les issues par sévérité
    const issueCounts = {
      critical: issues.filter((i) => i.severity === 'critical').length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length,
      info: issues.filter((i) => i.severity === 'info').length,
    };

    // Delta avec le score précédent
    const delta = previousScore ? overall - previousScore.overall : undefined;

    return {
      overall,
      categories,
      delta,
      issueCounts,
    };
  }

  /**
   * Calcule le score pour une catégorie spécifique
   */
  private calculateCategoryScore(issues: Issue[], category: string): number {
    const categoryIssues = issues.filter((i) => i.category === category);

    if (categoryIssues.length === 0) {
      return 100; // Pas d'issues = score parfait
    }

    // Calculer les pénalités par sévérité
    const penalties = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
      info: 1,
    };

    let totalPenalty = 0;
    for (const issue of categoryIssues) {
      totalPenalty += penalties[issue.severity] ?? 0;
    }

    return Math.max(0, MAX_SCORE - totalPenalty);
  }

  /**
   * Sauvegarde le score pour comparaison future
   */
  private async saveScore(result: ReviewResult): Promise<void> {
    const cachePath = join(result.projectPath, '.daemon', 'review-cache.json');

    await this.ensureDirectoryExists(cachePath);

    let cache: Record<string, { score: ProjectScore; timestamp: Date; hash: string }> = {};

    try {
      if (existsSync(cachePath)) {
        const content = await readFile(cachePath, 'utf-8');
        cache = JSON.parse(content);
      }
    } catch {
      // Cache invalide, créer nouveau
    }

    // Créer un hash du contenu pour détecter les changements
    const contentHash = createHash('sha256')
      .update(JSON.stringify(result.issues.map((i) => ({ id: i.id, description: i.description }))))
      .digest('hex');

    cache[result.projectPath] = {
      score: result.score,
      timestamp: result.timestamp,
      hash: contentHash,
    };

    await writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  }

  /**
   * Charge le score précédent pour comparaison
   */
  private async loadPreviousScore(projectPath: string): Promise<void> {
    const cachePath = join(projectPath, '.daemon', 'review-cache.json');

    try {
      const content = await readFile(cachePath, 'utf-8');
      const cache = JSON.parse(content) as Record<string, { score: ProjectScore; timestamp: Date; hash: string }>;

      const previous = cache[projectPath];
      if (previous) {
        this.previousScores.set(projectPath, previous);
      }
    } catch {
      // Pas de cache précédent
    }
  }

  /**
   * S'assure que le répertoire existe
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await mkdir(dir, { recursive: true });
    } catch {
      // Peut exister déjà
    }
  }
}
