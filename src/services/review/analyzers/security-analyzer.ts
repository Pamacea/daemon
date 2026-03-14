/**
 * Security Analyzer
 *
 * Analyse de sécurité du code détectant:
 * - OWASP Top 10 vulnerabilities
 * - Injections SQL, XSS, CSRF
 * - Problèmes d'authentification/authorization
 * - Exposition de données sensibles
 *
 * @module services/review/analyzers/security-analyzer
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';

import type {
  Issue,
  IssueSeverity,
  Location,
  SecurityAnalyzerConfig,
} from '../review.types.js';
import type { DockerExecResult } from '../../../core/types/docker.types.js';
import { DockerManager } from '../../docker/docker-manager.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Pattern OWASP Top 10 pour détection
 */
const OWASP_PATTERNS: Array<{
  pattern: RegExp;
  description: string;
  severity: IssueSeverity;
  category: string;
  ruleId: string;
}> = [
  // Injection SQL
  {
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+.*?\+\s*['"`]|['"`]\s*\+\s*(?:SELECT|INSERT|UPDATE)/gi,
    description: 'Potential SQL injection via string concatenation',
    severity: 'critical',
    category: 'sql-injection',
    ruleId: 'owasp-sql-injection',
  },
  {
    pattern: /query\(\s*['"`].*?\$\{.*?\}.*?['"`]\s*\)/gi,
    description: 'Potential SQL injection via template literal',
    severity: 'critical',
    category: 'sql-injection',
    ruleId: 'owasp-sql-template-injection',
  },
  // XSS
  {
    pattern: /dangerouslySetInnerHTML|v-html\s*=|innerHTML\s*=\s*\w+/gi,
    description: 'Direct DOM manipulation - potential XSS vulnerability',
    severity: 'high',
    category: 'xss',
    ruleId: 'owasp-xss-dom-manipulation',
  },
  {
    pattern: /document\.write\s*\(|eval\s*\(|Function\s*\(\s*['"`]/gi,
    description: 'Use of dangerous eval/document.write - potential XSS',
    severity: 'critical',
    category: 'xss',
    ruleId: 'owasp-xss-eval',
  },
  // Auth/Authorization
  {
    pattern: /localStorage\.setItem\s*\(\s*['"`](?:password|token|secret|apiKey|credential)/gi,
    description: 'Storing sensitive credentials in localStorage',
    severity: 'high',
    category: 'auth',
    ruleId: 'owasp-credential-storage',
  },
  {
    pattern: /\.env\s*['"`]|process\.env\.(?:PASSWORD|SECRET|KEY|TOKEN)/gi,
    description: 'Potential hardcoded sensitive environment variable',
    severity: 'medium',
    category: 'auth',
    ruleId: 'owasp-hardcoded-secrets',
  },
  // CSRF
  {
    pattern: /fetch\s*\([^,]*,\s*\{[^}]*method:\s*['"`](?:POST|PUT|DELETE|PATCH)/gi,
    description: 'State-changing request without CSRF token check',
    severity: 'medium',
    category: 'csrf',
    ruleId: 'owasp-csrf-fetch',
  },
  // Données sensibles
  {
    pattern: /console\.(log|debug|info|warn|error)\s*\([^)]*password|token|secret|apiKey/gi,
    description: 'Logging sensitive information to console',
    severity: 'medium',
    category: 'data-exposure',
    ruleId: 'owasp-sensitive-logging',
  },
];

/**
 * Extensions de fichiers à analyser pour la sécurité
 */
const SECURITY_FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.svelte',
];

/**
 * Dossiers à exclure de l'analyse de sécurité
 */
const SECURITY_EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'out',
];

/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG: SecurityAnalyzerConfig = {
  owaspTop10: true,
  sqlInjection: true,
  xss: true,
  csrf: true,
  authIssues: true,
  sensitiveData: true,
};

/**
 * Analyseur de sécurité
 */
export class SecurityAnalyzer {
  private readonly docker: DockerManager;
  private readonly logger: Logger;
  private config: SecurityAnalyzerConfig;
  private issueCounter = 0;

  constructor(config: SecurityAnalyzerConfig = {}, docker?: DockerManager) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.docker = docker ?? new DockerManager();
    this.logger = createLogger('SecurityAnalyzer');
  }

  /**
   * Configure l'analyseur
   */
  configure(config: Partial<SecurityAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Analyse un projet pour les vulnérabilités de sécurité
   *
   * @param projectPath - Chemin du projet à analyser
   * @param exclude - Patterns à exclure
   * @returns Liste des issues de sécurité détectées
   */
  async analyze(projectPath: string, exclude: string[] = []): Promise<Issue[]> {
    const issues: Issue[] = [];
    this.issueCounter = 0;
    const startTime = performance.now();

    this.logger.info(`Starting security analysis for: ${projectPath}`);

    // Utiliser npm audit pour les dépendances
    const vulnIssues = await this.runNpmAudit(projectPath);
    issues.push(...vulnIssues);

    // Analyser les fichiers source si OWASP Top 10 est activé
    if (this.config.owaspTop10) {
      const sourceIssues = await this.analyzeSourceFiles(projectPath, exclude);
      issues.push(...sourceIssues);
    }

    // Vérifier les fichiers de configuration
    const configIssues = await this.analyzeConfigFiles(projectPath);
    issues.push(...configIssues);

    const duration = Math.round(performance.now() - startTime);
    this.logger.info(`Security analysis completed in ${duration}ms (${issues.length} issues found)`);

    return issues;
  }

  /**
   * Exécute npm audit pour détecter les dépendances vulnérables
   */
  private async runNpmAudit(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    try {
      const command = 'npm audit --json';
      const result = await this.docker.exec(command, {
        workingDir: projectPath,
        timeout: 60000,
      });

      if (!result.success || !result.stdout) {
        return issues;
      }

      const auditResult = JSON.parse(result.stdout) as NpmAuditResult;

      for (const [vulnId, vuln] of Object.entries(auditResult.vulnerabilities ?? {})) {
        const issue = this.vulnerabilityToIssue(vulnId, vuln, projectPath);
        if (issue) {
          issues.push(issue);
        }
      }
    } catch (error) {
      // npm audit peut échouer s'il n'y a pas de package.json
      this.logger.debug('npm audit failed or no package.json found');
    }

    return issues;
  }

  /**
   * Analyse les fichiers source pour les patterns de sécurité
   */
  private async analyzeSourceFiles(projectPath: string, exclude: string[]): Promise<Issue[]> {
    const issues: Issue[] = [];
    const files = await this.findSourceFiles(projectPath, exclude);

    for (const filePath of files) {
      const fileIssues = await this.analyzeFile(filePath, projectPath);
      issues.push(...fileIssues);
    }

    return issues;
  }

  /**
   * Analyse un fichier spécifique
   */
  private async analyzeFile(filePath: string, projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = relative(projectPath, filePath);

      // Analyser chaque pattern
      for (const patternConfig of OWASP_PATTERNS) {
        // Vérifier si ce pattern doit être analysé
        if (!this.shouldCheckPattern(patternConfig.category)) {
          continue;
        }

        let match: RegExpExecArray | null;
        const patternWithGlobal = new RegExp(patternConfig.pattern.source, patternConfig.pattern.flags + 'g');

        // Réinitialiser l'index du pattern
        patternWithGlobal.lastIndex = 0;

        while ((match = patternWithGlobal.exec(content)) !== null) {
          // Trouver la ligne et la colonne
          const position = this.findPosition(content, match.index);

          const issue: Issue = {
            id: this.generateIssueId('security', relativePath, position.line, patternConfig.ruleId),
            category: 'security',
            severity: patternConfig.severity,
            description: patternConfig.description,
            location: {
              file: filePath,
              line: position.line,
              column: position.column,
            },
            code: this.extractCodeSnippet(lines, position.line, 2),
            fixable: false,
            effort: this.estimateSecurityEffort(patternConfig.severity, patternConfig.category),
            ruleId: patternConfig.ruleId,
            docs: this.getSecurityDocs(patternConfig.category),
          };

          issues.push(issue);
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to analyze file: ${filePath}`, error);
    }

    return issues;
  }

  /**
   * Analyse les fichiers de configuration pour les problèmes de sécurité
   */
  private async analyzeConfigFiles(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Vérifier .env files
    const envIssues = await this.checkEnvFiles(projectPath);
    issues.push(...envIssues);

    // Vérifier les fichiers de configuration CORS
    const corsIssues = await this.checkCorsConfig(projectPath);
    issues.push(...corsIssues);

    return issues;
  }

  /**
   * Vérifie les fichiers .env
   */
  private async checkEnvFiles(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];

    for (const envFile of envFiles) {
      const filePath = join(projectPath, envFile);

      try {
        await access(filePath, constants.F_OK);
        const content = await readFile(filePath, 'utf-8');

        // Vérifier si le fichier contient des valeurs sensibles non placeholder
        const sensitivePatterns = [
          /password\s*=\s*[^*#]+/i,
          /secret\s*=\s*[^*#]+/i,
          /api_key\s*=\s*[^*#]+/i,
          /token\s*=\s*[^*#]+/i,
        ];

        for (const pattern of sensitivePatterns) {
          if (pattern.test(content)) {
            issues.push({
              id: this.generateIssueId('security', envFile, 1, 'env-sensitive-data'),
              category: 'security',
              severity: 'high',
              description: 'Sensitive data might be committed in .env file',
              message: 'The .env file contains potentially sensitive data. Use placeholder values.',
              location: {
                file: filePath,
                line: 1,
              },
              fixable: false,
              effort: 2,
              ruleId: 'env-sensitive-data',
            });
            break;
          }
        }
      } catch {
        // Fichier n'existe pas ou n'est pas accessible
      }
    }

    return issues;
  }

  /**
   * Vérifie la configuration CORS
   */
  private async checkCorsConfig(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Chercher des configurations CORS permissives dans les fichiers
    const corsFiles = [
      'src/server.js',
      'src/app.js',
      'src/index.js',
      'src/main.ts',
      'src/server.ts',
      'src/app.ts',
      'src/index.ts',
    ];

    for (const corsFile of corsFiles) {
      const filePath = join(projectPath, corsFile);

      try {
        const content = await readFile(filePath, 'utf-8');

        // Chercher origin: '*'
        if (/origin:\s*['"`]\*['"`]|origin:\s*\*/.test(content)) {
          const lines = content.split('\n');
          let lineNum = 0;
          for (let i = 0; i < lines.length; i++) {
            if (/origin:\s*['"`]\*['"`]|origin:\s*\*/.test(lines[i] ?? '')) {
              lineNum = i + 1;
              break;
            }
          }

          issues.push({
            id: this.generateIssueId('security', corsFile, lineNum, 'cors-permissive'),
            category: 'security',
            severity: 'medium',
            description: 'Permissive CORS configuration allows all origins',
            location: {
              file: filePath,
              line: lineNum,
            },
            fixable: true,
            effort: 2,
            ruleId: 'cors-permissive',
          });
        }
      } catch {
        // Fichier n'existe pas
      }
    }

    return issues;
  }

  /**
   * Trouve tous les fichiers source à analyser
   */
  private async findSourceFiles(projectPath: string, exclude: string[]): Promise<string[]> {
    const files: string[] = [];

    const traverse = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          // Vérifier les exclusions
          if (SECURITY_EXCLUDE_DIRS.includes(entry.name) || exclude.some((e) => fullPath.includes(e))) {
            continue;
          }

          if (entry.isDirectory()) {
            await traverse(fullPath);
          } else if (entry.isFile()) {
            const ext = `.${entry.name.split('.').pop()}`;
            if (SECURITY_FILE_EXTENSIONS.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Ignorer les erreurs d'accès
      }
    };

    await traverse(projectPath);
    return files;
  }

  /**
   * Vérifie si un pattern de sécurité doit être analysé
   */
  private shouldCheckPattern(category: string): boolean {
    switch (category) {
      case 'sql-injection':
        return this.config.sqlInjection ?? true;
      case 'xss':
        return this.config.xss ?? true;
      case 'csrf':
        return this.config.csrf ?? true;
      case 'auth':
        return this.config.authIssues ?? true;
      case 'data-exposure':
        return this.config.sensitiveData ?? true;
      default:
        return this.config.owaspTop10 ?? true;
    }
  }

  /**
   * Convertit une vulnérabilité npm en Issue
   */
  private vulnerabilityToIssue(vulnId: string, vuln: NpmVulnerability, projectPath: string): Issue | null {
    const severity = this.npmSeverityToIssueSeverity(vuln.severity);

    return {
      id: this.generateIssueId('npm-audit', vulnId, 0, vulnId),
      category: 'security',
      severity,
      description: `${vuln.name} (${vulnId})`,
      message: vuln.title ?? `Vulnerability in ${vuln.name}`,
      location: {
        file: join(projectPath, 'package.json'),
        line: 1,
      },
      fixable: vuln.fixAvailable !== undefined,
      effort: vuln.fixAvailable ? 2 : 5,
      ruleId: vulnId,
      docs: vuln.url ? [vuln.url] : undefined,
      suggestions: vuln.fixAvailable
        ? [`Update to ${vuln.fixAvailable.version}`]
        : ['Check for patched version'],
    };
  }

  /**
   * Convertit la sévérité npm en IssueSeverity
   */
  private npmSeverityToIssueSeverity(severity: string): IssueSeverity {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'moderate':
        return 'medium';
      case 'low':
      default:
        return 'low';
    }
  }

  /**
   * Estime l'effort de correction pour une issue de sécurité
   */
  private estimateSecurityEffort(severity: IssueSeverity, category: string): number {
    if (severity === 'critical') {
      return category === 'sql-injection' || category === 'xss' ? 8 : 6;
    }
    if (severity === 'high') {
      return 5;
    }
    return 3;
  }

  /**
   * Génère un ID unique pour l'issue
   */
  private generateIssueId(prefix: string, file: string, line: number, rule: string): string {
    return `${prefix}-${file.replace(/[^a-zA-Z0-9]/g, '-')}-${line}-${rule}`.substring(0, 100);
  }

  /**
   * Trouve la position ligne/colonne à partir d'un index dans le contenu
   */
  private findPosition(content: string, index: number): { line: number; column: number } {
    const before = content.substring(0, index);
    const lines = before.split('\n');
    return {
      line: lines.length,
      column: (lines[lines.length - 1] ?? '').length + 1,
    };
  }

  /**
   * Extrait un extrait de code autour d'une ligne
   */
  private extractCodeSnippet(lines: string[], targetLine: number, context: number): string {
    const start = Math.max(0, targetLine - context - 1);
    const end = Math.min(lines.length, targetLine + context);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Retourne la documentation de sécurité pour une catégorie
   */
  private getSecurityDocs(category: string): string[] {
    const docsMap: Record<string, string[]> = {
      'sql-injection': [
        'https://owasp.org/www-community/attacks/SQL_Injection',
        'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
      ],
      xss: [
        'https://owasp.org/www-community/attacks/xss/',
        'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
      ],
      csrf: [
        'https://owasp.org/www-community/attacks/csrf',
        'https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html',
      ],
      auth: [
        'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
        'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html',
      ],
    };

    return docsMap[category] ?? ['https://owasp.org/www-project-top-ten/'];
  }
}

/**
 * Résultat npm audit
 */
interface NpmAuditResult {
  vulnerabilities: Record<string, NpmVulnerability>;
}

/**
 * Vulnérabilité npm
 */
interface NpmVulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title?: string;
  url?: string;
  fixAvailable?: {
    version: string;
    isSemVerMajor: boolean;
  };
}
