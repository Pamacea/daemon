/**
 * Accessibility Dimension Analyzer
 *
 * Analyzes web accessibility using axe-core and pa11y.
 *
 * @module services/scoring/dimensions/accessibility-analyzer
 */

import type { DimensionScore, CodeDimension, DimensionAnalyzerConfig, Issue, Improvement, IssueSeverity, IssueCategory, ImprovementType, Effort, Impact } from '../../../core/types/scoring.types.js';
import type { Framework } from '../../../core/types/project.types.js';
import type { ScoringOptions } from '../../../core/types/scoring.types.js';
import { CommandExecutor } from '../../../shared/utils/command-executor.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * WCAG AA compliance thresholds
 */
const A11Y_THRESHOLDS = {
  critical: 0,    // Must have zero critical issues
  serious: 2,     // Max 2 serious issues
  moderate: 10,   // Max 10 moderate issues
  minor: 20,      // Max 20 minor issues
};

/**
 * Axe rule categories
 */
interface AxeResult {
  violations: Array<{
    id: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    help: string;
    nodes: Array<{
        target: string[];
        html: string;
    }>;
  }>;
  passes: number;
  incomplete: number;
}

/**
 * Accessibility Dimension Analyzer
 */
export class AccessibilityAnalyzer {
  /** Analyzer configuration */
  readonly config: DimensionAnalyzerConfig = {
    dimension: 'accessibility' as CodeDimension,
    defaultWeight: 0.10,
    estimatedDuration: 20000,
    requiresRunningProject: true,
    supportedFrameworks: ['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'Angular', 'Remix', 'SvelteKit', 'Astro', 'Gatsby'],
  };

  private readonly logger: Logger;
  private executor: CommandExecutor;

  constructor() {
    this.logger = createLogger('AccessibilityAnalyzer');
    this.executor = new CommandExecutor();
  }

  /**
   * Analyze accessibility of the project
   */
  async analyze(projectPath: string, _framework?: Framework, _options?: ScoringOptions): Promise<DimensionScore> {
    this.logger.info(`Analyzing accessibility for ${projectPath}`);

    const issues: Issue[] = [];
    const improvements: Improvement[] = [];

    let score = 100;
    let axeResults: AxeResult | null = null;

    try {
      // Run accessibility scan (try multiple URLs)
      axeResults = await this.runA11yScan(projectPath);
      score = this.calculateA11yScore(axeResults);

      // Generate issues from violations
      issues.push(...this.generateA11yIssues(axeResults));

      // Generate improvement suggestions
      improvements.push(...this.generateA11yImprovements(axeResults));

    } catch (error) {
      this.logger.warn('Accessibility scan failed', error);
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'accessibility' as IssueCategory,
        description: 'Could not run accessibility scan. Ensure the app is running on localhost:3000',
        fixable: false,
      });
      score = 50;
    }

