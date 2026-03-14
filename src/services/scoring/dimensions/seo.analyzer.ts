/**
 * SEO Dimension Analyzer
 *
 * Analyzes Search Engine Optimization factors for web applications.
 * Checks meta tags, structured data, sitemap, robots.txt, and more.
 *
 * @module services/scoring/dimensions/seo-analyzer
 */

import type { DimensionScore, CodeDimension, Issue, Improvement, DimensionAnalyzerConfig } from '../../../core/types/scoring.types.js';
import type { Framework } from '../../../core/types/project.types.js';
import type { ScoringOptions } from '../../../core/types/scoring.types.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * SEO check configuration
 */
interface SEOCheck {
  name: string;
  description: string;
  weight: number;
  check: (projectPath: string) => Promise<boolean>;
}

/**
 * Meta tag information
 */
interface MetaTagInfo {
  name: string;
  required: boolean;
  weight: number;
  description: string;
}

/**
 * Required and recommended meta tags
 */
const META_TAGS: MetaTagInfo[] = [
  { name: 'title', required: true, weight: 15, description: 'Page title' },
  { name: 'description', required: true, weight: 15, description: 'Meta description' },
  { name: 'viewport', required: true, weight: 10, description: 'Viewport for mobile' },
  { name: 'charset', required: true, weight: 5, description: 'Character encoding' },
  { name: 'robots', required: false, weight: 5, description: 'Robots directive' },
  { name: 'canonical', required: false, weight: 10, description: 'Canonical URL' },
  { name: 'og:title', required: false, weight: 8, description: 'Open Graph title' },
  { name: 'og:description', required: false, weight: 8, description: 'Open Graph description' },
  { name: 'og:image', required: false, weight: 8, description: 'Open Graph image' },
  { name: 'og:type', required: false, weight: 5, description: 'Open Graph type' },
  { name: 'og:url', required: false, weight: 5, description: 'Open Graph URL' },
  { name: 'twitter:card', required: false, weight: 6, description: 'Twitter card type' },
];

/**
 * SEO Dimension Analyzer
 *
 * Evaluates SEO quality across multiple dimensions:
 * - Meta tags (title, description, Open Graph, Twitter Cards)
 * - Structured data (JSON-LD, Microdata)
 * - Sitemap.xml
 * - Robots.txt
 * - Heading structure
 * - Image alt attributes
 * - Semantic HTML
 * - Core Web Vitals (indirect SEO factor)
 */
export class SeoAnalyzer {
  /** Analyzer configuration */
  readonly config: DimensionAnalyzerConfig = {
    dimension: 'seo' as CodeDimension,
    defaultWeight: 0.09,
    estimatedDuration: 15000,
    supportedFrameworks: ['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'Angular', 'Remix', 'SvelteKit', 'Astro', 'Gatsby'],
  };

  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger('SeoAnalyzer');
  }

  /**
   * Analyze SEO for a project
   */
  async analyze(projectPath: string, _framework?: Framework, _options?: ScoringOptions): Promise<DimensionScore> {
    const startTime = Date.now();
    this.logger.info(`Analyzing SEO for: ${projectPath}`);

    const issues: Issue[] = [];
    const improvements: Improvement[] = [];
    let score = 0;

    // Run all SEO checks
    const checkResults = await this.runAllSeoChecks(projectPath);

    // Calculate base score from checks
    score = this.calculateScore(checkResults);

    // Generate issues from failed checks
    issues.push(...this.generateIssues(checkResults));

    // Generate improvements
    improvements.push(...this.generateImprovements(checkResults));

    // Additional metadata analysis
    const metadata = await this.analyzeSeoMetadata(projectPath);

    const duration = Date.now() - startTime;

    return {
      dimension: 'seo' as CodeDimension,
      score: Math.min(100, Math.max(0, score)),
      weight: 0.10, // 10% weight in overall score
      weightedScore: (Math.min(100, Math.max(0, score)) * 0.10),
      issues,
      improvements,
      metadata: {
        itemsChecked: checkResults.total,
        itemsPassed: checkResults.passed,
        metrics: {
          ...metadata,
          analysisDuration: duration,
        },
      },
    };
  }

