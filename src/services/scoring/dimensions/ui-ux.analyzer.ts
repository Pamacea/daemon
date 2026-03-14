/**
 * UI/UX Analyzer
 *
 * Analyzes UI/UX quality including responsive design, loading states,
 * error handling UX, form validation feedback, and empty states.
 *
 * @module services/scoring/dimensions/ui-ux
 */

import { readFile, access, readdir } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { existsSync } from 'node:fs';

import type {
  DimensionScore,
  Issue,
  Improvement,
  CodeDimension,
  IssueSeverity,
  IssueCategory,
  ImprovementType,
  Effort,
  Impact,
  DimensionAnalyzerConfig,
} from '../../../core/types/scoring.types.js';
import type { Framework } from '../../../core/types/project.types.js';
import type { ScoringOptions } from '../../../core/types/scoring.types.js';
import { CommandExecutor } from '../../../shared/utils/command-executor.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Loading state pattern types
 */
type LoadingPattern = 'skeleton' | 'spinner' | 'progress' | 'inline';

/**
 * Error handling pattern types
 */
type ErrorPattern = 'boundary' | 'toast' | 'inline' | 'page';

/**
 * Form validation pattern types
 */
type ValidationPattern = 'inline' | 'onblur' | 'onsubmit' | 'realtime';

/**
 * UI/UX metrics
 */
interface UiUxMetrics {
  /** Has responsive design */
  hasResponsiveDesign: boolean;
  /** Breakpoint count */
  breakpointCount: number;
  /** Has loading states */
  hasLoadingStates: boolean;
  /** Loading patterns found */
  loadingPatterns: Set<LoadingPattern>;
  /** Has error handling */
  hasErrorHandling: boolean;
  /** Error patterns found */
  errorPatterns: Set<ErrorPattern>;
  /** Has form validation */
  hasFormValidation: boolean;
  /** Validation patterns found */
  validationPatterns: Set<ValidationPattern>;
  /** Has empty states */
  hasEmptyStates: boolean;
  /** Empty state components found */
  emptyStateCount: number;
}

/**
 * UI/UX analyzer configuration
 */
export interface UiUxAnalyzerOptions {
  /** Check for responsive design */
  checkResponsive?: boolean;
  /** Check for loading states */
  checkLoadingStates?: boolean;
  /** Check for error handling */
  checkErrorHandling?: boolean;
  /** Check for form validation */
  checkFormValidation?: boolean;
  /** Check for empty states */
  checkEmptyStates?: boolean;
}

/**
 * UI/UX Analyzer
 *
 * Evaluates UI/UX quality across multiple dimensions:
 * - Responsive design (viewport meta, media queries)
 * - Loading states (skeletons, spinners)
 * - Error handling UX
 * - Form validation feedback
 * - Empty states
 */
