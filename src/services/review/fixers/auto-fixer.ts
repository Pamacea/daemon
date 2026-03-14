/**
 * Auto Fixer
 *
 * Application automatique des corrections:
 * - ESLint --fix
 * - Organisation des imports
 * - Refactorings simples
 * - Suppression sécurisée de code mort
 *
 * @module services/review/fixers/auto-fixer
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { mkdir, chmod } from 'node:fs/promises';

import type { Issue, Fix } from '../review.types.js';
import type { DockerExecResult } from '../../../core/types/docker.types.js';
import { DockerManager } from '../../docker/docker-manager.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Correction applicable
 */
interface ApplicableFix {
  issueId: string;
  filePath: string;
  description: string;
  patch: string;
}

/**
 * Correcteur automatique
 */
export class AutoFixer {
  private readonly docker: DockerManager;
  private readonly logger: Logger;
  private appliedFixes: Fix[] = [];
  private failedFixes: Fix[] = [];

  constructor(docker?: DockerManager) {
    this.docker = docker ?? new DockerManager();
    this.logger = createLogger('AutoFixer');
  }

  /**
   * Applique les corrections automatiques sur une liste d'issues
   *
   * @param issues - Liste des issues à corriger
   * @param projectPath - Chemin du projet
   * @param options - Options de correction
   * @returns Résultat des corrections appliquées
   */
  async applyFixes(
    issues: Issue[],
    projectPath: string,
    options: {
      dryRun?: boolean;
      maxSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
      maxEffort?: number;
      createBackup?: boolean;
    } = {}
  ): Promise<Fix[]> {
    this.appliedFixes = [];
    this.failedFixes = [];

    this.logger.info(`Starting auto-fix for ${issues.length} issues`);

    // Filtrer les issues corrigibles
    const fixableIssues = issues.filter((issue) => {
      if (!issue.fixable) return false;
      if (options.maxSeverity && this.compareSeverity(issue.severity, options.maxSeverity) > 0) return false;
      if (options.maxEffort && issue.effort > options.maxEffort) return false;
      return true;
    });

    this.logger.info(`Found ${fixableIssues.length} auto-fixable issues`);

    // Créer un backup si demandé
    if (options.createBackup && !options.dryRun) {
      await this.createBackup(projectPath);
    }

    // Grouper les issues par type de correction
    const eslintFixes = fixableIssues.filter((i) => i.ruleId?.startsWith('eslint-'));
    const importFixes = fixableIssues.filter((i) => i.description.includes('import') || i.ruleId?.includes('import'));
    const otherFixes = fixableIssues.filter((i) => !eslintFixes.includes(i) && !importFixes.includes(i));

    // Appliquer ESLint --fix pour les issues ESLint
    if (eslintFixes.length > 0) {
      await this.applyEslintFix(eslintFixes, projectPath, options.dryRun);
    }

    // Appliquer les corrections d'imports
    if (importFixes.length > 0) {
      await this.applyImportFixes(importFixes, projectPath, options.dryRun);
    }

    // Appliquer les autres corrections
    for (const issue of otherFixes) {
      await this.applySingleFix(issue, projectPath, options.dryRun);
    }

    this.logger.info(`Applied ${this.appliedFixes.length} fixes, ${this.failedFixes.length} failed`);

    return [...this.appliedFixes, ...this.failedFixes];
  }