    return {
      dimension: 'accessibility' as CodeDimension,
      score,
      weight: 0.10,
      issues: issues.map(i => ({
        severity: i.severity,
        category: i.category,
        description: i.description,
        location: i.location,
        fixable: i.fixable,
      })),
      improvements: improvements.map(imp => ({
        type: imp.type,
        description: imp.description,
        effort: imp.effort,
        impact: imp.impact,
      })),
    };
  }

  /**
   * Run accessibility scan using axe-core
   */
  private async runA11yScan(projectPath: string): Promise<AxeResult> {
    const urls = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
    ];

    for (const url of urls) {
      try {
        // Try pa11y first (lighter)
        const pa11yCmd = `npx pa11y ${url} --json --runner axe`;
        const result = await this.executor.execute(pa11yCmd, { cwd: projectPath, timeout: 30000 });

        if (result.success && result.data.stdout) {
          return this.parsePa11yResult(result.data.stdout);
        }
      } catch {
        // Try next URL
      }
    }

    // If no URL worked, throw error
    throw new Error('No accessible development server found');
  }

  /**
   * Parse pa11y result into our format
   */
  private parsePa11yResult(output: string): AxeResult {
    try {
      const data = JSON.parse(output);

      return {
        violations: data.map((v: any) => ({
          id: v.code || 'unknown',
          impact: this.mapSeverity(v.type),
          description: v.message,
          help: v.context || '',
          nodes: v.selector ? [{ target: [v.selector], html: v.context || '' }] : [],
        })),
        passes: 0,
        incomplete: 0,
      };
    } catch {
      return {
        violations: [],
        passes: 0,
        incomplete: 0,
      };
    }
  }

  /**
   * Map pa11y severity to axe impact
   */
  private mapSeverity(type: string): 'critical' | 'serious' | 'moderate' | 'minor' {
    const mapping: Record<string, 'critical' | 'serious' | 'moderate' | 'minor'> = {
      error: 'critical',
      warning: 'serious',
      notice: 'moderate',
    };
    return mapping[type] || 'minor';
  }

  /**
   * Calculate accessibility score (0-100)
   */
  private calculateA11yScore(results: AxeResult): number {
    let score = 100;

    for (const violation of results.violations) {
      switch (violation.impact) {
        case 'critical':
          score -= 30;
          break;
        case 'serious':
          score -= 15;
          break;
        case 'moderate':
          score -= 5;
          break;
        case 'minor':
          score -= 2;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Generate accessibility issues from violations
   */
  private generateA11yIssues(results: AxeResult): Issue[] {
    return results.violations.slice(0, 20).map(v => ({
      severity: (v.impact === 'critical' || v.impact === 'serious' ? 'high' : 'medium') as IssueSeverity,
      category: 'accessibility' as IssueCategory,
      description: `${v.id}: ${v.description}`,
      location: v.nodes[0]?.target[0] || 'multiple',
      fixable: true,
    }));
  }

  /**
   * Generate accessibility improvement suggestions
   */
  private generateA11yImprovements(results: AxeResult): Improvement[] {
    const improvements: Improvement[] = [];
    const violationIds = new Set(results.violations.map(v => v.id));

    // Common improvements based on violations found
    if (violationIds.has('color-contrast')) {
      improvements.push({
        type: 'a11y' as ImprovementType,
        description: 'Fix color contrast issues to meet WCAG AA standards (4.5:1 for normal text)',
        effort: 'moderate' as Effort,
        impact: 'high' as Impact,
      });
    }

    if (violationIds.has('image-alt')) {
      improvements.push({
        type: 'a11y' as ImprovementType,
        description: 'Add alt text to all images for screen reader users',
        effort: 'quick' as Effort,
        impact: 'high' as Impact,
      });
    }

    if (violationIds.has('label')) {
      improvements.push({
        type: 'a11y' as ImprovementType,
        description: 'Ensure all form inputs have associated labels',
        effort: 'quick' as Effort,
        impact: 'high' as Impact,
      });
    }

    if (violationIds.has('button-name')) {
      improvements.push({
        type: 'a11y' as ImprovementType,
        description: 'Add accessible names to all buttons and links',
        effort: 'quick' as Effort,
        impact: 'high' as Impact,
      });
    }

    if (violationIds.has('heading-order')) {
      improvements.push({
        type: 'a11y' as ImprovementType,
        description: 'Fix heading order to follow logical hierarchy (h1 → h2 → h3)',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
      });
    }

    // General improvements
    improvements.push({
      type: 'a11y' as ImprovementType,
      description: 'Test your site with a screen reader (NVDA, JAWS, or VoiceOver)',
      effort: 'moderate' as Effort,
      impact: 'high' as Impact,
    });

    improvements.push({
      type: 'a11y' as ImprovementType,
      description: 'Ensure keyboard navigation works for all interactive elements',
      effort: 'moderate' as Effort,
      impact: 'high' as Impact,
    });

    improvements.push({
      type: 'a11y' as ImprovementType,
      description: 'Add skip links for main content navigation',
      effort: 'quick' as Effort,
      impact: 'medium' as Impact,
    });

    improvements.push({
      type: 'a11y' as ImprovementType,
      description: 'Use semantic HTML elements (nav, main, article, etc.)',
      effort: 'moderate' as Effort,
      impact: 'medium' as Impact,
    });

    return improvements;
  }
}

/**
 * Default accessibility analyzer instance
 */
export const accessibilityAnalyzer = new AccessibilityAnalyzer();