export class UiUxAnalyzer {
  /** Analyzer configuration */
  readonly config: DimensionAnalyzerConfig = {
    dimension: 'ui-ux' as CodeDimension,
    defaultWeight: 0.10,
    estimatedDuration: 20000,
    supportedFrameworks: ['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'Angular', 'Remix', 'SvelteKit', 'Astro', 'Gatsby'],
  };

  private readonly logger: Logger;
  private readonly executor: CommandExecutor;
  private readonly _checkResponsive: boolean;
  private readonly _checkLoadingStates: boolean;
  private readonly _checkErrorHandling: boolean;
  private readonly _checkFormValidation: boolean;
  private readonly _checkEmptyStates: boolean;

  constructor(options: UiUxAnalyzerOptions = {}) {
    this.logger = createLogger('UiUxAnalyzer');
    this.executor = new CommandExecutor();
    this._checkResponsive = options.checkResponsive ?? true;
    this._checkLoadingStates = options.checkLoadingStates ?? true;
    this._checkErrorHandling = options.checkErrorHandling ?? true;
    this._checkFormValidation = options.checkFormValidation ?? true;
    this._checkEmptyStates = options.checkEmptyStates ?? true;
  }

  /**
   * Get the dimension this analyzer handles
   */
  getDimension(): CodeDimension {
    return 'ui-ux';
  }

  /**
   * Get the default weight for this dimension
   */
  getWeight(): number {
    return 0.10; // 10% weight in overall score
  }

  /**
   * Analyze UI/UX for a project
   *
   * @param projectPath - Path to the project root
   * @param _framework - Detected framework (optional, for framework-specific analysis)
   * @param _options - Scoring options (optional)
   * @returns Dimension score with UI/UX metrics
   */
  async analyze(projectPath: string, _framework?: Framework, _options?: ScoringOptions): Promise<DimensionScore> {
    const startTime = performance.now();

    this.logger.info(`Analyzing UI/UX for: ${projectPath}`);

    const issues: Issue[] = [];
    const improvements: Improvement[] = [];

    try {
      // Check responsive design
      const responsiveMetrics = this._checkResponsive ? await this.checkResponsiveDesign(projectPath) : { hasResponsiveDesign: false, breakpointCount: 0 };

      // Check loading states
      const loadingMetrics = this._checkLoadingStates ? await this.checkLoadingStatesPatterns(projectPath) : { hasLoadingStates: false, loadingPatterns: new Set<LoadingPattern>() };

      // Check error handling
      const errorMetrics = this._checkErrorHandling ? await this.checkErrorHandlingPatterns(projectPath) : { hasErrorHandling: false, errorPatterns: new Set<ErrorPattern>() };

      // Check form validation
      const validationMetrics = this._checkFormValidation ? await this.checkFormValidationPatterns(projectPath) : { hasFormValidation: false, validationPatterns: new Set<ValidationPattern>() };

      // Check empty states
      const emptyStateMetrics = this._checkEmptyStates ? await this.checkEmptyStatesPatterns(projectPath) : { hasEmptyStates: false, emptyStateCount: 0 };

      const metrics: UiUxMetrics = {
        ...responsiveMetrics,
        ...loadingMetrics,
        ...errorMetrics,
        ...validationMetrics,
        ...emptyStateMetrics,
      };

      // Build issues list
      issues.push(...this.identifyUiUxIssues(metrics));

      // Build improvements list
      improvements.push(...this.generateUiUxImprovements(metrics));

      // Calculate final score
      const score = this.calculateUiUxScore(metrics);

      const duration = Math.round(performance.now() - startTime);

      return {
        dimension: this.getDimension(),
        score,
        weight: this.getWeight(),
        weightedScore: score * this.getWeight(),
        issues,
        improvements,
        metadata: {
          itemsChecked: 5,
          itemsPassed: this.countPassedChecks(metrics),
          metrics: {
            hasResponsiveDesign: metrics.hasResponsiveDesign ? 1 : 0,
            breakpointCount: metrics.breakpointCount,
            hasLoadingStates: metrics.hasLoadingStates ? 1 : 0,
            loadingPatternCount: metrics.loadingPatterns.size,
            hasErrorHandling: metrics.hasErrorHandling ? 1 : 0,
            errorPatternCount: metrics.errorPatterns.size,
            hasFormValidation: metrics.hasFormValidation ? 1 : 0,
            validationPatternCount: metrics.validationPatterns.size,
            hasEmptyStates: metrics.hasEmptyStates ? 1 : 0,
            emptyStateCount: metrics.emptyStateCount,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error analyzing UI/UX', error);

      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'ux' as IssueCategory,
        description: `Failed to analyze UI/UX: ${error instanceof Error ? error.message : String(error)}`,
        fixable: false,
      });

      const duration = Math.round(performance.now() - startTime);

      return {
        dimension: this.getDimension(),
        score: 50,
        weight: this.getWeight(),
        weightedScore: 50 * this.getWeight(),
        issues,
        improvements,
        metadata: { error: String(error) },
      };
    }
  }

  /**
   * Check for responsive design
   */
  private async checkResponsiveDesign(projectPath: string): Promise<{ hasResponsiveDesign: boolean; breakpointCount: number }> {
    let hasResponsiveDesign = false;
    let breakpointCount = 0;

    // Check for viewport meta tag
    const indexHtml = join(projectPath, 'index.html');
    if (existsSync(indexHtml)) {
      try {
        const content = await readFile(indexHtml, 'utf-8');
        if (content.includes('viewport')) {
          hasResponsiveDesign = true;
        }
      } catch {
        // Ignore
      }
    }

    // Check for media queries in CSS/SCSS files
    const srcDir = join(projectPath, 'src');
    const appDir = join(projectPath, 'app');

    const dirsToCheck: string[] = [];
    if (existsSync(srcDir)) dirsToCheck.push(srcDir);
    if (existsSync(appDir)) dirsToCheck.push(appDir);

    for (const dir of dirsToCheck) {
      await this.scanDirectoryForMediaQueries(dir, (count) => {
        if (count > 0) {
          hasResponsiveDesign = true;
          breakpointCount += count;
        }
      });
    }

    // Check Tailwind or other responsive utilities
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      if (pkg.devDependencies?.tailwindcss || pkg.dependencies?.tailwindcss) {
        hasResponsiveDesign = true;
        // Tailwind has default breakpoints
        breakpointCount = Math.max(breakpointCount, 5); // sm, md, lg, xl, 2xl
      }
    } catch {
      // Ignore
    }

    return { hasResponsiveDesign, breakpointCount };
  }

  /**
   * Scan directory for media queries
   */
  private async scanDirectoryForMediaQueries(dir: string, callback: (count: number) => void): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            await this.scanDirectoryForMediaQueries(fullPath, callback);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');
              const mediaQueryCount = (content.match(/@media/g) ?? []).length;
              callback(mediaQueryCount);
            } catch {
              // Skip unreadable files
            }
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Check for loading states
   */
  private async checkLoadingStatesPatterns(projectPath: string): Promise<{ hasLoadingStates: boolean; loadingPatterns: Set<LoadingPattern> }> {
    const loadingPatterns = new Set<LoadingPattern>();

    const srcDir = join(projectPath, 'src');
    const appDir = join(projectPath, 'app');

    const dirsToCheck: string[] = [];
    if (existsSync(srcDir)) dirsToCheck.push(srcDir);
    if (existsSync(appDir)) dirsToCheck.push(appDir);

    // Loading patterns to detect
    const patterns: Map<LoadingPattern, RegExp[]> = new Map([
      ['skeleton', [/skeleton/i, /Skeleton/i]],
      ['spinner', [/spinner/i, /Spinner/i, /loading/i, /Loading/i]],
      ['progress', [/progress/i, /Progress/i]],
      ['inline', [/isLoading/i, /isPending/i, /pending/i]],
    ]);

    for (const dir of dirsToCheck) {
      await this.scanDirectoryForLoadingPatterns(dir, patterns, loadingPatterns);
    }

    return {
      hasLoadingStates: loadingPatterns.size > 0,
      loadingPatterns,
    };
  }