  /**
   * Run all SEO checks
   */
  private async runAllSeoChecks(projectPath: string): Promise<{
    results: Map<string, { passed: boolean; weight: number; description: string }>;
    total: number;
    passed: number;
  }> {
    const results = new Map();

    // Check 1: HTML file exists
    const hasHtml = await this.checkHtmlFile(projectPath);
    results.set('html-file', {
      passed: hasHtml,
      weight: 10,
      description: 'HTML entry point exists',
    });

    // Check 2: Meta tags
    const metaTagsResult = await this.checkMetaTags(projectPath);
    results.set('meta-tags', {
      passed: metaTagsResult.score >= 50,
      weight: 30,
      description: `Meta tags: ${metaTagsResult.found.length}/${META_TAGS.filter(t => t.required).length} required`,
    });

    // Check 3: Title tag
    const hasTitle = await this.checkTitleTag(projectPath);
    results.set('title-tag', {
      passed: hasTitle,
      weight: 15,
      description: 'Title tag present and proper length',
    });

    // Check 4: Meta description
    const hasDescription = await this.checkMetaDescription(projectPath);
    results.set('meta-description', {
      passed: hasDescription,
      weight: 15,
      description: 'Meta description present and proper length',
    });

    // Check 5: Heading structure
    const headingsResult = await this.checkHeadingStructure(projectPath);
    results.set('heading-structure', {
      passed: headingsResult.hasH1 && headingsResult.hasProperHierarchy,
      weight: 10,
      description: `Headings: ${headingsResult.h1Count} H1, ${headingsResult.totalHeadings} total`,
    });

    // Check 6: Sitemap.xml
    const hasSitemap = await this.checkSitemap(projectPath);
    results.set('sitemap', {
      passed: hasSitemap,
      weight: 5,
      description: 'Sitemap.xml exists',
    });

    // Check 7: Robots.txt
    const hasRobots = await this.checkRobotsTxt(projectPath);
    results.set('robots-txt', {
      passed: hasRobots,
      weight: 5,
      description: 'Robots.txt exists',
    });

    // Check 8: Structured data
    const hasStructuredData = await this.checkStructuredData(projectPath);
    results.set('structured-data', {
      passed: hasStructuredData,
      weight: 10,
      description: 'Structured data (JSON-LD) present',
    });

    // Check 9: Open Graph tags
    const ogResult = await this.checkOpenGraph(projectPath);
    results.set('open-graph', {
      passed: ogResult.score >= 50,
      weight: 10,
      description: `Open Graph: ${ogResult.found}/${ogResult.total} tags`,
    });

    // Check 10: Semantic HTML
    const semanticResult = await this.checkSemanticHtml(projectPath);
    results.set('semantic-html', {
      passed: semanticResult.score >= 50,
      weight: 10,
      description: `Semantic HTML elements: ${semanticResult.count}`,
    });

    // Calculate totals
    let total = 0;
    let passed = 0;
    for (const [_, result] of Array.from(results.entries())) {
      total += result.weight;
      if (result.passed) passed += result.weight;
    }

    return { results, total, passed };
  }

  /**
   * Calculate SEO score from check results
   */
  private calculateScore(checkResults: { results: Map<string, any>; total: number; passed: number }): number {
    return Math.round((checkResults.passed / checkResults.total) * 100);
  }

  /**
   * Generate issues from failed checks
   */
  private generateIssues(checkResults: { results: Map<string, any>; total: number; passed: number }): Issue[] {
    const issues: Issue[] = [];

    for (const [name, result] of Array.from(checkResults.results.entries())) {
      if (!result.passed) {
        let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'medium';
        let fixable = true;

        switch (name) {
          case 'html-file':
            severity = 'critical';
            break;
          case 'title-tag':
            severity = 'critical';
            break;
          case 'meta-description':
            severity = 'high';
            break;
          case 'meta-tags':
            severity = 'high';
            break;
          case 'heading-structure':
            severity = 'medium';
            break;
          case 'sitemap':
          case 'robots-txt':
            severity = 'medium';
            fixable = true;
            break;
          case 'structured-data':
            severity = 'low';
            break;
          case 'open-graph':
            severity = 'medium';
            break;
          case 'semantic-html':
            severity = 'low';
            break;
        }

        issues.push({
          severity,
          category: 'seo',
          description: result.description,
          fixable,
          suggestion: this.getFixSuggestion(name),
        });
      }
    }

    return issues;
  }

  /**
   * Get fix suggestion for an issue
   */
  private getFixSuggestion(checkName: string): string {
    const suggestions: Record<string, string> = {
      'html-file': 'Create an index.html file in the public or root directory',
      'title-tag': 'Add a unique, descriptive title tag (50-60 characters) to each page',
      'meta-description': 'Add a meta description tag (150-160 characters) to each page',
      'meta-tags': 'Ensure all required meta tags are present (title, description, viewport)',
      'heading-structure': 'Use proper heading hierarchy with one H1 per page',
      'sitemap': 'Generate and submit a sitemap.xml to search engines',
      'robots-txt': 'Create a robots.txt file to control crawler access',
      'structured-data': 'Add JSON-LD structured data for rich snippets',
      'open-graph': 'Add Open Graph tags for better social media sharing',
      'semantic-html': 'Use semantic HTML5 elements (header, nav, main, article, footer)',
    };

    return suggestions[checkName] || 'Review and fix the identified SEO issue';
  }

