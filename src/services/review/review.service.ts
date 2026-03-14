/**
 * Review Service
 *
 * Service principal d'orchestration du review et fix:
 * - Analyse complète du projet
 * - Application des corrections automatiques
 * - Analyse et fix en une passe
 * - Génération de rapports
 *
 * @module services/review/review.service
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type {
  Issue,
  ReviewResult,
  ReviewOptions,
  FixResult,
  FixOptions,
  ReportOptions,
  ReportFormat,
} from './review.types.js';
import { StaticAnalyzer } from './analyzers/static-analyzer.js';
import { SecurityAnalyzer } from './analyzers/security-analyzer.js';
import { DependencyAnalyzer } from './analyzers/dependency-analyzer.js';
import { PerformanceAnalyzer } from './analyzers/performance-analyzer.js';
import { AutoFixer } from './fixers/auto-fixer.js';
import { TestGenerator } from './fixers/test-generator.js';
import { RefactorSuggester } from './fixers/refactor-suggester.js';
import { ScoreReporter } from './reporters/score-reporter.js';
import { FixReporter } from './reporters/fix-reporter.js';
import { DockerManager } from '../docker/docker-manager.js';
import { createLogger, type Logger } from '@/shared/utils/logger.js';

/**
 * Options par défaut pour le review
 */
const DEFAULT_REVIEW_OPTIONS: Required<Omit<ReviewOptions, 'categories' | 'exclude' | 'include'>> = {
  minSeverity: 'low',
  maxFiles: 1000,
  analyzers: {
    static: true,
    security: true,
    dependency: true,
    performance: true,
    testing: true,
  },
  timeout: 300000,
  useCache: true,
  compareWithPrevious: true,
};

/**
 * Options par défaut pour le fix
 */
const DEFAULT_FIX_OPTIONS: FixOptions = {
  autoApply: true,
  maxSeverity: 'medium',
  maxEffort: 5,
  createBackup: true,
  generateTests: false,
  dryRun: false,
  ignore: [],
};

/**
 * Service de Review et Fix
 */
export class ReviewService {
  private readonly docker: DockerManager;
  private readonly logger: Logger;
  private staticAnalyzer: StaticAnalyzer;
  private securityAnalyzer: SecurityAnalyzer;
  private dependencyAnalyzer: DependencyAnalyzer;
  private performanceAnalyzer: PerformanceAnalyzer;
  private autoFixer: AutoFixer;
  private testGenerator: TestGenerator;
  private refactorSuggester: RefactorSuggester;
  private scoreReporter: ScoreReporter;
  private fixReporter: FixReporter;

  constructor(docker?: DockerManager) {
    this.docker = docker ?? new DockerManager();
    this.logger = createLogger('ReviewService');

    // Initialiser les analyseurs
    this.staticAnalyzer = new StaticAnalyzer({}, this.docker);
    this.securityAnalyzer = new SecurityAnalyzer({}, this.docker);
    this.dependencyAnalyzer = new DependencyAnalyzer({}, this.docker);
    this.performanceAnalyzer = new PerformanceAnalyzer({}, this.docker);

    // Initialiser les fixers
    this.autoFixer = new AutoFixer(this.docker);
    this.testGenerator = new TestGenerator(this.docker);
    this.refactorSuggester = new RefactorSuggester(this.docker);

    // Initialiser les reporters
    this.scoreReporter = new ScoreReporter();
    this.fixReporter = new FixReporter();
  }

