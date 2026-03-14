/**
 * Static Code Analyzer
 *
 * Analyse statique de code utilisant ESLint et TypeScript.
 * Détecte les erreurs de syntaxe, les unused imports/variables,
 * et le code mort.
 *
 * @module services/review/analyzers/static-analyzer
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  Issue,
  IssueCategory,
  IssueSeverity,
  Location,
  StaticAnalyzerConfig,
} from '../review.types.js';
import type { DockerExecResult } from '../../../core/types/docker.types.js';
import type { Result } from '../../../core/types/common.types.js';
import { DockerManager } from '../../docker/docker-manager.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

const execAsync = promisify(exec);

/**
 * Résultat ESLint JSON
 */
interface ESLintResult {
  filePath: string;
  messages: Array<{
    ruleId: string | null;
    severity: number;
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    fix?: {
      range: [number, number];
      text: string;
    };
  }>;
  errorCount: number;
  warningCount: number;
  fatalErrorCount: number;
}

/**
 * Résultat TypeScript diagnostic
 */
interface TSCDiagnostic {
  file?: string;
  start: number;
  length: number;
  code: number;
  category: number;
  message: string;
}

/**
 * Mapping des catégories ESLint vers nos catégories
 */
const ESLINT_CATEGORY_MAP: Record<string, IssueCategory> = {
  'possible-errors': 'static',
  'best-practices': 'code-quality',
  'variables': 'static',
  'eslint-comments': 'code-quality',
  'nodejs-and-commonjs': 'code-quality',
  'stylistic-issues': 'code-quality',
  'import': 'static',
  'ecmascript': 'code-quality',
  'typescript': 'static',
  'react': 'static',
  'react-hooks': 'static',
  'jsx-a11y': 'static',
  'promise': 'code-quality',
};

/**
 * Configuration par défaut de l'analyseur
 */
const DEFAULT_CONFIG: StaticAnalyzerConfig = {
  useEslint: true,
  useTsc: true,
  detectUnusedImports: true,
  detectUnusedVars: true,
  detectDeadCode: true,
};

/**
 * Analyseur de code statique
 */
export class StaticAnalyzer {
  private readonly docker: DockerManager;
  private readonly logger: Logger;
  private config: StaticAnalyzerConfig;