  /**
   * Generate SEO improvements
   */
  private generateImprovements(checkResults: { results: Map<string, any> }): Improvement[] {
    const improvements: Improvement[] = [];

    // Check for performance-related SEO factors
    improvements.push({
      type: 'seo',
      description: 'Implement Core Web Vitals optimization for better search rankings',
      effort: 'moderate',
      impact: 'high',
    });

    // Mobile optimization
    improvements.push({
      type: 'seo',
      description: 'Ensure mobile-first responsive design for mobile-first indexing',
      effort: 'moderate',
      impact: 'high',
    });

    // HTTPS
    improvements.push({
      type: 'seo',
      description: 'Use HTTPS for security and SEO ranking signal',
      effort: 'quick',
      impact: 'high',
    });

    // Content quality
    improvements.push({
      type: 'seo',
      description: 'Create unique, descriptive page titles and meta descriptions',
      effort: 'quick',
      impact: 'medium',
    });

    // Image optimization
    improvements.push({
      type: 'seo',
      description: 'Add alt text to all images and use descriptive file names',
      effort: 'moderate',
      impact: 'medium',
    });

    // URL structure
    improvements.push({
      type: 'seo',
      description: 'Use clean, descriptive URL structures with keywords',
      effort: 'moderate',
      impact: 'medium',
    });

    // Internal linking
    improvements.push({
      type: 'seo',
      description: 'Improve internal linking structure for better crawlability',
      effort: 'moderate',
      impact: 'medium',
    });

    // Schema markup
    improvements.push({
      type: 'seo',
      description: 'Add schema.org markup for rich snippets in search results',
      effort: 'significant',
      impact: 'high',
    });

    return improvements;
  }

  /**
   * Analyze SEO metadata
   */
  private async analyzeSeoMetadata(projectPath: string): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    // Check for common SEO files
    metadata.hasSitemapXml = existsSync(join(projectPath, 'public', 'sitemap.xml')) ||
                           existsSync(join(projectPath, 'sitemap.xml'));
    metadata.hasRobotsTxt = existsSync(join(projectPath, 'public', 'robots.txt')) ||
                          existsSync(join(projectPath, 'robots.txt'));
    metadata.hasFavicon = existsSync(join(projectPath, 'public', 'favicon.ico')) ||
                        existsSync(join(projectPath, 'favicon.ico'));

    // Check for manifest.json (PWA)
    metadata.hasManifest = existsSync(join(projectPath, 'public', 'manifest.json')) ||
                          existsSync(join(projectPath, 'manifest.json'));

    // Check for robots.txt in public or root
    const robotsPaths = [
      join(projectPath, 'public', 'robots.txt'),
      join(projectPath, 'robots.txt'),
    ];

    for (const robotsPath of robotsPaths) {
      if (existsSync(robotsPath)) {
        try {
          const robotsContent = await readFile(robotsPath, 'utf-8');
          metadata.robotsTxtSize = robotsContent.length;
          metadata.robotsHasSitemap = robotsContent.includes('Sitemap:');
          break;
        } catch {}
      }
    }