  /**
   * Applique ESLint --fix sur les fichiers concernés
   */
  private async applyEslintFix(issues: Issue[], projectPath: string, dryRun?: boolean): Promise<void> {
    // Récupérer les fichiers uniques
    const files = [...new Set(issues.map((i) => i.location.file))];

    for (const file of files) {
      const relativePath = file.replace(projectPath, '').replace(/^\//, '');
      const command = `npx eslint --fix '${relativePath}'`;

      const fileIssues = issues.filter((i) => i.location.file === file);

      try {
        const result = await this.docker.exec(command, {
          workingDir: projectPath,
          timeout: 30000,
        });

        if (result.success || result.stdout.includes('fixed')) {
          for (const issue of fileIssues) {
            this.appliedFixes.push({
              issueId: issue.id,
              applied: !dryRun,
              automatic: true,
              description: `Fixed via ESLint --fix: ${issue.description}`,
              filesChanged: [file],
            });
          }
        } else {
          for (const issue of fileIssues) {
            this.failedFixes.push({
              issueId: issue.id,
              applied: false,
              automatic: true,
              description: `ESLint fix failed: ${issue.description}`,
              filesChanged: [],
              error: result.stderr,
            });
          }
        }
      } catch (error) {
        for (const issue of fileIssues) {
          this.failedFixes.push({
            issueId: issue.id,
            applied: false,
            automatic: true,
            description: `ESLint fix failed: ${issue.description}`,
            filesChanged: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  /**
   * Applique les corrections d'imports (organisation, suppression)
   */
  private async applyImportFixes(issues: Issue[], projectPath: string, dryRun?: boolean): Promise<void> {
    // Grouper par fichier
    const filesMap = new Map<string, Issue[]>();

    for (const issue of issues) {
      const file = issue.location.file;
      if (!filesMap.has(file)) {
        filesMap.set(file, []);
      }
      filesMap.get(file)?.push(issue);
    }

    // Traiter chaque fichier
    for (const [file, fileIssues] of filesMap.entries()) {
      try {
        const content = await readFile(file, 'utf-8');

        // Organiser les imports
        const fixed = await this.organizeImports(content, file);

        // Appliquer les corrections
        if (fixed !== content && !dryRun) {
          await this.ensureDirectoryExists(file);
          await writeFile(file, fixed, 'utf-8');
        }

        for (const issue of fileIssues) {
          this.appliedFixes.push({
            issueId: issue.id,
            applied: !dryRun,
            automatic: true,
            description: `Organized imports in ${file}`,
            filesChanged: [file],
            diff: this.generateDiff(content, fixed),
          });
        }
      } catch (error) {
        for (const issue of fileIssues) {
          this.failedFixes.push({
            issueId: issue.id,
            applied: false,
            automatic: true,
            description: `Failed to organize imports`,
            filesChanged: [file],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  /**
   * Applique une correction individuelle
   */
  private async applySingleFix(issue: Issue, projectPath: string, dryRun?: boolean): Promise<void> {
    const { file, line } = issue.location;

    try {
      const content = await readFile(file, 'utf-8');
      const lines = content.split('\n');

      // corrections spécifiques basées sur le type d'issue
      let fixed = content;

      if (issue.ruleId?.includes('console')) {
        // Supprimer les console.log
        fixed = this.removeConsoleLog(content, line);
      } else if (issue.ruleId?.includes('prefer-const')) {
        // Changer var en const
        fixed = this.varToConst(content, line);
      } else if (issue.ruleId?.includes('eqeqeq')) {
        // Changer == en ===
        fixed = this.equalityToStrict(content, line);
      }

      if (fixed !== content && !dryRun) {
        await this.ensureDirectoryExists(file);
        await writeFile(file, fixed, 'utf-8');
      }

      this.appliedFixes.push({
        issueId: issue.id,
        applied: !dryRun,
        automatic: true,
        description: issue.description,
        filesChanged: [file],
        diff: this.generateDiff(content, fixed),
      });
    } catch (error) {
      this.failedFixes.push({
        issueId: issue.id,
        applied: false,
        automatic: true,
        description: issue.description,
        filesChanged: [file],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Organise les imports d'un fichier
   */
  private async organizeImports(content: string, filePath: string): Promise<string> {
    const lines = content.split('\n');
    const importStatements: string[] = [];
    const otherLines: string[] = [];
    let inImports = true;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
        importStatements.push(line);
      } else if (inImports && trimmed.length === 0) {
        // Continuer à collecter les imports
        continue;
      } else if (importStatements.length > 0 && !trimmed.startsWith('import')) {
        inImports = false;
        otherLines.push(line);
      } else {
        otherLines.push(line);
      }
    }

    // Séparer les imports en groupes
    const externalImports: string[] = [];
    const internalImports: string[] = [];
    const typeImports: string[] = [];

    for (const imp of importStatements) {
      if (imp.includes('type ')) {
        typeImports.push(imp);
      } else if (imp.startsWith('import ') && /from\s+['"`][.@/]/.test(imp)) {
        internalImports.push(imp);
      } else {
        externalImports.push(imp);
      }
    }

    // Trier alphabétiquement
    externalImports.sort();
    internalImports.sort();
    typeImports.sort();

    // Reconstruire le fichier
    const organized: string[] = [];

    if (externalImports.length > 0) {
      organized.push(...externalImports);
    }
    if (internalImports.length > 0) {
      if (externalImports.length > 0) organized.push('');
      organized.push(...internalImports);
    }
    if (typeImports.length > 0) {
      if (externalImports.length > 0 || internalImports.length > 0) organized.push('');
      organized.push(...typeImports);
    }

    if (organized.length > 0) {
      organized.push('');
    }

    organized.push(...otherLines);

    return organized.join('\n');
  }

  /**
   * Supprime un console.log spécifique
   */
  private removeConsoleLog(content: string, line: number): string {
    const lines = content.split('\n');
    if (line > 0 && line <= lines.length) {
      const targetLine = lines[line - 1] ?? '';
      if (/console\.(log|debug|info|warn|error)/.test(targetLine)) {
        lines.splice(line - 1, 1);
        return lines.join('\n');
      }
    }
    return content;
  }

  /**
   * Convertit var en const
   */
  private varToConst(content: string, line: number): string {
    const lines = content.split('\n');
    if (line > 0 && line <= lines.length) {
      const targetLine = lines[line - 1] ?? '';
      lines[line - 1] = targetLine.replace(/\bvar\b/, 'const');
      return lines.join('\n');
    }
    return content;
  }

  /**
   * Convertit == en ===
   */
  private equalityToStrict(content: string, line: number): string {
    const lines = content.split('\n');
    if (line > 0 && line <= lines.length) {
      const targetLine = lines[line - 1] ?? '';
      lines[line - 1] = targetLine.replace(/([^=!])==([^=])/g, '$1===$2');
      lines[line - 1] = lines[line - 1]?.replace(/([^=!])!=([^=])/g, '$1!==$2');
      return lines.join('\n');
    }
    return content;
  }

  /**
   * Crée un backup du projet
   */
  private async createBackup(projectPath: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${projectPath}.backup-${timestamp}`;

    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');

      const execAsync = promisify(exec);
      await execAsync(`cp -r "${projectPath}" "${backupPath}"`);

      this.logger.info(`Created backup at: ${backupPath}`);
    } catch (error) {
      this.logger.warn('Failed to create backup', error);
    }
  }

  /**
   * Génère un diff entre deux contenus
   */
  private generateDiff(original: string, modified: string): string {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');

    const diffs: string[] = [];

    for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
      const orig = originalLines[i];
      const mod = modifiedLines[i];

      if (orig !== mod) {
        if (orig !== undefined) {
          diffs.push(`- ${orig}`);
        }
        if (mod !== undefined) {
          diffs.push(`+ ${mod}`);
        }
      }
    }

    return diffs.join('\n');
  }

  /**
   * Compare les sévérités
   */
  private compareSeverity(a: string, b: string): number {
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    return severityOrder.indexOf(a) - severityOrder.indexOf(b);
  }

  /**
   * S'assure que le répertoire existe
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await mkdir(dir, { recursive: true });
    } catch {
      // Le répertoire existe peut-être déjà
    }
  }

  /**
   * Retourne les corrections appliquées
   */
  getAppliedFixes(): Fix[] {
    return [...this.appliedFixes];
  }

  /**
   * Retourne les corrections échouées
   */
  getFailedFixes(): Fix[] {
    return [...this.failedFixes];
  }

  /**
   * Réinitialise l'état
   */
  reset(): void {
    this.appliedFixes = [];
    this.failedFixes = [];
  }
}