  /**
   * Analyse complète d'un projet
   *
   * @param projectPath - Chemin du projet à analyser
   * @param options - Options d'analyse
   * @returns Résultat de l'analyse
   */
  async review(projectPath: string, options: ReviewOptions = {}): Promise<ReviewResult> {
    const startTime = globalThis.performance.now();
    const mergedOptions = { ...DEFAULT_REVIEW_OPTIONS, ...options };

    this.logger.info(`Starting review for: ${projectPath}`);

    // Vérifier que le projet existe
    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // S'assurer que le conteneur Docker est prêt
    await this.docker.setup({ silent: true });

    const issues: Issue[] = [];
    let coverage, dependencies, performance;

    // Analyse statique
    if (mergedOptions.analyzers.static) {
      this.logger.info('Running static analysis...');
      try {
        const staticIssues = await this.staticAnalyzer.analyze(
          projectPath,
          mergedOptions.exclude ?? []
        );
        issues.push(...staticIssues);
      } catch (error) {
        this.logger.warn('Static analysis failed', error);
      }
    }

    // Analyse de sécurité
    if (mergedOptions.analyzers.security) {
      this.logger.info('Running security analysis...');
      try {
        const securityIssues = await this.securityAnalyzer.analyze(
          projectPath,
          mergedOptions.exclude ?? []
        );
        issues.push(...securityIssues);
      } catch (error) {
        this.logger.warn('Security analysis failed', error);
      }
    }

    // Analyse des dépendances
    if (mergedOptions.analyzers.dependency) {
      this.logger.info('Running dependency analysis...');
      try {
        const { analysis: depAnalysis, issues: depIssues } =
          await this.dependencyAnalyzer.analyze(projectPath);
        dependencies = depAnalysis;
        issues.push(...depIssues);
      } catch (error) {
        this.logger.warn('Dependency analysis failed', error);
      }
    }

    // Analyse des performances
    if (mergedOptions.analyzers.performance) {
      this.logger.info('Running performance analysis...');
      try {
        const { metrics: perfMetrics, issues: perfIssues } =
          await this.performanceAnalyzer.analyze(projectPath);
        performance = perfMetrics;
        issues.push(...perfIssues);
      } catch (error) {
        this.logger.warn('Performance analysis failed', error);
      }
    }

    // Filtrer les issues par sévérité
    const filteredIssues = this.filterBySeverity(issues, mergedOptions.minSeverity);

    // Filtrer par catégories si spécifié
    const categorizedIssues = mergedOptions.categories
      ? filteredIssues.filter((i) => mergedOptions.categories?.includes(i.category))
      : filteredIssues;

    // Générer les suggestions de refactoring
    const suggestions = await this.refactorSuggester.analyze(projectPath, mergedOptions.exclude ?? []);

    // Calculer le score
    const previousScore = mergedOptions.compareWithPrevious
      ? await this.loadPreviousScore(projectPath)
      : undefined;
    const score = this.scoreReporter.calculateScore(categorizedIssues, previousScore);

    const duration = Math.round(globalThis.performance.now() - startTime);

    this.logger.info(
      `Review completed in ${duration}ms (${categorizedIssues.length} issues, score: ${score.overall}/100)`
    );

    return {
      projectPath,
      timestamp: new Date(),
      duration,
      score,
      issues: categorizedIssues,
      fixes: [],
      suggestions,
      coverage,
      dependencies,
      performance,
      summary: {
        totalIssues: categorizedIssues.length,
        fixableIssues: categorizedIssues.filter((i) => i.fixable).length,
        fixedIssues: 0,
        suggestions: suggestions.length,
      },
    };
  }

  /**
   * Applique les corrections sur une liste d'issues
   *
   * @param projectPath - Chemin du projet
   * @param issues - Liste des issues à corriger
   * @param options - Options de correction
   * @returns Résultat des corrections
   */
  async fix(projectPath: string, issues: Issue[], options: FixOptions = {}): Promise<FixResult> {
    const startTime = performance.now();
    const mergedOptions = { ...DEFAULT_FIX_OPTIONS, ...options };

    this.logger.info(`Starting auto-fix for ${issues.length} issues`);

    // Filtrer les issues corrigibles
    const fixableIssues = issues.filter((i) => i.fixable && !mergedOptions.ignore?.includes(i.id));

    if (fixableIssues.length === 0) {
      this.logger.info('No fixable issues found');
      return {
        success: true,
        attempted: 0,
        applied: 0,
        failed: 0,
        fixes: [],
        remainingSuggestions: [],
        duration: 0,
      };
    }

    // Appliquer les corrections automatiques
    const fixes = await this.autoFixer.applyFixes(fixableIssues, projectPath, {
      dryRun: mergedOptions.dryRun,
      maxSeverity: mergedOptions.maxSeverity,
      maxEffort: mergedOptions.maxEffort,
      createBackup: mergedOptions.createBackup,
    });

    const applied = fixes.filter((f) => f.applied).length;
    const failed = fixes.filter((f) => !f.applied).length;

    // Générer des tests si demandé
    if (mergedOptions.generateTests) {
      this.logger.info('Generating tests for uncovered code...');
      try {
        await this.testGenerator.generateTests(projectPath, {
          framework: 'vitest',
          dryRun: mergedOptions.dryRun,
        });
      } catch (error) {
        this.logger.warn('Test generation failed', error);
      }
    }

    const duration = Math.round(globalThis.performance.now() - startTime);

    this.logger.info(`Auto-fix completed: ${applied} applied, ${failed} failed`);

    return {
      success: failed === 0,
      attempted: fixes.length,
      applied,
      failed,
      fixes,
      remainingSuggestions: [],
      duration,
    };
  }