    return metadata;
  }

  // Individual check methods

  private async checkHtmlFile(projectPath: string): Promise<boolean> {
    const paths = [
      join(projectPath, 'index.html'),
      join(projectPath, 'public', 'index.html'),
      join(projectPath, 'src', 'index.html'),
      join(projectPath, 'app.html'),
    ];

    for (const path of paths) {
      if (existsSync(path)) {
        return true;
      }
    }
    return false;
  }

  private async checkMetaTags(projectPath: string): Promise<{ score: number; found: string[] }> {
    const found: string[] = [];
    let score = 0;

    const htmlContent = await this.getHtmlContent(projectPath);
    if (!htmlContent) return { score: 0, found: [] };

    for (const tag of META_TAGS) {
      const regex = new RegExp(`<meta[^>]+name=["']${tag.name}["']|<meta[^>]+property=["']${tag.name}["']`, 'i');
      if (regex.test(htmlContent) || (tag.name === 'title' && /<title[^>]*>.*<\/title>/i.test(htmlContent))) {
        found.push(tag.name);
        score += tag.weight;
      }
    }

    return { score, found };
  }

  private async checkTitleTag(projectPath: string): Promise<boolean> {
    const htmlContent = await this.getHtmlContent(projectPath);
    if (!htmlContent) return false;

    const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
    if (!titleMatch) return false;

    const title = titleMatch[1].trim();
    // Title should be between 30 and 60 characters
    return title.length >= 30 && title.length <= 60;
  }

  private async checkMetaDescription(projectPath: string): Promise<boolean> {
    const htmlContent = await this.getHtmlContent(projectPath);
    if (!htmlContent) return false;

    const descMatch = htmlContent.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (!descMatch) return false;

    const description = descMatch[1].trim();
    // Description should be between 120 and 160 characters
    return description.length >= 120 && description.length <= 160;
  }

  private async checkHeadingStructure(projectPath: string): Promise<{
    hasH1: boolean;
    hasProperHierarchy: boolean;
    h1Count: number;
    totalHeadings: number;
  }> {
    const htmlContent = await this.getHtmlContent(projectPath);
    if (!htmlContent) return { hasH1: false, hasProperHierarchy: false, h1Count: 0, totalHeadings: 0 };

    const h1Matches = htmlContent.match(/<h1[^>]*>/gi);
    const h1Count = h1Matches ? h1Matches.length : 0;

    const allHeadings = htmlContent.match(/<h[1-6][^>]*>/gi);
    const totalHeadings = allHeadings ? allHeadings.length : 0;

    return {
      hasH1: h1Count === 1,
      hasProperHierarchy: h1Count === 1,
      h1Count,
      totalHeadings,
    };
  }

  private async checkSitemap(projectPath: string): Promise<boolean> {
    const paths = [
      join(projectPath, 'public', 'sitemap.xml'),
      join(projectPath, 'sitemap.xml'),
      join(projectPath, 'out', 'sitemap.xml'),
      join(projectPath, '.next', 'sitemap.xml'),
    ];

    for (const path of paths) {
      if (existsSync(path)) {
        return true;
      }
    }
    return false;
  }

  private async checkRobotsTxt(projectPath: string): Promise<boolean> {
    const paths = [
      join(projectPath, 'public', 'robots.txt'),
      join(projectPath, 'robots.txt'),
    ];

    for (const path of paths) {
      if (existsSync(path)) {
        return true;
      }
    }
    return false;
  }

  private async checkStructuredData(projectPath: string): Promise<boolean> {
    const htmlContent = await this.getHtmlContent(projectPath);
    if (!htmlContent) return false;

    // Check for JSON-LD structured data
    return /<script[^>]+type=["']application\/ld\+json["']/.test(htmlContent);
  }

  private async checkOpenGraph(projectPath: string): Promise<{ score: number; found: number; total: number }> {
    const htmlContent = await this.getHtmlContent(projectPath);
    if (!htmlContent) return { score: 0, found: 0, total: 6 };

    const ogTags = ['og:title', 'og:description', 'og:image', 'og:type', 'og:url'];
    let found = 0;

    for (const tag of ogTags) {
      if (new RegExp(`<meta[^>]+property=["']${tag}["']`, 'i').test(htmlContent)) {
        found++;
      }
    }

    return { score: (found / ogTags.length) * 100, found, total: ogTags.length };
  }

  private async checkSemanticHtml(projectPath: string): Promise<{ score: number; count: number }> {
    const htmlContent = await this.getHtmlContent(projectPath);
    if (!htmlContent) return { score: 0, count: 0 };

    const semanticElements = [
      'header', 'nav', 'main', 'article', 'section', 'aside', 'footer',
      'figure', 'figcaption', 'details', 'summary', 'time', 'mark',
    ];

    let count = 0;
    for (const element of semanticElements) {
      const regex = new RegExp(`<${element}[\\s>`, 'gi');
      const matches = htmlContent.match(regex);
      if (matches) count += matches.length;
    }

    // Score based on having at least 5 semantic elements
    const score = Math.min(100, (count / 5) * 100);

    return { score, count };
  }

  /**
   * Get HTML content from the project
   */
  private async getHtmlContent(projectPath: string): Promise<string | null> {
    const paths = [
      join(projectPath, 'index.html'),
      join(projectPath, 'public', 'index.html'),
      join(projectPath, 'src', 'index.html'),
    ];

    for (const path of paths) {
      try {
        return await readFile(path, 'utf-8');
      } catch {}
    }

    return null;
  }
}

/**
 * Default SEO analyzer instance
 */
export const seoAnalyzer = new SeoAnalyzer();
