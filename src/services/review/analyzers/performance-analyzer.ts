/**
 * Performance Analyzer
 *
 * Analyse les problèmes de performance:
 * - Taille du bundle
 * - Opportunités de lazy loading
 * - Re-renders inutiles (React)
 * - Requêtes N+1
 * - Index manquants
 *
 * @module services/review/analyzers/performance-analyzer
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { access, constants } from 'node:fs/promises';

import type {
  Issue,
  PerformanceMetrics,
  Location,
  PerformanceAnalyzerConfig,
} from '../review.types.js';
import type { DockerExecResult } from '../../../core/types/docker.types.js';
import { DockerManager } from '../../docker/docker-manager.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Extensions de fichiers source
 */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];

/**
 * Dossiers à exclure
 */
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', 'out'];

/**
 * Patterns de code indiquant un manque de lazy loading
 */
const LAZY_LOAD_PATTERNS = [
  {
    pattern: /import\s+.*?\s+from\s+['"`](?![@\.]).*?['"`]/g,
    description: 'Eager import of library component',
    suggestion: 'Use dynamic import() for code splitting',
  },
  {
    pattern: /lazy\s*=\s*false|Suspense.*?fallback\s*=\s*null/g,
    description: 'Explicit lazy loading disabled',
    suggestion: 'Enable lazy loading for better initial load time',
  },
];

/**
 * Patterns React pour détecter les re-renders inutiles
 */
const RE_RENDER_PATTERNS = [
  {
    pattern: /useState\s*\(\[\]\)/g,
    description: 'Array state without memo',
    suggestion: 'Use useMemo if array is used in dependencies',
  },
  {
    pattern: /new\s+(?:Array|Object|Date)\s*\([^)]*\)\s*[,\)]/g,
    description: 'Creating new object/array in render',
    suggestion: 'Move to useMemo or outside component',
  },
  {
    pattern: /function\s+\w+\s*\([^)]*\)\s*\{[^}]*\{[^}]*\.map\s*\(/g,
    description: 'Inline function with map in render',
    suggestion: 'Extract component or use useCallback',
  },
];

/**
 * Patterns de requêtes N+1
 */
const N_PLUS_ONE_PATTERNS = [
  {
    pattern: /forEach.*?(?:find|query|fetch|select)/gi,
    description: 'Query inside forEach loop - potential N+1',
    suggestion: 'Use batch loading or include relations',
  },
  {
    pattern: /for\s*\([^)]*\)\s*\{[^}]*?(?:find|query|fetch|select)/gi,
    description: 'Query inside for loop - potential N+1',
    suggestion: 'Use batch loading or include relations',
  },
  {
    pattern: /\.map\s*\([^)]*\)\s*=>\s*\{[^}]*?(?:find|query|fetch|select)/gi,
    description: 'Query inside map - potential N+1',
    suggestion: 'Use batch loading or include relations',
  },
];

/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG: PerformanceAnalyzerConfig = {
  analyzeBundleSize: true,
  detectLazyOpportunities: true,
  detectRerenders: true,
  detectNPlusOne: true,
  detectMissingIndexes: true,
};

/**
 * Analyseur de performance
 */
export class PerformanceAnalyzer {
  private readonly docker: DockerManager;
  private readonly logger: Logger;
  private config: PerformanceAnalyzerConfig;
  private issueCounter = 0;

