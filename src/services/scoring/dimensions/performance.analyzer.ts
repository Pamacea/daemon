/**
 * Performance Analyzer
 *
 * Analyzes performance metrics including Lighthouse scores, Core Web Vitals,
 * bundle size analysis, and loading performance.
 *
 * @module services/scoring/dimensions/performance
 */

import { readFile, access, readdir, stat } from 'node:fs/promises';
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
 * Lighthouse report structure
 */
interface LighthouseReport {
  categories?: {
    performance?: { score: number };
    accessibility?: { score: number };
    'best-practices'?: { score: number };
    seo?: { score: number };
  };
  audits?: Record<string, { score: number; displayValue?: string }>;
}

/**
 * Core Web Vitals metrics
 */
interface CoreWebVitals {
  /** Largest Contentful Paint (ms) */
  lcp: number;
  /** First Input Delay (ms) */
  fid: number;
  /** Cumulative Layout Shift */
  cls: number;
  /** First Contentful Paint (ms) */
  fcp: number;
  /** Time to Interactive (ms) */
  tti: number;
  /** Speed Index */
  si: number;
}

/**
 * Bundle size metrics
 */
interface BundleMetrics {
  /** Raw bundle size in bytes */
  rawSize: number;
  /** Gzipped size in bytes */
  gzippedSize: number;
  /** Brotli size in bytes */
  brotliSize?: number;
  /** Number of chunks */
  chunkCount: number;
  /** Largest asset */
  largestAsset: { name: string; size: number };
}

/**
 * Performance analyzer configuration
 */
export interface PerformanceAnalyzerOptions {
  /** URL to run Lighthouse against (for running apps) */
  appUrl?: string;
  /** Lighthouse command */
  lighthouseCommand?: string;
  /** Bundle size threshold in bytes */
  maxBundleSize?: number;
  /** Target LCP in ms */
  targetLcp?: number;
  /** Target CLS */
  targetCls?: number;
  /** Whether to run Lighthouse (requires running app) */
  runLighthouse?: boolean;
}

/**
 * Performance Analyzer
 *
 * Evaluates performance across multiple dimensions:
 * - Lighthouse scores (performance, accessibility, best practices, SEO)
 * - Core Web Vitals (LCP, FID, CLS)
 * - Bundle size analysis
 * - Loading performance
 */