  /**
   * Analyse et corrige en une seule passe
   *
   * @param projectPath - Chemin du projet
   * @param reviewOptions - Options d'analyse
   * @param fixOptions - Options de correction
   * @returns Résultat complet avec corrections appliquées
   */
  async analyzeAndFix(
    projectPath: string,
    reviewOptions: ReviewOptions = {},
    fixOptions: FixOptions = {}
  ): Promise<ReviewResult> {
    this.logger.info(`Starting analyze-and-fix for: ${projectPath}`);

    // 1. Analyser
    const reviewResult = await this.review(projectPath, reviewOptions);

    // 2. Corriger les issues corrigibles
    const fixableIssues = reviewResult.issues.filter((i) => i.fixable);

    if (fixableIssues.length > 0) {
      const fixResult = await this.fix(projectPath, fixableIssues, fixOptions);

      // Mettre à jour le résultat avec les corrections
      reviewResult.fixes = fixResult.fixes;
      reviewResult.summary.fixedIssues = fixResult.applied;

      // Recalculer le score après corrections
      const remainingIssues = reviewResult.issues.filter((i) => {
        return !fixResult.fixes.find((f) => f.issueId === i.id && f.applied);
      });

      reviewResult.score = this.scoreReporter.calculateScore(remainingIssues);
    }

    return reviewResult;
  }

  /**
   * Génère un rapport d'analyse
   *
   * @param result - Résultat de l'analyse
   * @param format - Format du rapport
   * @param outputPath - Chemin de sortie (optionnel)
   */
  async generateReport(
    result: ReviewResult,
    format: ReportFormat = 'console',
    outputPath?: string
  ): Promise<void> {
    const options: ReportOptions = {
      format,
      outputPath,
      includeSuggestions: true,
      showDelta: true,
      verbosity: 'normal',
    };

    await this.scoreReporter.generateReport(result, options);
  }

  /**
   * Génère un rapport de corrections
   *
   * @param result - Résultat des corrections
   * @param projectPath - Chemin du projet
   * @param format - Format du rapport
   * @param outputPath - Chemin de sortie (optionnel)
   */
  async generateFixReport(
    result: FixResult,
    projectPath: string,
    format: ReportFormat = 'console',
    outputPath?: string,
    suggestions?: any[]
  ): Promise<void> {
    const options: ReportOptions = {
      format,
      outputPath,
      includeSuggestions: true,
      verbosity: 'normal',
    };

    await this.fixReporter.generateReport(result, projectPath, {
      ...options,
      suggestions,
      remainingIssues: result.attempted - result.applied,
    });
  }

  /**
   * Retourne l'analyseur statique
   */
  getStaticAnalyzer(): StaticAnalyzer {
    return this.staticAnalyzer;
  }

  /**
   * Retourne l'analyseur de sécurité
   */
  getSecurityAnalyzer(): SecurityAnalyzer {
    return this.securityAnalyzer;
  }

  /**
   * Retourne l'analyseur de dépendances
   */
  getDependencyAnalyzer(): DependencyAnalyzer {
    return this.dependencyAnalyzer;
  }

  /**
   * Retourne l'analyseur de performance
   */
  getPerformanceAnalyzer(): PerformanceAnalyzer {
    return this.performanceAnalyzer;
  }

  /**
   * Retourne le fixer automatique
   */
  getAutoFixer(): AutoFixer {
    return this.autoFixer;
  }

  /**
   * Retourne le générateur de tests
   */
  getTestGenerator(): TestGenerator {
    return this.testGenerator;
  }

  /**
   * Retourne le suggesteur de refactoring
   */
  getRefactorSuggester(): RefactorSuggester {
    return this.refactorSuggester;
  }

  /**
   * Filtre les issues par sévérité minimum
   */
  private filterBySeverity(
    issues: Issue[],
    minSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  ): Issue[] {
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const minIndex = severityOrder.indexOf(minSeverity);

    return issues.filter((issue) => {
      const index = severityOrder.indexOf(issue.severity);
      return index <= minIndex;
    });
  }

  /**
   * Charge le score précédent depuis le cache
   */
  private async loadPreviousScore(projectPath: string): Promise<any> {
    // Implémentation simple - pourrait être étendue
    return undefined;
  }
}

/**
 * Instance par défaut du service
 */
let defaultService: ReviewService | null = null;

/**
 * Obtient ou crée l'instance par défaut du service
 */
export function getReviewService(docker?: DockerManager): ReviewService {
  if (!defaultService) {
    defaultService = new ReviewService(docker);
  }
  return defaultService;
}

/**
 * Fonction de commodité pour analyser un projet
 */
export async function analyzeProject(
  projectPath: string,
  options?: ReviewOptions
): Promise<ReviewResult> {
  const service = getReviewService();
  return service.review(projectPath, options);
}

/**
 * Fonction de commodité pour analyser et corriger un projet
 */
export async function analyzeAndFixProject(
  projectPath: string,
  reviewOptions?: ReviewOptions,
  fixOptions?: FixOptions
): Promise<ReviewResult> {
  const service = getReviewService();
  return service.analyzeAndFix(projectPath, reviewOptions, fixOptions);
}