  constructor(config: PerformanceAnalyzerConfig = {}, docker?: DockerManager) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.docker = docker ?? new DockerManager();
    this.logger = createLogger('PerformanceAnalyzer');
  }

  /**
   * Configure l'analyseur
   */
  configure(config: Partial<PerformanceAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Analyse les performances d'un projet
   *
   * @param projectPath - Chemin du projet à analyser
   * @returns Métriques de performance et issues
   */
  async analyze(projectPath: string): Promise<{ metrics: PerformanceMetrics; issues: Issue[] }> {
    this.issueCounter = 0;
    const startTime = performance.now();

    this.logger.info(`Starting performance analysis for: ${projectPath}`);

    const metrics: PerformanceMetrics = {
      lazyLoadingOpportunities: 0,
      unnecessaryRerenders: 0,
      nPlusOneQueries: [],
      missingIndexes: [],
      lazyComponents: [],
    };

    const issues: Issue[] = [];

    // Analyser la taille du bundle
    if (this.config.analyzeBundleSize) {
      const bundleSize = await this.analyzeBundleSize(projectPath);
      metrics.bundleSize = bundleSize;

      if (bundleSize.total > 500_000) {
        // 500 KB warning threshold
        issues.push({
          id: this.generateIssueId('bundle-size'),
          category: 'performance',
          severity: bundleSize.total > 1_000_000 ? 'high' : 'medium',
          description: 'Large bundle size detected',
          message: `Total bundle size is ${this.formatBytes(bundleSize.total)}. Consider code splitting and tree shaking.`,
          location: {
            file: join(projectPath, 'package.json'),
            line: 1,
          },
          fixable: false,
          effort: 6,
          suggestions: [
            'Implement code splitting with dynamic imports',
            'Use bundle analyzer to identify large modules',
            'Remove unused dependencies',
            'Enable tree shaking in bundler config',
          ],
        });
      }
    }

    // Détecter les opportunités de lazy loading
    if (this.config.detectLazyOpportunities) {
      const lazyIssues = await this.detectLazyLoading(projectPath);
      metrics.lazyLoadingOpportunities = lazyIssues.length;
      issues.push(...lazyIssues);
    }

    // Détecter les re-renders React
    if (this.config.detectRerenders) {
      const rerenderIssues = await this.detectRerenders(projectPath);
      metrics.unnecessaryRerenders = rerenderIssues.length;
      issues.push(...rerenderIssues);
    }

    // Détecter les requêtes N+1
    if (this.config.detectNPlusOne) {
      const nPlusOneIssues = await this.detectNPlusOneQueries(projectPath);
      metrics.nPlusOneQueries = nPlusOneIssues.map((i) => ({
        file: i.location.file,
        line: i.location.line,
        description: i.description,
      }));
      issues.push(...nPlusOneIssues);
    }

    // Détecter les index manquants
    if (this.config.detectMissingIndexes) {
      const missingIndexIssues = await this.detectMissingIndexes(projectPath);
      metrics.missingIndexes = missingIndexIssues.map((i) => ({
        table: i.description.split(' on ')[1]?.split(' ')[0] || 'unknown',
        column: i.description.split(' on ')[1]?.split(' ')[1]?.replace(/[()]/g, '') || 'unknown',
        query: i.message || i.description,
      }));
      issues.push(...missingIndexIssues);
    }

    // Détecter les composants déjà lazy-loadés
    metrics.lazyComponents = await this.findLazyComponents(projectPath);

    const duration = Math.round(performance.now() - startTime);
    this.logger.info(`Performance analysis completed in ${duration}ms (${issues.length} issues found)`);

    return { metrics, issues };
  }

  /**
   * Analyse la taille du bundle
   */
  private async analyzeBundleSize(projectPath: string): Promise<{ js: number; css: number; total: number }> {
    let js = 0;
    let css = 0;

    // Chercher les dossiers de build courants
    const buildDirs = ['dist', 'build', '.next', 'out', '.output'];

    for (const buildDir of buildDirs) {
      const dirPath = join(projectPath, buildDir);

      try {
        await access(dirPath, constants.F_OK);
        const sizes = await this.calculateDirSize(dirPath);
        js += sizes.js;
        css += sizes.css;
      } catch {
        // Dossier n'existe pas
      }
    }

    // Fallback: utiliser next build ou webpack-bundle-analyzer si disponible
    if (js === 0 && css === 0) {
      const estimated = await this.estimateBundleSizeFromDeps(projectPath);
      return { js: estimated, css: 0, total: estimated };
    }

    return { js, css, total: js + css };
  }

  /**
   * Calcule la taille d'un dossier
   */
  private async calculateDirSize(dirPath: string): Promise<{ js: number; css: number }> {
    let js = 0;
    let css = 0;

    const traverse = async (path: string) => {
      try {
        const entries = await readdir(path, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(path, entry.name);

          if (entry.isDirectory()) {
            await traverse(fullPath);
          } else if (entry.isFile()) {
            const ext = entry.name.split('.').pop()?.toLowerCase();
            if (ext === 'js' || ext === 'mjs') {
              try {
                const { stat } = await import('node:fs/promises');
                const stats = await stat(fullPath);
                js += stats.size;
              } catch {
                // Ignore stat errors
              }
            } else if (ext === 'css') {
              try {
                const { stat } = await import('node:fs/promises');
                const stats = await stat(fullPath);
                css += stats.size;
              } catch {
                // Ignore stat errors
              }
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    await traverse(dirPath);
    return { js, css };
  }

  /**
   * Estime la taille du bundle à partir des dépendances
   */
  private async estimateBundleSizeFromDeps(projectPath: string): Promise<number> {
    try {
      const pkgPath = join(projectPath, 'package.json');
      const content = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as PackageJson;

      // Estimations approximatives de tailles de packages populaires
      const packageSizes: Record<string, number> = {
        react: 45000,
        'react-dom': 130000,
        'react-router-dom': 70000,
        '@tanstack/react-query': 55000,
        axios: 35000,
        lodash: 70000,
        'lodash-es': 60000,
        moment: 70000,
        'dayjs': 2000,
        datefns: 28000,
        '@mui/material': 400000,
        '@mui/system': 180000,
        '@chakra-ui/react': 250000,
        framerMotion: 90000,
      };

      let total = 0;
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

      for (const [name, version] of Object.entries(deps)) {
        // Ignorer les @types
        if (name.startsWith('@types/')) {
          continue;
        }

        const baseName = name.split('/').pop() ?? name;
        if (baseName in packageSizes) {
          total += packageSizes[baseName];
        } else {
          // Estimation par défaut
          total += 10000;
        }
      }

      return total;
    } catch {
      return 0;
    }
  }

  /**
   * Détecte les opportunités de lazy loading
   */
  private async detectLazyLoading(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];
    const files = await this.findSourceFiles(projectPath);

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = relative(projectPath, filePath);

        for (const patternConfig of LAZY_LOAD_PATTERNS) {
          let match: RegExpExecArray | null;
          const regex = new RegExp(patternConfig.pattern.source, patternConfig.pattern.flags);

          while ((match = regex.exec(content)) !== null) {
            const position = this.findPosition(content, match.index);

            // Ignorer si déjà dans un lazy context
            const lineContent = lines[position.line - 1] ?? '';
            if (lineContent.includes('dynamic(') || lineContent.includes('React.lazy(')) {
              continue;
            }

            issues.push({
              id: this.generateIssueId(`lazy-${position.line}`),
              category: 'performance',
              severity: 'medium',
              description: patternConfig.description,
              message: patternConfig.suggestion,
              location: {
                file: filePath,
                line: position.line,
                column: position.column,
              },
              code: this.extractCodeSnippet(lines, position.line, 1),
              fixable: true,
              effort: 3,
              suggestions: [patternConfig.suggestion],
            });
          }
        }
      } catch {
        // Erreur de lecture, ignorer
      }
    }

    return issues;
  }

  /**
   * Détecte les re-renders inutiles React
   */
  private async detectRerenders(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];
    const files = await this.findSourceFiles(projectPath);

    // Ne traiter que les fichiers React
    const reactFiles = files.filter((f) => /\.(tsx|jsx|vue)$/.test(f));

    for (const filePath of reactFiles) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = relative(projectPath, filePath);

        for (const patternConfig of RE_RENDER_PATTERNS) {
          let match: RegExpExecArray | null;
          const regex = new RegExp(patternConfig.pattern.source, patternConfig.pattern.flags);

          while ((match = regex.exec(content)) !== null) {
            const position = this.findPosition(content, match.index);

            issues.push({
              id: this.generateIssueId(`rerender-${relativePath}-${position.line}`),
              category: 'performance',
              severity: 'low',
              description: patternConfig.description,
              message: patternConfig.suggestion,
              location: {
                file: filePath,
                line: position.line,
                column: position.column,
              },
              code: this.extractCodeSnippet(lines, position.line, 2),
              fixable: true,
              effort: 4,
              suggestions: [patternConfig.suggestion],
            });
          }
        }
      } catch {
        // Erreur de lecture, ignorer
      }
    }

    return issues;
  }

  /**
   * Détecte les requêtes N+1
   */
  private async detectNPlusOneQueries(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];
    const files = await this.findSourceFiles(projectPath);

    // Filtrer les fichiers backend/API
    const apiFiles = files.filter(
      (f) =>
        f.includes('/api/') ||
        f.includes('/server/') ||
        f.includes('/controllers/') ||
        f.includes('/services/') ||
        f.includes('/lib/db') ||
        f.endsWith('.query.ts') ||
        f.endsWith('.queries.ts')
    );

    for (const filePath of apiFiles) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const patternConfig of N_PLUS_ONE_PATTERNS) {
          let match: RegExpExecArray | null;
          const regex = new RegExp(patternConfig.pattern.source, patternConfig.pattern.flags);

          while ((match = regex.exec(content)) !== null) {
            const position = this.findPosition(content, match.index);

            issues.push({
              id: this.generateIssueId(`nplusone-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}-${position.line}`),
              category: 'performance',
              severity: 'high',
              description: patternConfig.description,
              message: patternConfig.suggestion,
              location: {
                file: filePath,
                line: position.line,
                column: position.column,
              },
              code: this.extractCodeSnippet(lines, position.line, 3),
              fixable: false,
              effort: 6,
              suggestions: [
                patternConfig.suggestion,
                'Use DataLoader pattern',
                'Use JOIN or IN clause for batch queries',
              ],
            });
          }
        }
      } catch {
        // Erreur de lecture, ignorer
      }
    }

    return issues;
  }

  /**
   * Détecte les index manquants (pour Prisma/TypeORM)
   */
  private async detectMissingIndexes(projectPath: string): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Chercher les fichiers Prisma schema
    const schemaFiles = ['schema.prisma', 'prisma/schema.prisma'];

    for (const schemaFile of schemaFiles) {
      const schemaPath = join(projectPath, schemaFile);

      try {
        await access(schemaPath, constants.F_OK);
        const content = await readFile(schemaPath, 'utf-8');

        // Détecter les relations sans index
        const relationPattern = /(\w+)\s+(\w+)\s+@relation\([^)]*\)/g;
        let match: RegExpExecArray | null;

        while ((match = relationPattern.exec(content)) !== null) {
          const fieldName = match[2];
          const lines = content.split('\n');
          const lineNum = content.substring(0, match.index).split('\n').length;

          // Vérifier s'il y a un index sur ce champ
          const hasIndex = /@@index.*?\[.*?['"`]/.test(content) && content.includes(fieldName);
          const hasUnique = content.includes(`@@unique([${fieldName}]`);
          const hasIdIndex = fieldName === 'id' || fieldName.endsWith('Id');

          if (!hasIndex && !hasUnique && !hasIdIndex) {
            issues.push({
              id: this.generateIssueId(`index-${schemaFile}-${fieldName}`),
              category: 'performance',
              severity: 'medium',
              description: `Missing index on foreign key: ${fieldName}`,
              message: `Foreign key field ${fieldName} should be indexed for better query performance.`,
              location: {
                file: schemaPath,
                line: lineNum,
              },
              code: lines[lineNum - 1],
              fixable: true,
              effort: 2,
              suggestions: [`Add @@index([${fieldName}]) to the model`],
            });
          }
        }
      } catch {
        // Schéma non trouvé
      }
    }

    return issues;
  }

  /**
   * Trouve les composants déjà lazy-loadés
   */
  private async findLazyComponents(projectPath: string): Promise<string[]> {
    const lazy: string[] = [];
    const files = await this.findSourceFiles(projectPath);

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');

        if (/dynamic\s*\(|React\.lazy\s*\(|lazy\s*\(\s*\(|import\s*\(/.test(content)) {
          lazy.push(relative(projectPath, filePath));
        }
      } catch {
        // Erreur de lecture
      }
    }

    return lazy;
  }

  /**
   * Trouve tous les fichiers source
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    const traverse = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (EXCLUDE_DIRS.includes(entry.name)) {
            continue;
          }

          if (entry.isDirectory()) {
            await traverse(fullPath);
          } else if (entry.isFile()) {
            const ext = `.${entry.name.split('.').pop()}`;
            if (SOURCE_EXTENSIONS.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Ignorer les erreurs
      }
    };

    await traverse(projectPath);
    return files;
  }

  /**
   * Trouve la position ligne/colonne à partir d'un index
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
   * Extrait un extrait de code
   */
  private extractCodeSnippet(lines: string[], targetLine: number, context: number): string {
    const start = Math.max(0, targetLine - context - 1);
    const end = Math.min(lines.length, targetLine + context);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Formate une taille en octets pour l'affichage
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Génère un ID unique
   */
  private generateIssueId(suffix: string): string {
    return `perf-${suffix}-${++this.issueCounter}`.replace(/[^a-zA-Z0-9-]/g, '-');
  }
}

/**
 * Package.json simplifié
 */
interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