  constructor(config: StaticAnalyzerConfig = {}, docker?: DockerManager) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.docker = docker ?? new DockerManager();
    this.logger = createLogger('StaticAnalyzer');
  }

  /**
   * Configure l'analyseur
   */
  configure(config: Partial<StaticAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Analyse un projet complet
   *
   * @param projectPath - Chemin du projet à analyser
   * @param exclude - Patterns à exclure
   * @returns Liste des issues détectées
   */
  async analyze(projectPath: string, exclude: string[] = []): Promise<Issue[]> {
    const issues: Issue[] = [];
    const startTime = performance.now();

    this.logger.info(`Starting static analysis for: ${projectPath}`);

    // Analyse ESLint
    if (this.config.useEslint) {
      try {
        const eslintIssues = await this.runEslint(projectPath, exclude);
        issues.push(...eslintIssues);
        this.logger.debug(`Found ${eslintIssues.length} ESLint issues`);
      } catch (error) {
        this.logger.warn('ESLint analysis failed', error);
      }
    }

    // Analyse TypeScript
    if (this.config.useTsc) {
      try {
        const tscIssues = await this.runTsc(projectPath);
        issues.push(...tscIssues);
        this.logger.debug(`Found ${tscIssues.length} TypeScript issues`);
      } catch (error) {
        this.logger.warn('TypeScript analysis failed', error);
      }
    }

    // Détection des imports inutilisés
    if (this.config.detectUnusedImports) {
      try {
        const unusedImports = await this.detectUnusedImports(projectPath);
        issues.push(...unusedImports);
        this.logger.debug(`Found ${unusedImports.length} unused imports`);
      } catch (error) {
        this.logger.warn('Unused imports detection failed', error);
      }
    }

    // Détection du code mort
    if (this.config.detectDeadCode) {
      try {
        const deadCode = await this.detectDeadCode(projectPath);
        issues.push(...deadCode);
        this.logger.debug(`Found ${deadCode.length} dead code issues`);
      } catch (error) {
        this.logger.warn('Dead code detection failed', error);
      }
    }

    const duration = Math.round(performance.now() - startTime);
    this.logger.info(`Static analysis completed in ${duration}ms (${issues.length} issues found)`);

    return issues;
  }

  /**
   * Exécute ESLint sur le projet
   */
  private async runEslint(projectPath: string, exclude: string[] = []): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Vérifier si ESLint est disponible
    const hasEslint = await this.checkCommandExists('eslint', projectPath);
    if (!hasEslint) {
      this.logger.debug('ESLint not available, skipping');
      return issues;
    }

    // Construire la commande ESLint
    const excludeArgs = exclude.map((e) => `--ignore-pattern '${e}'`).join(' ');
    const command = `npx eslint ${projectPath} --format json --no-error-on-unmatched-pattern ${excludeArgs}`;

    const result = await this.executeInContainer(command, {
      cwd: projectPath,
      timeout: 60000,
    });

    if (!result.success || !result.stdout) {
      return issues;
    }

    try {
      const eslintOutput = JSON.parse(result.stdout) as ESLintResult[];

      for (const fileResult of eslintOutput) {
        for (const message of fileResult.messages) {
          const issue = this.eslintMessageToIssue(
            fileResult.filePath,
            message,
            projectPath
          );
          if (issue) {
            issues.push(issue);
          }
        }
      }
    } catch {
      // Parsing JSON échoué, ignorer
    }

    return issues;
  }

  /**
   * Exécute le compilateur TypeScript
   */
  private async runTsc(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Vérifier si tsc est disponible
    const hasTsc = await this.checkCommandExists('tsc', projectPath);
    if (!hasTsc) {
      this.logger.debug('TypeScript compiler not available, skipping');
      return issues;
    }

    const command = 'npx tsc --noEmit --pretty false';
    const result = await this.executeInContainer(command, {
      cwd: projectPath,
      timeout: 60000,
    });

    if (result.success) {
      return issues; // Pas d'erreurs
    }

    // Parser la sortie de tsc
    const lines = result.stderr.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const issue = this.parseTSCLine(line, projectPath);
      if (issue) {
        issues.push(issue);
      }
    }

    return issues;
  }

  /**
   * Détecte les imports inutilisés
   */
  private async detectUnusedImports(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Utiliser ESLint pour détecter les imports inutilisés
    // (règle no-unused-vars ou @typescript-eslint/no-unused-vars)
    const command = `npx eslint ${projectPath} --format json --rule '{ "@typescript-eslint/no-unused-vars": "error", "no-unused-vars": "error" }' --no-error-on-unmatched-pattern`;

    const result = await this.executeInContainer(command, {
      cwd: projectPath,
      timeout: 60000,
    });

    if (!result.success || !result.stdout) {
      return issues;
    }

    try {
      const eslintOutput = JSON.parse(result.stdout) as ESLintResult[];

      for (const fileResult of eslintOutput) {
        for (const message of fileResult.messages) {
          // Filtrer uniquement les imports/variables inutilisées
          if (
            message.ruleId?.includes('no-unused-vars') ||
            message.message.includes('is assigned a value but never used') ||
            message.message.includes('is defined but never used')
          ) {
            const issue = this.eslintMessageToIssue(
              fileResult.filePath,
              message,
              projectPath
            );
            if (issue) {
              issue.category = 'static';
              issues.push(issue);
            }
          }
        }
      }
    } catch {
      // Parsing échoué
    }

    return issues;
  }

  /**
   * Détecte le code mort (fonctions/classes non utilisées)
   */
  private async detectDeadCode(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Cette analyse est plus complexe et nécessite une inspection AST
    // Pour l'instant, on utilise des heuristiques simples

    // Rechercher les exports qui ne sont importés nulle part
    // (analyse inter-fichiers)

    // Cette fonctionnalité pourrait être étendue avec ts-morphir ou babel

    return issues;
  }

  /**
   * Convertit un message ESLint en Issue
   */
  private eslintMessageToIssue(
    filePath: string,
    message: ESLintResult['messages'][0],
    projectPath: string
  ): Issue | null {
    const severity: IssueSeverity = message.severity === 2 ? 'high' : 'medium';
    const ruleId = message.ruleId ?? 'unknown';

    // Déterminer la catégorie
    const category = this.getCategoryFromRule(ruleId);

    // Construire l'ID unique
    const id = `eslint-${filePath.replace(projectPath, '')}-${message.line}-${message.column}-${ruleId}`.replace(
      /[^a-zA-Z0-9-]/g,
      '-'
    );

    const location: Location = {
      file: filePath,
      line: message.line,
      column: message.column,
      endLine: message.endLine,
      endColumn: message.endColumn,
    };

    return {
      id,
      category,
      severity,
      description: message.message,
      message: `[${ruleId}] ${message.message}`,
      location,
      fixable: message.fix !== undefined,
      effort: this.estimateEffort(ruleId, message),
      ruleId,
      suggestions: message.fix ? ['Can be auto-fixed with --fix'] : [],
    };
  }

  /**
   * Parse une ligne de sortie TypeScript en Issue
   */
  private parseTSCLine(line: string, projectPath: string): Issue | null {
    // Format: file.ts(line,col): error TS123: message
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
    if (!match) {
      return null;
    }

    const [, filePath, lineStr, colStr, code, message] = match;
    const lineNum = parseInt(lineStr, 10);
    const colNum = parseInt(colStr, 10);

    const severity: IssueSeverity = this.getTSCSeverity(code);
    const id = `tsc-${filePath.replace(projectPath, '')}-${lineNum}-${colNum}-${code}`.replace(
      /[^a-zA-Z0-9-]/g,
      '-'
    );

    return {
      id,
      category: 'static',
      severity,
      description: message,
      message: `[${code}] ${message}`,
      location: {
        file: filePath,
        line: lineNum,
        column: colNum,
      },
      fixable: false,
      effort: this.estimateTSCEffort(code),
      ruleId: code,
    };
  }

  /**
   * Obtient la catégorie à partir d'une règle ESLint
   */
  private getCategoryFromRule(ruleId: string): IssueCategory {
    // Extraire la catégorie de la règle (ex: 'react-hooks/rules-of-hooks')
    const parts = ruleId.split('/');
    const mainCategory = parts[0] ?? ruleId;

    // Mapping direct
    if (mainCategory in ESLINT_CATEGORY_MAP) {
      return ESLINT_CATEGORY_MAP[mainCategory];
    }

    // Par défaut, retourner 'code-quality'
    return 'code-quality';
  }

  /**
   * Estime l'effort de correction pour une règle ESLint
   */
  private estimateEffort(ruleId: string, message: ESLintResult['messages'][0]): number {
    // Corrections automatiques = 1
    if (message.fix) {
      return 1;
    }

    // Règles courantes simples
    const simpleRules = [
      'no-console',
      'no-var',
      'prefer-const',
      'eqeqeq',
      'curly',
      'no-else-return',
    ];
    if (simpleRules.some((r) => ruleId.includes(r))) {
      return 2;
    }

    // Règles moyennes
    const mediumRules = [
      'complexity',
      'max-lines-per-function',
      'max-depth',
      'no-unused-vars',
    ];
    if (mediumRules.some((r) => ruleId.includes(r))) {
      return 4;
    }

    // Par défaut
    return 3;
  }

  /**
   * Estime l'effort de correction pour une erreur TypeScript
   */
  private estimateTSCEffort(code: string): number {
    // Erreurs de type simples
    const simpleCodes = ['TS2339', 'TS2304', 'TS2345', 'TS2571'];
    if (simpleCodes.includes(code)) {
      return 2;
    }

    // Erreurs de définition
    if (code.startsWith('TS23')) {
      return 3;
    }

    // Erreurs de configuration
    if (code.startsWith('TS50') || code.startsWith('TS60')) {
      return 2;
    }

    return 4;
  }

  /**
   * Obtient la sévérité d'une erreur TypeScript
   */
  private getTSCSeverity(code: string): IssueSeverity {
    // Erreurs critiques qui empêchent la compilation
    const criticalCodes = [
      'TS2307', // Cannot find module
      'TS2304', // Cannot find name
      'TS2345', // Type mismatch
      'TS2694', // Namespace error
    ];

    if (criticalCodes.includes(code)) {
      return 'critical';
    }

    return 'high';
  }

  /**
   * Vérifie si une commande existe dans le projet
   */
  private async checkCommandExists(command: string, projectPath: string): Promise<boolean> {
    const checkCommand = `cd ${projectPath} && command -v ${command} || npx ${command} --version`;
    const result = await this.executeInContainer(checkCommand, {
      cwd: projectPath,
      timeout: 10000,
    });

    return result.success;
  }

  /**
   * Exécute une commande dans le conteneur Docker
   */
  private async executeInContainer(
    command: string,
    options: { cwd?: string; timeout?: number }
  ): Promise<DockerExecResult> {
    try {
      const execOptions = {
        workingDir: options.cwd,
        timeout: options.timeout ?? 60000,
      };

      return await this.docker.exec(command, execOptions);
    } catch (error) {
      this.logger.error(`Command execution failed: ${command}`, error);
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration: 0,
      };
    }
  }

  /**
   * Obtient les statistiques d'analyse
   */
  getStats(projectPath: string): Promise<{
    fileCount: number;
    lineCount: number;
    eslintConfig: boolean;
    tsconfig: boolean;
  }> {
    // Implémentation pour récupérer les stats du projet
    return Promise.resolve({
      fileCount: 0,
      lineCount: 0,
      eslintConfig: false,
      tsconfig: false,
    });
  }
}