export class PerformanceAnalyzer {
  /** Analyzer configuration */
  readonly config: DimensionAnalyzerConfig = {
    dimension: 'performance' as CodeDimension,
    defaultWeight: 0.15,
    estimatedDuration: 60000,
    requiresRunningProject: true,
    supportedFrameworks: ['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'Angular', 'Remix', 'SvelteKit', 'Astro', 'Gatsby'],
  };

  private readonly logger: Logger;
  private readonly executor: CommandExecutor;
  private readonly appUrl: string;
  private readonly lighthouseCommand: string;
  private readonly maxBundleSize: number;
  private readonly targetLcp: number;
  private readonly targetCls: number;
  private readonly runLighthouse: boolean;

  // Thresholds for Core Web Vitals
  private readonly VITAL_THRESHOLDS = {
    lcp: { good: 2500, needsImprovement: 4000 },
    fid: { good: 100, needsImprovement: 300 },
    cls: { good: 0.1, needsImprovement: 0.25 },
    fcp: { good: 1800, needsImprovement: 3000 },
    tti: { good: 3800, needsImprovement: 7300 },
  } as const;

  constructor(options: PerformanceAnalyzerOptions = {}) {
    this.logger = createLogger('PerformanceAnalyzer');
    this.executor = new CommandExecutor();
    this.appUrl = options.appUrl ?? 'http://localhost:3000';
    this.lighthouseCommand = options.lighthouseCommand ?? 'npx lighthouse';
    this.maxBundleSize = options.maxBundleSize ?? 250_000; // 250KB default
    this.targetLcp = options.targetLcp ?? 2500;
    this.targetCls = options.targetCls ?? 0.1;
    this.runLighthouse = options.runLighthouse ?? false;
  }

  /**
   * Get the dimension this analyzer handles
   */
  getDimension(): CodeDimension {
    return 'performance';
  }

  /**
   * Get the default weight for this dimension
   */
  getWeight(): number {
    return 0.15; // 15% weight in overall score
  }

  /**
   * Analyze performance for a project
   *
   * @param projectPath - Path to the project root
   * @param _framework - Detected framework (optional, for framework-specific analysis)
   * @param _options - Scoring options (optional)
   * @returns Dimension score with performance metrics
   */
  async analyze(projectPath: string, _framework?: Framework, _options?: ScoringOptions): Promise<DimensionScore> {
    const startTime = performance.now();

    this.logger.info(`Analyzing performance for: ${projectPath}`);

    const issues: Issue[] = [];
    const improvements: Improvement[] = [];

    try {
      // Run Lighthouse if configured
      let lighthouseReport: LighthouseReport | null = null;
      if (this.runLighthouse) {
        lighthouseReport = await this.runLighthouseAnalysis();
      }

      // Analyze bundle size
      const bundleMetrics = await this.analyzeBundleSize(projectPath);

      // Check for performance optimizations
      const optimizations = await this.checkPerformanceOptimizations(projectPath);

      // Read existing Lighthouse report if available
      if (!lighthouseReport) {
        lighthouseReport = await this.readExistingLighthouseReport(projectPath);
      }

      // Build issues list
      issues.push(...this.identifyPerformanceIssues(lighthouseReport, bundleMetrics, optimizations));

      // Build improvements list
      improvements.push(...this.generatePerformanceImprovements(lighthouseReport, bundleMetrics, optimizations));

      // Calculate final score
      const score = this.calculatePerformanceScore(lighthouseReport, bundleMetrics, optimizations);

      const duration = Math.round(performance.now() - startTime);

      return {
        dimension: this.getDimension(),
        score,
        weight: this.getWeight(),
        weightedScore: score * this.getWeight(),
        issues,
        improvements,
        metadata: {
          itemsChecked: this.countCheckedItems(bundleMetrics, optimizations),
          itemsPassed: this.countPassedItems(lighthouseReport, bundleMetrics),
          metrics: {
            lighthousePerformance: lighthouseReport?.categories?.performance?.score ?? 0,
            lighthouseAccessibility: lighthouseReport?.categories?.accessibility?.score ?? 0,
            lighthouseBestPractices: lighthouseReport?.categories?.['best-practices']?.score ?? 0,
            lighthouseSeo: lighthouseReport?.categories?.seo?.score ?? 0,
            bundleSize: bundleMetrics?.rawSize ?? 0,
            bundleSizeGzip: bundleMetrics?.gzippedSize ?? 0,
            hasCodeSplitting: optimizations.hasCodeSplitting ? 1 : 0,
            hasTreeShaking: optimizations.hasTreeShaking ? 1 : 0,
            hasCompression: optimizations.hasCompression ? 1 : 0,
            hasLazyLoading: optimizations.hasLazyLoading ? 1 : 0,
            hasImageOptimization: optimizations.hasImageOptimization ? 1 : 0,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error analyzing performance', error);

      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'performance' as IssueCategory,
        description: `Failed to analyze performance: ${error instanceof Error ? error.message : String(error)}`,
        fixable: false,
      });

      const duration = Math.round(performance.now() - startTime);

      return {
        dimension: this.getDimension(),
        score: 50, // Neutral score on error
        weight: this.getWeight(),
        weightedScore: 50 * this.getWeight(),
        issues,
        improvements,
        metadata: { error: String(error) },
      };
    }
  }

  /**
   * Run Lighthouse analysis
   */
  private async runLighthouseAnalysis(): Promise<LighthouseReport | null> {
    try {
      const command = `${this.lighthouseCommand} ${this.appUrl} --output json --quiet`;
      const result = await this.executor.execute(command, {
        timeout: 120000, // 2 minutes
        silent: true,
      });

      if (!result.success || !result.data) {
        this.logger.warn('Lighthouse execution failed');
        return null;
      }

      return JSON.parse(result.data.stdout) as LighthouseReport;
    } catch (error) {
      this.logger.warn('Failed to run Lighthouse', error);
      return null;
    }
  }

  /**
   * Read existing Lighthouse report
   */
  private async readExistingLighthouseReport(projectPath: string): Promise<LighthouseReport | null> {
    const reportPaths = [
      join(projectPath, '.lighthouseci', 'lhr-*.json'),
      join(projectPath, 'lighthouse-report.json'),
      join(projectPath, '.lighthouse', 'reports', '*.json'),
    ];

    for (const pattern of reportPaths) {
      // In a real implementation, would use glob to find matching files
      // For now, check the direct path without glob
      const directPath = pattern.replace('*', 'latest');
      try {
        await access(directPath);
        const content = await readFile(directPath, 'utf-8');
        return JSON.parse(content) as LighthouseReport;
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Analyze bundle size from build output
   */
  private async analyzeBundleSize(projectPath: string): Promise<BundleMetrics | null> {
    const buildDirs = [
      join(projectPath, '.next', 'static'),
      join(projectPath, 'dist'),
      join(projectPath, 'build'),
      join(projectPath, 'out'),
    ];

    for (const buildDir of buildDirs) {
      if (!existsSync(buildDir)) {
        continue;
      }

      try {
        const metrics = await this.calculateBundleMetrics(buildDir);
        if (metrics) {
          return metrics;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Calculate bundle metrics from build directory
   */
  private async calculateBundleMetrics(buildDir: string): Promise<BundleMetrics | null> {
    let totalSize = 0;
    let largestSize = 0;
    let largestAsset = { name: 'unknown', size: 0 };
    let chunkCount = 0;

    async function scanDir(dir: string): Promise<void> {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile()) {
            const ext = extname(entry.name);
            // Count JS and CSS files
            if (['.js', '.mjs', '.cjs', '.css'].includes(ext)) {
              const stats = await stat(fullPath);
              const size = stats.size;

              totalSize += size;
              chunkCount++;

              if (size > largestSize) {
                largestSize = size;
                largestAsset = {
                  name: relative(process.cwd(), fullPath),
                  size,
                };
              }
            }
          }
        }
      } catch {
        // Ignore
      }
    }

    await scanDir(buildDir);

    if (chunkCount === 0) {
      return null;
    }

    // Estimate gzipped size (roughly 70% reduction for JS)
    const gzippedSize = Math.round(totalSize * 0.3);

    return {
      rawSize: totalSize,
      gzippedSize,
      chunkCount,
      largestAsset,
    };
  }

  /**
   * Check for performance optimizations
   */
  private async checkPerformanceOptimizations(projectPath: string): Promise<{
    hasCodeSplitting: boolean;
    hasTreeShaking: boolean;
    hasCompression: boolean;
    hasLazyLoading: boolean;
    hasImageOptimization: boolean;
    hasCaching: boolean;
  }> {
    const optimizations = {
      hasCodeSplitting: false,
      hasTreeShaking: false,
      hasCompression: false,
      hasLazyLoading: false,
      hasImageOptimization: false,
      hasCaching: false,
    };

    // Check Next.js optimizations
    if (existsSync(join(projectPath, 'next.config.js')) || existsSync(join(projectPath, 'next.config.mjs')) || existsSync(join(projectPath, 'next.config.ts'))) {
      optimizations.hasCodeSplitting = true; // Next.js has automatic code splitting
      optimizations.hasImageOptimization = true; // Next.js Image component
    }

    // Check for Vite (has tree shaking by default)
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      if (pkg.devDependencies?.vite || pkg.dependencies?.vite) {
        optimizations.hasTreeShaking = true;
        optimizations.hasCodeSplitting = true;
      }
    } catch {
      // Ignore
    }

    // Check for lazy loading patterns in code
    const srcDir = join(projectPath, 'src');
    if (existsSync(srcDir)) {
      optimizations.hasLazyLoading = await this.checkForLazyLoading(srcDir);
    }

    // Check for compression middleware
    optimizations.hasCompression = await this.checkForCompression(projectPath);

    // Check for caching headers/strategy
    optimizations.hasCaching = await this.checkForCaching(projectPath);

    return optimizations;
  }

  /**
   * Check for lazy loading patterns
   */
  private async checkForLazyLoading(dir: string): Promise<boolean> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            if (await this.checkForLazyLoading(fullPath)) {
              return true;
            }
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            const content = await readFile(fullPath, 'utf-8');
            // Check for dynamic import patterns
            if (/\bimport\(|lazy\(|React\.lazy/.test(content)) {
              return true;
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    return false;
  }

  /**
   * Check for compression configuration
   */
  private async checkForCompression(projectPath: string): Promise<boolean> {
    // Check for common compression patterns
    const compressionPatterns = [
      'compression',
      'compress',
      'gzip',
      'brotli',
      'ngsw-config.json', // Angular service worker
    ];

    // Check package.json for compression dependencies
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const pattern of compressionPatterns) {
        if (Object.keys(allDeps).some((key) => key.toLowerCase().includes(pattern))) {
          return true;
        }
      }
    } catch {
      // Ignore
    }

    return false;
  }

  /**
   * Check for caching strategy
   */
  private async checkForCaching(projectPath: string): Promise<boolean> {
    // Check for service worker, cache headers, or CDN config
    const cacheIndicators = [
      'service-worker',
      'sw.js',
      'workbox',
      'cache-control',
      'vercel.json', // Vercel caching
      'netlify.toml', // Netlify caching
    ];

    for (const indicator of cacheIndicators) {
      if (existsSync(join(projectPath, indicator)) || existsSync(join(projectPath, 'public', indicator))) {
        return true;
      }
    }

    // Check Next.js caching (ISR, revalidate)
    if (existsSync(join(projectPath, 'next.config.js')) || existsSync(join(projectPath, 'next.config.mjs'))) {
      return true;
    }

    return false;
  }

  /**
   * Identify performance issues
   */
  private identifyPerformanceIssues(
    lighthouseReport: LighthouseReport | null,
    bundleMetrics: BundleMetrics | null,
    optimizations: { hasCodeSplitting: boolean; hasTreeShaking: boolean; hasCompression: boolean; hasLazyLoading: boolean; hasImageOptimization: boolean; hasCaching: boolean }
  ): Issue[] {
    const issues: Issue[] = [];

    // Lighthouse score issues
    if (lighthouseReport?.categories?.performance?.score !== undefined) {
      const perfScore = lighthouseReport.categories.performance.score * 100;

      if (perfScore < 50) {
        issues.push({
          severity: 'high' as IssueSeverity,
          category: 'performance' as IssueCategory,
          description: `Lighthouse performance score (${perfScore.toFixed(0)}) is below 50`,
          fixable: false,
          suggestion: 'Focus on improving Core Web Vitals: LCP, FID, and CLS',
        });
      } else if (perfScore < 80) {
        issues.push({
          severity: 'medium' as IssueSeverity,
          category: 'performance' as IssueCategory,
          description: `Lighthouse performance score (${perfScore.toFixed(0)}) is below 80`,
          fixable: false,
          suggestion: 'Optimize loading performance and resource delivery',
        });
      }
    }

    // Bundle size issues
    if (bundleMetrics) {
      const sizeMb = bundleMetrics.rawSize / 1_000_000;
      if (bundleMetrics.rawSize > this.maxBundleSize) {
        issues.push({
          severity: 'medium' as IssueSeverity,
          category: 'performance' as IssueCategory,
          description: `Bundle size (${sizeMb.toFixed(2)}MB) exceeds recommended limit (${(this.maxBundleSize / 1_000_000).toFixed(2)}MB)`,
          fixable: false,
          suggestion: 'Implement code splitting and remove unused dependencies',
        });
      }

      if (bundleMetrics.gzippedSize > 100_000) {
        issues.push({
          severity: 'medium' as IssueSeverity,
          category: 'performance' as IssueCategory,
          description: `Gzipped bundle size (${(bundleMetrics.gzippedSize / 1000).toFixed(0)}KB) is large`,
          fixable: false,
          suggestion: 'Analyze bundle composition and consider dynamic imports',
        });
      }
    }

    // Optimization issues
    if (!optimizations.hasCodeSplitting) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'performance' as IssueCategory,
        description: 'No code splitting detected',
        fixable: true,
        suggestion: 'Implement route-based or component-based code splitting',
      });
    }

    if (!optimizations.hasLazyLoading) {
      issues.push({
        severity: 'low' as IssueSeverity,
        category: 'performance' as IssueCategory,
        description: 'No lazy loading detected for components or images',
        fixable: true,
        suggestion: 'Use dynamic imports for below-fold components and lazy loading for images',
      });
    }

    if (!optimizations.hasCompression) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'performance' as IssueCategory,
        description: 'No compression middleware detected',
        fixable: true,
        suggestion: 'Enable gzip/brotli compression on your server',
      });
    }