  /**
   * Scan directory for loading patterns
   */
  private async scanDirectoryForLoadingPatterns(dir: string, patterns: Map<LoadingPattern, RegExp[]>, foundPatterns: Set<LoadingPattern>): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            await this.scanDirectoryForLoadingPatterns(fullPath, patterns, foundPatterns);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');

              for (const [patternType, regexList] of Array.from(patterns.entries())) {
                for (const regex of regexList) {
                  if (regex.test(content)) {
                    foundPatterns.add(patternType);
                    break;
                  }
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Check for error handling
   */
  private async checkErrorHandlingPatterns(projectPath: string): Promise<{ hasErrorHandling: boolean; errorPatterns: Set<ErrorPattern> }> {
    const errorPatterns = new Set<ErrorPattern>();

    const srcDir = join(projectPath, 'src');
    const appDir = join(projectPath, 'app');

    const dirsToCheck: string[] = [];
    if (existsSync(srcDir)) dirsToCheck.push(srcDir);
    if (existsSync(appDir)) dirsToCheck.push(appDir);

    // Error patterns to detect
    const patterns: Map<ErrorPattern, RegExp[]> = new Map([
      ['boundary', [/ErrorBoundary/i, /error-boundary/i]],
      ['toast', [/toast/i, /Toast/i, /notification/i]],
      ['inline', [/error.*message/i, /showError/i]],
      ['page', [/\b404\b/, /\b500\b/, /notfound/i, /error.*page/i]],
    ]);

    for (const dir of dirsToCheck) {
      await this.scanDirectoryForErrorPatterns(dir, patterns, errorPatterns);
    }

    return {
      hasErrorHandling: errorPatterns.size > 0,
      errorPatterns,
    };
  }

  /**
   * Scan directory for error patterns
   */
  private async scanDirectoryForErrorPatterns(dir: string, patterns: Map<ErrorPattern, RegExp[]>, foundPatterns: Set<ErrorPattern>): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            await this.scanDirectoryForErrorPatterns(fullPath, patterns, foundPatterns);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');

              for (const [patternType, regexList] of Array.from(patterns.entries())) {
                for (const regex of regexList) {
                  if (regex.test(content)) {
                    foundPatterns.add(patternType);
                    break;
                  }
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Check for form validation
   */
  private async checkFormValidationPatterns(projectPath: string): Promise<{ hasFormValidation: boolean; validationPatterns: Set<ValidationPattern> }> {
    const validationPatterns = new Set<ValidationPattern>();

    const srcDir = join(projectPath, 'src');
    const appDir = join(projectPath, 'app');

    const dirsToCheck: string[] = [];
    if (existsSync(srcDir)) dirsToCheck.push(srcDir);
    if (existsSync(appDir)) dirsToCheck.push(appDir);

    // Validation patterns to detect
    const patterns: Map<ValidationPattern, RegExp[]> = new Map([
      ['inline', [/error.*text/i, /validation.*message/i, /helperText/i]],
      ['onblur', [/onBlur/i, /blur.*validation/i]],
      ['onsubmit', [/onSubmit.*validation/i, /validate.*form/i]],
      ['realtime', [/onChange.*validation/i, /watch.*form/i]],
    ]);

    for (const dir of dirsToCheck) {
      await this.scanDirectoryForValidationPatterns(dir, patterns, validationPatterns);
    }

    // Check for React Hook Form or Formik
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      if (pkg.dependencies?.['react-hook-form'] || pkg.dependencies?.formik) {
        validationPatterns.add('realtime');
      }
    } catch {
      // Ignore
    }

    return {
      hasFormValidation: validationPatterns.size > 0,
      validationPatterns,
    };
  }

  /**
   * Scan directory for validation patterns
   */
  private async scanDirectoryForValidationPatterns(dir: string, patterns: Map<ValidationPattern, RegExp[]>, foundPatterns: Set<ValidationPattern>): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            await this.scanDirectoryForValidationPatterns(fullPath, patterns, foundPatterns);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');

              for (const [patternType, regexList] of Array.from(patterns.entries())) {
                for (const regex of regexList) {
                  if (regex.test(content)) {
                    foundPatterns.add(patternType);
                    break;
                  }
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Check for empty states
   */
  private async checkEmptyStatesPatterns(projectPath: string): Promise<{ hasEmptyStates: boolean; emptyStateCount: number }> {
    let emptyStateCount = 0;
    let hasEmptyStates = false;

    const srcDir = join(projectPath, 'src');
    const appDir = join(projectPath, 'app');

    const dirsToCheck: string[] = [];
    if (existsSync(srcDir)) dirsToCheck.push(srcDir);
    if (existsSync(appDir)) dirsToCheck.push(appDir);

    // Empty state patterns
    const patterns = [
      /empty/i,
      /no.*data/i,
      /no.*results/i,
      /nothing.*found/i,
      /zero.*state/i,
    ];

    for (const dir of dirsToCheck) {
      await this.scanDirectoryForEmptyStates(dir, patterns, (count) => {
        if (count > 0) {
          hasEmptyStates = true;
          emptyStateCount += count;
        }
      });
    }

    return { hasEmptyStates, emptyStateCount };
  }

  /**
   * Scan directory for empty states
   */
  private async scanDirectoryForEmptyStates(dir: string, patterns: RegExp[], callback: (count: number) => void): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            await this.scanDirectoryForEmptyStates(fullPath, patterns, callback);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');

              let count = 0;
              for (const pattern of patterns) {
                count += (content.match(pattern) ?? []).length;
              }

              callback(count);
            } catch {
              // Skip unreadable files
            }
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Identify UI/UX issues
   */
  private identifyUiUxIssues(metrics: UiUxMetrics): Issue[] {
    const issues: Issue[] = [];

    if (!metrics.hasResponsiveDesign) {
      issues.push({
        severity: 'high' as IssueSeverity,
        category: 'ux' as IssueCategory,
        description: 'No responsive design detected',
        fixable: true,
        suggestion: 'Add responsive design with media queries or a responsive framework',
      });
    }

    if (!metrics.hasLoadingStates) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'ux' as IssueCategory,
        description: 'No loading states detected',
        fixable: true,
        suggestion: 'Add loading indicators (skeletons, spinners) for async operations',
      });
    }

    if (!metrics.hasErrorHandling) {
      issues.push({
        severity: 'high' as IssueSeverity,
        category: 'ux' as IssueCategory,
        description: 'No error handling UX detected',
        fixable: true,
        suggestion: 'Implement error boundaries and user-friendly error messages',
      });
    }

    if (!metrics.hasFormValidation) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'ux' as IssueCategory,
        description: 'No form validation feedback detected',
        fixable: true,
        suggestion: 'Add inline validation and error messages for form inputs',
      });
    }

    if (!metrics.hasEmptyStates) {
      issues.push({
        severity: 'low' as IssueSeverity,
        category: 'ux' as IssueCategory,
        description: 'No empty states detected',
        fixable: true,
        suggestion: 'Add empty states for lists, tables, and data displays',
      });
    }

    return issues;
  }

  /**
   * Generate UI/UX improvements
   */
  private generateUiUxImprovements(metrics: UiUxMetrics): Improvement[] {
    const improvements: Improvement[] = [];

    if (!metrics.hasResponsiveDesign) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Implement responsive design for mobile and tablet devices',
        effort: 'significant' as Effort,
        impact: 'high' as Impact,
        steps: [
          'Add viewport meta tag',
          'Use responsive units (rem, %, vw/vh)',
          'Add media queries for breakpoints',
          'Test on multiple devices',
        ],
      });
    }

    if (!metrics.hasLoadingStates) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Add loading states for better perceived performance',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Use skeleton screens for content loading',
          'Add spinners for actions',
          'Consider optimistic UI updates',
        ],
      });
    }

    if (!metrics.hasErrorHandling) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Implement comprehensive error handling UX',
        effort: 'moderate' as Effort,
        impact: 'high' as Impact,
        steps: [
          'Add error boundaries for React components',
          'Display user-friendly error messages',
          'Add retry mechanisms for failed operations',
          'Log errors for debugging',
        ],
      });
    }

    if (!metrics.hasFormValidation) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Add form validation with clear feedback',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Validate on blur for inline feedback',
          'Show error messages below inputs',
          'Disable submit button until valid',
          'Use HTML5 validation attributes',
        ],
      });
    }

    if (!metrics.hasEmptyStates) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Add empty states for better UX',
        effort: 'quick' as Effort,
        impact: 'low' as Impact,
        steps: [
          'Create EmptyState component',
          'Add illustrations or icons',
          'Include clear messaging and actions',
        ],
      });
    }

    return improvements;
  }

  /**
   * Calculate UI/UX score
   */
  private calculateUiUxScore(metrics: UiUxMetrics): number {
    let score = 0;

    if (metrics.hasResponsiveDesign) score += 25;
    if (metrics.hasLoadingStates) score += 20;
    if (metrics.hasErrorHandling) score += 25;
    if (metrics.hasFormValidation) score += 20;
    if (metrics.hasEmptyStates) score += 10;

    return score;
  }

  /**
   * Count passed checks for metadata
   */
  private countPassedChecks(metrics: UiUxMetrics): number {
    let count = 0;
    if (metrics.hasResponsiveDesign) count++;
    if (metrics.hasLoadingStates) count++;
    if (metrics.hasErrorHandling) count++;
    if (metrics.hasFormValidation) count++;
    if (metrics.hasEmptyStates) count++;
    return count;
  }
}

/**
 * Default analyzer instance
 */
export const uiUxAnalyzer = new UiUxAnalyzer();
