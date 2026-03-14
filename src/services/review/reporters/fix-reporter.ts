/**
 * Fix Reporter
 *
 * Génération de rapports de corrections:
 * - Liste des corrections appliquées
 * - Suggestions en attente
 * - Corrections manuelles nécessaires
 * - Estimation de l'effort restant
 *
 * @module services/review/reporters/fix-reporter
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

import type { Fix, Suggestion, FixResult, ReportFormat, ReportOptions } from '../review.types.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Reporter de corrections
 */
export class FixReporter {
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger('FixReporter');
  }

  /**
   * Génère un rapport de corrections
   *
   * @param result - Résultat des corrections
   * @param projectPath - Chemin du projet
   * @param options - Options de génération
   */
  async generateReport(
    result: FixResult,
    projectPath: string,
    options: ReportOptions & {
      suggestions?: Suggestion[];
      remainingIssues?: number;
    } = { format: 'console' as const }
  ): Promise<void> {
    this.logger.info(`Generating ${options.format} fix report`);

    switch (options.format) {
      case 'json':
        await this.generateJsonReport(result, projectPath, options);
        break;
      case 'html':
        await this.generateHtmlReport(result, projectPath, options);
        break;
      case 'markdown':
        await this.generateMarkdownReport(result, projectPath, options);
        break;
      case 'console':
        this.generateConsoleReport(result, projectPath, options);
        break;
    }
  }

  /**
   * Génère un rapport JSON
   */
  private async generateJsonReport(
    result: FixResult,
    projectPath: string,
    options: ReportOptions & {
      suggestions?: Suggestion[];
      remainingIssues?: number;
    }
  ): Promise<void> {
    const outputPath = options.outputPath ?? join(projectPath, 'fix-report.json');

    const report = {
      projectPath,
      timestamp: new Date().toISOString(),
      success: result.success,
      summary: {
        attempted: result.attempted,
        applied: result.applied,
        failed: result.failed,
      },
      fixes: result.fixes,
      suggestions: options.suggestions ?? [],
      remainingIssues: options.remainingIssues ?? 0,
      duration: result.duration,
      error: result.error,
    };

    await this.ensureDirectoryExists(outputPath);
    await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

    this.logger.info(`JSON fix report saved to: ${outputPath}`);
  }

  /**
   * Génère un rapport HTML
   */
  private async generateHtmlReport(
    result: FixResult,
    projectPath: string,
    options: ReportOptions & {
      suggestions?: Suggestion[];
      remainingIssues?: number;
    }
  ): Promise<void> {
    const outputPath = options.outputPath ?? join(projectPath, 'fix-report.html');

    const html = this.generateHtmlContent(result, projectPath, options);

    await this.ensureDirectoryExists(outputPath);
    await writeFile(outputPath, html, 'utf-8');

    this.logger.info(`HTML fix report saved to: ${outputPath}`);
  }

  /**
   * Génère un rapport Markdown
   */
  private async generateMarkdownReport(
    result: FixResult,
    projectPath: string,
    options: ReportOptions & {
      suggestions?: Suggestion[];
      remainingIssues?: number;
    }
  ): Promise<void> {
    const outputPath = options.outputPath ?? join(projectPath, 'FIX-REPORT.md');

    const markdown = this.generateMarkdownContent(result, projectPath, options);

    await this.ensureDirectoryExists(outputPath);
    await writeFile(outputPath, markdown, 'utf-8');

    this.logger.info(`Markdown fix report saved to: ${outputPath}`);
  }

  /**
   * Génère un rapport console
   */
  private generateConsoleReport(
    result: FixResult,
    projectPath: string,
    options: ReportOptions & {
      suggestions?: Suggestion[];
      remainingIssues?: number;
    }
  ): void {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              AUTO-FIX REPORT                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Project: ${projectPath}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s\n`);

    // Statut
    const statusIcon = result.success ? '✅' : '❌';
    console.log(`${statusIcon} Status: ${result.success ? 'Success' : 'Failed'}\n`);

    // Résumé
    console.log('Summary:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`  Attempted:  ${result.attempted}`);
    console.log(`  ✅ Applied:  ${result.applied}`);
    console.log(`  ❌ Failed:   ${result.failed}`);

    if (options.suggestions && options.suggestions.length > 0) {
      console.log(`  💡 Suggestions: ${options.suggestions.length}`);
    }

    if (options.remainingIssues !== undefined) {
      console.log(`  📋 Remaining Issues: ${options.remainingIssues}`);
    }

    console.log('─────────────────────────────────────────────────────────────\n');

    // Corrections appliquées
    if (result.fixes.length > 0) {
      console.log('Applied Fixes:');
      console.log('─────────────────────────────────────────────────────────────');

      for (const fix of result.fixes.filter((f) => f.applied)) {
        const icon = fix.automatic ? '🤖' : '👤';
        console.log(`  ${icon} ${fix.description}`);

        if (options.verbosity === 'detailed' && fix.filesChanged.length > 0) {
          for (const file of fix.filesChanged) {
            console.log(`     📄 ${file.replace(projectPath, '')}`);
          }
        }
      }

      console.log();
    }

    // Corrections échouées
    if (result.fixes.some((f) => !f.applied)) {
      console.log('Failed Fixes:');
      console.log('─────────────────────────────────────────────────────────────');

      for (const fix of result.fixes.filter((f) => !f.applied)) {
        console.log(`  ❌ ${fix.description}`);
        if (fix.error) {
          console.log(`     Error: ${fix.error}`);
        }
      }

      console.log();
    }

    // Suggestions
    if (options.includeSuggestions && options.suggestions && options.suggestions.length > 0) {
      console.log('Pending Suggestions:');
      console.log('─────────────────────────────────────────────────────────────');

      // Afficher les 10 suggestions les plus prioritaires
      const topSuggestions = options.suggestions.slice(0, 10);

      for (const suggestion of topSuggestions) {
        const priorityIcon = suggestion.priority >= 7 ? '🔴' : suggestion.priority >= 5 ? '🟡' : '🟢';
        const file = suggestion.location.file.replace(projectPath, '');

        console.log(`  ${priorityIcon} [${suggestion.type}] ${suggestion.title}`);
        console.log(`     📄 ${file}:${suggestion.location.line}`);
        console.log(`     💡 ${suggestion.description}`);

        if (options.verbosity === 'detailed' && suggestion.effort) {
          console.log(`     ⏱️  Effort: ${suggestion.effort}/10`);
        }
      }

      if (options.suggestions.length > 10) {
        console.log(`  ... and ${options.suggestions.length - 10} more suggestions`);
      }

      console.log();
    }

    // Effort restant estimé
    if (options.suggestions) {
      const totalEffort = options.suggestions.reduce((sum, s) => sum + (s.effort ?? 0), 0);
      console.log(`Estimated Remaining Effort: ${totalEffort} points`);
    }
  }

  /**
   * Génère le contenu HTML du rapport
   */
  private generateHtmlContent(
    result: FixResult,
    projectPath: string,
    options: ReportOptions & {
      suggestions?: Suggestion[];
      remainingIssues?: number;
    }
  ): string {
    const successRate = result.attempted > 0 ? Math.round((result.applied / result.attempted) * 100) : 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auto-Fix Report - ${projectPath}</title>
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
      background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
      border-radius: 1rem;
      margin-bottom: 2rem;
    }
    .status-badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: bold;
      margin-top: 1rem;
    }
    .status-success { background: #10b981; }
    .status-failed { background: #ef4444; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
    .fix-list {
      background: #1e293b;
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .fix-item {
      padding: 1rem;
      background: #0f172a;
      border-radius: 0.5rem;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .fix-icon { font-size: 1.5rem; }
    .fix-info { flex: 1; }
    .fix-files {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 0.25rem;
    }
    .suggestion-list {
      background: #1e293b;
      border-radius: 0.75rem;
      padding: 1.5rem;
    }
    .suggestion-item {
      padding: 1rem;
      background: #0f172a;
      border-radius: 0.5rem;
      margin-bottom: 0.5rem;
      border-left: 3px solid;
    }
    .prio-high { border-color: #ef4444; }
    .prio-medium { border-color: #f59e0b; }
    .prio-low { border-color: #22c55e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔧 Auto-Fix Report</h1>
      <p style="opacity: 0.8">${projectPath}</p>
      <span class="status-badge ${result.success ? 'status-success' : 'status-failed'}">
        ${result.success ? '✅ Success' : '❌ Failed'}
      </span>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${result.attempted}</div>
        <div class="stat-label">Attempted</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${result.applied}</div>
        <div class="stat-label">Applied</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${result.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${successRate}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
    </div>

    ${result.fixes.filter(f => f.applied).length > 0 ? `
    <div class="fix-list">
      <h2 style="margin-bottom: 1rem;">✅ Applied Fixes (${result.fixes.filter(f => f.applied).length})</h2>
      ${result.fixes.filter(f => f.applied).slice(0, 50).map(fix => `
        <div class="fix-item">
          <span class="fix-icon">${fix.automatic ? '🤖' : '👤'}</span>
          <div class="fix-info">
            <div>${fix.description}</div>
            ${fix.filesChanged.length > 0 ? `
              <div class="fix-files">
                ${fix.filesChanged.map(f => `<span>${f.replace(projectPath, '')}</span>`).join(', ')}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${result.fixes.some(f => !f.applied) ? `
    <div class="fix-list">
      <h2 style="margin-bottom: 1rem;">❌ Failed Fixes (${result.fixes.filter(f => !f.applied).length})</h2>
      ${result.fixes.filter(f => !f.applied).map(fix => `
        <div class="fix-item">
          <span class="fix-icon">❌</span>
          <div class="fix-info">
            <div>${fix.description}</div>
            ${fix.error ? `<div class="fix-files" style="color: #ef4444;">${fix.error}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${options.includeSuggestions && options.suggestions && options.suggestions.length > 0 ? `
    <div class="suggestion-list">
      <h2 style="margin-bottom: 1rem;">💡 Pending Suggestions (${options.suggestions.length})</h2>
      ${options.suggestions.slice(0, 20).map(suggestion => {
        const priority = suggestion.priority >= 7 ? 'prio-high' : suggestion.priority >= 5 ? 'prio-medium' : 'prio-low';
        return `
          <div class="suggestion-item ${priority}">
            <strong>[${suggestion.type}] ${suggestion.title}</strong>
            <p style="color: #94a3b8; font-size: 0.875rem; margin: 0.25rem 0;">
              ${suggestion.location.file.replace(projectPath, '')}:${suggestion.location.line}
            </p>
            <p style="font-size: 0.875rem;">${suggestion.description}</p>
          </div>
        `;
      }).join('')}
    </div>
    ` : ''}
  </div>
</body>
</html>`;
  }

  /**
   * Génère le contenu Markdown du rapport
   */
  private generateMarkdownContent(
    result: FixResult,
    projectPath: string,
    options: ReportOptions & {
      suggestions?: Suggestion[];
      remainingIssues?: number;
    }
  ): string {
    const successRate = result.attempted > 0 ? Math.round((result.applied / result.attempted) * 100) : 0;

    let md = `# Auto-Fix Report\n\n`;
    md += `**Project:** ${projectPath}\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Status:** ${result.success ? '✅ Success' : '❌ Failed'}\n`;
    md += `**Duration:** ${(result.duration / 1000).toFixed(1)}s\n\n`;

    md += `## Summary\n\n`;
    md += `| Metric | Count |\n`;
    md += `|--------|-------|\n`;
    md += `| Attempted | ${result.attempted} |\n`;
    md += `| Applied | ${result.applied} |\n`;
    md += `| Failed | ${result.failed} |\n`;
    md += `| Success Rate | ${successRate}% |\n\n`;

    if (options.remainingIssues !== undefined) {
      md += `**Remaining Issues:** ${options.remainingIssues}\n\n`;
    }

    // Corrections appliquées
    if (result.fixes.some((f) => f.applied)) {
      md += `## Applied Fixes (${result.fixes.filter((f) => f.applied).length})\n\n`;

      for (const fix of result.fixes.filter((f) => f.applied)) {
        const icon = fix.automatic ? '🤖' : '👤';
        md += `### ${icon} ${fix.description}\n\n`;

        if (fix.filesChanged.length > 0) {
          md += `**Files changed:**\n`;
          for (const file of fix.filesChanged) {
            md += `- \`${file.replace(projectPath, '')}\`\n`;
          }
          md += `\n`;
        }
      }
    }

    // Corrections échouées
    if (result.fixes.some((f) => !f.applied)) {
      md += `## Failed Fixes (${result.fixes.filter((f) => !f.applied).length})\n\n`;

      for (const fix of result.fixes.filter((f) => !f.applied)) {
        md += `### ❌ ${fix.description}\n\n`;
        if (fix.error) {
          md += `**Error:** \`${fix.error}\`\n\n`;
        }
      }
    }

    // Suggestions
    if (options.includeSuggestions && options.suggestions && options.suggestions.length > 0) {
      md += `## Pending Suggestions (${options.suggestions.length})\n\n`;

      // Estimer l'effort total
      const totalEffort = options.suggestions.reduce((sum, s) => sum + (s.effort ?? 0), 0);
      md += `**Estimated effort:** ${totalEffort} points\n\n`;

      // Afficher les suggestions prioritaires
      const prioritySuggestions = options.suggestions.filter((s) => s.priority >= 7);
      if (prioritySuggestions.length > 0) {
        md += `### High Priority (${prioritySuggestions.length})\n\n`;
        for (const suggestion of prioritySuggestions.slice(0, 10)) {
          const file = suggestion.location.file.replace(projectPath, '');
          md += `- **[${suggestion.type}]** ${suggestion.title}\n`;
          md += `  - 📄 \`${file}:${suggestion.location.line}\`\n`;
          md += `  - 💡 ${suggestion.description}\n`;
          md += `  - ⏱️ Effort: ${suggestion.effort}/10\n\n`;
        }
      }
    }

    md += `\n---\n*Generated by Daemon v0.7.0*`;

    return md;
  }

  /**
   * Estime l'effort total des suggestions
   */
  estimateEffort(suggestions: Suggestion[]): {
    total: number;
    byPriority: Record<string, number>;
    quickWins: Suggestion[];
  } {
    const total = suggestions.reduce((sum, s) => sum + (s.effort ?? 0), 0);

    const byPriority: Record<string, number> = {
      high: suggestions.filter((s) => s.priority >= 7).reduce((sum, s) => sum + (s.effort ?? 0), 0),
      medium: suggestions.filter((s) => s.priority >= 4 && s.priority < 7).reduce((sum, s) => sum + (s.effort ?? 0), 0),
      low: suggestions.filter((s) => s.priority < 4).reduce((sum, s) => sum + (s.effort ?? 0), 0),
    };

    // Quick wins = faible effort, haute priorité
    const quickWins = suggestions.filter((s) => s.priority >= 6 && (s.effort ?? 0) <= 4);

    return { total, byPriority, quickWins };
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