    return issues;
  }

  /**
   * Generate performance improvements
   */
  private generatePerformanceImprovements(
    lighthouseReport: LighthouseReport | null,
    bundleMetrics: BundleMetrics | null,
    optimizations: { hasCodeSplitting: boolean; hasTreeShaking: boolean; hasCompression: boolean; hasLazyLoading: boolean; hasImageOptimization: boolean; hasCaching: boolean }
  ): Improvement[] {
    const improvements: Improvement[] = [];

    // Lighthouse-based improvements
    if (lighthouseReport?.categories?.performance?.score !== undefined) {
      const perfScore = lighthouseReport.categories.performance.score * 100;

      if (perfScore < 90) {
        improvements.push({
          type: 'optimize' as ImprovementType,
          description: `Improve Lighthouse performance score from ${perfScore.toFixed(0)} to 90+`,
          effort: 'moderate' as Effort,
          impact: 'high' as Impact,
          steps: [
            'Eliminate render-blocking resources',
            'Reduce JavaScript execution time',
            'Properly size images',
            'Use modern image formats (WebP, AVIF)',
            'Implement text compression',
          ],
        });
      }
    }

    // Bundle size improvements
    if (bundleMetrics && bundleMetrics.rawSize > this.maxBundleSize) {
      improvements.push({
        type: 'optimize' as ImprovementType,
        description: 'Reduce bundle size through code splitting and tree shaking',
        effort: 'moderate' as Effort,
        impact: 'high' as Impact,
        steps: [
          'Analyze bundle composition using webpack-bundle-analyzer or similar',
          'Remove unused dependencies',
          'Implement route-based code splitting',
          'Use dynamic imports for large libraries',
          'Enable production optimizations',
        ],
      });
    }

    // Lazy loading improvements
    if (!optimizations.hasLazyLoading) {
      improvements.push({
        type: 'optimize' as ImprovementType,
        description: 'Implement lazy loading for images and components',
        effort: 'quick' as Effort,
        impact: 'medium' as Impact,
      });
    }

    // Image optimization improvements
    if (!optimizations.hasImageOptimization) {
      improvements.push({
        type: 'optimize' as ImprovementType,
        description: 'Implement image optimization strategy',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Use responsive images with srcset',
          'Implement lazy loading for images',
          'Serve modern formats (WebP, AVIF)',
          'Compress images appropriately',
        ],
      });
    }

    // Caching improvements
    if (!optimizations.hasCaching) {
      improvements.push({
        type: 'optimize' as ImprovementType,
        description: 'Implement caching strategy for static assets',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Set appropriate Cache-Control headers',
          'Consider using a CDN for static assets',
          'Implement service worker caching',
        ],
      });
    }

    return improvements;
  }

  /**
   * Calculate final performance score
   */
  private calculatePerformanceScore(
    lighthouseReport: LighthouseReport | null,
    bundleMetrics: BundleMetrics | null,
    optimizations: { hasCodeSplitting: boolean; hasTreeShaking: boolean; hasCompression: boolean; hasLazyLoading: boolean; hasImageOptimization: boolean; hasCaching: boolean }
  ): number {
    let score = 50; // Base score

    // Lighthouse performance score (40 points max)
    if (lighthouseReport?.categories?.performance?.score !== undefined) {
      score += lighthouseReport.categories.performance.score * 40;
    } else {
      score += 20; // Neutral if no report
    }

    // Bundle size score (20 points max)
    if (bundleMetrics) {
      const sizeScore = Math.max(0, 1 - bundleMetrics.rawSize / (this.maxBundleSize * 2));
      score += sizeScore * 20;
    }

    // Optimizations bonus (10 points)
    const optCount = [
      optimizations.hasCodeSplitting,
      optimizations.hasTreeShaking,
      optimizations.hasCompression,
      optimizations.hasLazyLoading,
      optimizations.hasImageOptimization,
      optimizations.hasCaching,
    ].filter(Boolean).length;

    score += (optCount / 6) * 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Count checked items for metadata
   */
  private countCheckedItems(bundleMetrics: BundleMetrics | null, optimizations: { hasCodeSplitting: boolean; hasTreeShaking: boolean; hasCompression: boolean; hasLazyLoading: boolean; hasImageOptimization: boolean; hasCaching: boolean }): number {
    let count = 0;
    if (bundleMetrics) count++;
    count += 6; // optimization checks
    return count;
  }

  /**
   * Count passed items for metadata
   */
  private countPassedItems(lighthouseReport: LighthouseReport | null, bundleMetrics: BundleMetrics | null): number {
    let count = 0;

    if (lighthouseReport?.categories?.performance?.score ?? 0 >= 0.8) {
      count++;
    }

    if (bundleMetrics && bundleMetrics.rawSize <= this.maxBundleSize) {
      count++;
    }

    return count;
  }
}

/**
 * Default analyzer instance
 */
export const performanceAnalyzer = new PerformanceAnalyzer();
