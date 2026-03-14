/**
 * Performance Detector
 *
 * Detects performance issues including:
 * - React issues: missing Memo, improper useCallback/useMemo
 * - Backend: N+1 query patterns
 * - Bundle: large chunks, code-splitting opportunities
 * - Images: unoptimized images
 * - API: missing caching, redundant calls
 * - CSS: unused styles, large CSS
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  DetectionOptions,
  Location,
  PerformanceIssue,
  PerfCategory,
  Severity,
} from '../optimization.types.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/** Performance issue patterns */
const PERF_PATTERNS: Record<
  PerfCategory,
  Array<{
    pattern: RegExp;
    impact: Severity;
    description: string;
    expectedImprovement: string;
    estimatedGain?: number;
  }>
> = {
  'react-rendering': [
    {
      pattern: /export\s+(?:const|function)\s+\w+\s*\([^)]*\)\s*{[\s\S]{300,}(?!\s*return\s*React\.memo|memo\()/gs,
      impact: 'medium',
      description: 'Large component without React.memo - may re-render unnecessarily',
      expectedImprovement: '30-50% fewer re-renders when props unchanged',
      estimatedGain: 40,
    },
    {
      pattern: /const\s+\w+\s*=\s*\(\)\s*=>\s*{[\s\S]{100,}}\s*,\s*\[\s*\]\s*\)/gs,
      impact: 'medium',
      description: 'useCallback with empty deps but large function body - may indicate missing deps',
      expectedImprovement: 'Prevent stale closures and infinite loops',
      estimatedGain: 20,
    },
    {
      pattern: /{\s*(\w+(?:\s*\|\s*\w+)*)\.map\s*\([^)]+\)\s*=>\s*<[^>]+on[A-Z]\w+=\s*{\s*\([^)]*\)\s*=>/gs,
      impact: 'high',
      description: 'Inline function in map causes new function references on each render',
      expectedImprovement: 'Eliminate unnecessary child re-renders',
      estimatedGain: 50,
    },
    {
      pattern: /<(\w+(?:\.\w+)*)(?:\s+[^>]*?)?\s*key=\{\s*\w+\s*\+\s*\d+\s*\}/gs,
      impact: 'high',
      description: 'Using index as key prevents efficient reconciliation',
      expectedImprovement: 'Proper diffing and reordering of list items',
      estimatedGain: 60,
    },
    {
      pattern: /useState\s*\(\s*\[\s*\]/s,
      impact: 'low',
      description: 'Array initialized with [] may cause issues if mutated directly',
      expectedImprovement: 'Prevent reference equality issues',
    },
  ],
  'api-efficiency': [
    {
      pattern: /for\s*(?:await|)?\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)\s*{[\s\S]*?(?:fetch\(|axios|\.get\(|\.post\()/gs,
      impact: 'high',
      description: 'Sequential API calls in loop - could be parallelized',
      expectedImprovement: '70-90% faster with Promise.all()',
      estimatedGain: 80,
    },
    {
      pattern: /await\s+(?:fetch|axios\.|http\.)(?:get|post|put|delete)\([\s\S]{0,500}\)\s*;\s*await\s+(?:fetch|axios\.|http\.)(?:get|post|put|delete)\(/gs,
      impact: 'medium',
      description: 'Sequential independent API calls - could be parallelized',
      expectedImprovement: '40-50% faster with parallel requests',
      estimatedGain: 45,
    },
    {
      pattern: /fetch\s*\([^)]+\)\s*(?!.*(?:cache|Cache-Control))/gs,
      impact: 'medium',
      description: 'Fetch without cache headers may cause redundant requests',
      expectedImprovement: 'Reduce network traffic and improve load times',
      estimatedGain: 30,
    },
  ],
  'database-queries': [
    {
      pattern: /for\s*(?:await|)?\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)\s*{[\s\S]{0,200}(?:db\.|prisma\.|sequelize\.|mongoose\.| knex\()(?:find|query|select|exec)/gs,
      impact: 'critical',
      description: 'N+1 query pattern - querying database inside loop',
      expectedImprovement: '90-99% reduction in database queries',
      estimatedGain: 95,
    },
    {
      pattern: /findMany\s*\([^)]*\)\s*;\s*(?:for|while)\s*[\s\S]{0,200}findUnique\s*\(/gs,
      impact: 'critical',
      description: 'N+1 query with Prisma - related data fetched in loop',
      expectedImprovement: 'Use include/join for eager loading',
      estimatedGain: 95,
    },
    {
      pattern: /\.find\s*\(\s*{\s*[^}]*}\s*\)\s*\.populate\s*\(/gs,
      impact: 'medium',
      description: 'Multiple populate calls may indicate missing eager load',
      expectedImprovement: 'Single query with multiple populates',
      estimatedGain: 50,
    },
    {
      pattern: /SELECT\s+\*\s+FROM/gis,
      impact: 'medium',
      description: 'SELECT * retrieves all columns - specify only needed columns',
      expectedImprovement: '20-40% less data transferred',
      estimatedGain: 30,
    },
  ],
  'bundle-size': [
    {
      pattern: /import\s+{[^}]+}\s+from\s+['"](?:lodash|moment|@material-ui|@mui|react-bootstrap)['"]/gs,
      impact: 'high',
      description: 'Full library import - use tree-shakeable imports',
      expectedImprovement: '50-200KB reduction in bundle size',
      estimatedGain: 100,
    },
    {
      pattern: /import\s+\w+\s+from\s+['"](?:lodash|@material-ui|@mui)['"]/gs,
      impact: 'high',
      description: 'Default import prevents tree-shaking',
      expectedImprovement: 'Enable tree-shaking with named imports',
      estimatedGain: 80,
    },
    {
      pattern: /import\s+{[^}]+}\s+from\s+['"]\.\.?\/[^'"]+['"]\s*;(?![\s\S]{0,1000}?lazy|Suspense)/gs,
      impact: 'low',
      description: 'Large component could be code-split with lazy loading',
      expectedImprovement: 'Reduce initial bundle size',
      estimatedGain: 15,
    },
  ],
  'asset-optimization': [
    {
      pattern: /<(?:img|Image)\s+[^>]*src=\s*['"][^'"]*\.(?:png|jpg|jpeg|gif)['"][^>]*(?!\s*width\s*=|\s*height\s*=)/gs,
      impact: 'medium',
      description: 'Image without width/height causes layout shift',
      expectedImprovement: 'Better CLS score and user experience',
      estimatedGain: 25,
    },
    {
      pattern: /<(?:img|Image)\s+[^>]*src=\s*['"][^'"]*(?!\.webp|\.avif)(?:\.png|\.jpg|\.jpeg)['"]/gs,
      impact: 'low',
      description: 'Could use modern image formats (WebP/AVIF) for better compression',
      expectedImprovement: '20-50% smaller image files',
      estimatedGain: 35,
    },
    {
      pattern: /<(?:img|Image)[^>]*src=\s*['"][^'"]*(?!\?auto=format)[^'"]*['"][^>]*(?!\s*loading=\s*['"]lazy['"])/gs,
      impact: 'low',
      description: 'Below-fold image without lazy loading',
      expectedImprovement: 'Faster initial page load',
      estimatedGain: 20,
    },
  ],
  'css-optimization': [
    {
      pattern: /style=\s*{[^}]*backgroundColor:\s*[^}'\s]+[^}]*}/gs,
      impact: 'low',
      description: 'Inline styles prevent CSS optimization',
      expectedImprovement: 'Move to CSS class for better caching',
      estimatedGain: 10,
    },
    {
      pattern: /<style[^>]*>[\s\S]{1000,}<\/style>/gs,
      impact: 'medium',
      description: 'Large inline style block - consider CSS modules or external CSS',
      expectedImprovement: 'Better caching and smaller HTML',
      estimatedGain: 20,
    },
  ],
  'memory-usage': [
    {
      pattern: /useState\s*\(\s*(?:new Array\(|Array\(|\[\s*\.\.\.)/gs,
      impact: 'medium',
      description: 'Large array in state may cause memory issues',
      expectedImprovement: 'Consider pagination or virtualization',
      estimatedGain: 40,
    },
    {
      pattern: /useEffect\s*\(\s*\(\)\s*=>\s*{[\s\S]*?const\s+\w+\s*=\s*new\s+(?:Map|Set|WeakMap|WeakSet)/gs,
      impact: 'low',
      description: 'Creating new Map/Set on every render without cleanup',
      expectedImprovement: 'Use useMemo or move outside component',
      estimatedGain: 15,
    },
  ],
  'network-requests': [
    {
      pattern: /useEffect\s*\(\s*\(\)\s*=>\s*{[\s\S]{0,500}fetch\([^)]+\)[\s\S]{0,500},\s*\[\s*\]\s*\)/gs,
      impact: 'low',
      description: 'Data fetch on every mount - consider caching',
      expectedImprovement: 'Use React Query or SWR for caching',
      estimatedGain: 50,
    },
    {
      pattern: /<link\s+[^>]*rel=\s*['"]stylesheet['"][^>]*>(?![\s\S]{0,100}?rel=['"]preload['"])/gs,
      impact: 'medium',
      description: 'Stylesheet could be preloaded for faster rendering',
      expectedImprovement: 'Faster initial render',
      estimatedGain: 15,
    },
  ],
};

/**
 * Performance Detector Service
 */
export class PerfDetector {
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger('PerfDetector');
  }

  /**
   * Detect performance issues in a single file
   */
  async detectInFile(
    filePath: string,
    content: string,
    options: DetectionOptions = {}
  ): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    // Filter by categories if specified
    const categoriesToCheck = options.perfCategories?.length
      ? options.perfCategories
      : (Object.keys(PERF_PATTERNS) as PerfCategory[]);

    for (const category of categoriesToCheck) {
      const patterns = PERF_PATTERNS[category];
      if (!patterns) continue;

      for (const { pattern, impact, description, expectedImprovement, estimatedGain } of patterns) {
        const matches = this.findAllMatches(content, pattern);

        for (const match of matches) {
          const location = this.findLocation(content, match.start);

          // Check severity filter
          if (options.minSeverity && !this.isSeverityMatch(impact, options.minSeverity)) {
            continue;
          }

          const issue: PerformanceIssue = {
            id: this.generateIssueId(filePath, category, location.line),
            category,
            impact,
            description,
            location: {
              filePath: path.relative(process.cwd(), filePath),
              line: location.line,
              column: location.column,
            },
            currentMetrics: this.extractMetrics(match.text, category),
            expectedImprovement,
            estimatedGain,
          };

          issues.push(issue);
        }
      }
    }

    return issues;
  }

  /**
   * Detect performance issues across all files in a directory
   */
  async detectInDirectory(
    dirPath: string,
    options: DetectionOptions = {}
  ): Promise<PerformanceIssue[]> {
    const allIssues: PerformanceIssue[] = [];
    const files = await this.getRelevantFiles(dirPath, options);

    this.logger.info(`Scanning ${files.length} files for performance issues...`);

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const issues = await this.detectInFile(filePath, content, options);
        allIssues.push(...issues);
      } catch (error) {
        this.logger.warn(`Failed to analyze ${filePath}:`, error);
      }
    }

    this.logger.info(`Found ${allIssues.length} performance issues`);
    return allIssues;
  }

  /**
   * Get prioritized list of performance issues
   */
  prioritizeIssues(issues: PerformanceIssue[]): PerformanceIssue[] {
    const impactWeight: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

    return issues.sort((a, b) => {
      // First by estimated gain
      if ((a.estimatedGain || 0) !== (b.estimatedGain || 0)) {
        return (b.estimatedGain || 0) - (a.estimatedGain || 0);
      }

      // Then by impact
      const impactDiff = (impactWeight[b.impact] ?? 0) - (impactWeight[a.impact] ?? 0);
      if (impactDiff !== 0) return impactDiff;

      return 0;
    });
  }

  /**
   * Get issues by category
   */
  getIssuesByCategory(issues: PerformanceIssue[], category: PerfCategory): PerformanceIssue[] {
    return issues.filter(issue => issue.category === category);
  }

  /**
   * Get issues by impact level
   */
  getIssuesByImpact(issues: PerformanceIssue[], impact: Severity): PerformanceIssue[] {
    return issues.filter(issue => issue.impact === impact);
  }

  /**
   * Calculate total potential improvement
   */
  calculateTotalImprovement(issues: PerformanceIssue[]): {
    estimatedGain: number;
    byCategory: Record<PerfCategory, number>;
  } {
    const byCategory: Record<string, number> = {};
    let totalGain = 0;

    for (const issue of issues) {
      const gain = issue.estimatedGain || 0;
      totalGain += gain;
      byCategory[issue.category] = (byCategory[issue.category] || 0) + gain;
    }

    return {
      estimatedGain: Math.min(totalGain, 100), // Cap at 100%
      byCategory: byCategory as Record<PerfCategory, number>,
    };
  }

  /**
   * Generate statistics summary
   */
  generateSummary(issues: PerformanceIssue[]): {
    total: number;
    byCategory: Record<PerfCategory, number>;
    byImpact: Record<Severity, number>;
    totalEstimatedGain: number;
  } {
    const byCategory: Record<string, number> = {};
    const byImpact: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    let totalEstimatedGain = 0;

    for (const issue of issues) {
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
      byImpact[issue.impact]++;
      totalEstimatedGain += issue.estimatedGain || 0;
    }

    return {
      total: issues.length,
      byCategory: byCategory as Record<PerfCategory, number>,
      byImpact,
      totalEstimatedGain: Math.min(totalEstimatedGain, 100),
    };
  }

  /**
   * Find all regex matches in content with their positions
   */
  private findAllMatches(content: string, pattern: RegExp): Array<{ start: number; end: number; text: string }> {
    const matches: Array<{ start: number; end: number; text: string }> = [];
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(content)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      });
    }

    return matches;
  }

  /**
   * Find line and column for a position in content
   */
  private findLocation(content: string, position: number): { line: number; column: number } {
    const before = content.substring(0, position);
    const lines = before.split('\n');

    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  /**
   * Generate unique issue ID
   */
  private generateIssueId(filePath: string, category: PerfCategory, line: number): string {
    const hash = Buffer.from(`${filePath}:${category}:${line}`).toString('base64').slice(0, 8);
    return `perf-${category}-${hash}`;
  }

  /**
   * Check if severity matches minimum requirement
   */
  private isSeverityMatch(severity: Severity, minSeverity: Severity): boolean {
    const order: Severity[] = ['high', 'medium', 'low'];
    return order.indexOf(severity) <= order.indexOf(minSeverity);
  }

  /**
   * Extract metrics from matched text
   */
  private extractMetrics(text: string, category: PerfCategory): Array<{ name: string; value: number; unit: string }> {
    const metrics: Array<{ name: string; value: number; unit: string }> = [];

    switch (category) {
      case 'bundle-size':
        // Estimate bundle impact
        const sizeMatch = text.match(/(?:lodash|moment|@material-ui|@mui)/);
        if (sizeMatch) {
          metrics.push({ name: 'potential_reduction', value: 100, unit: 'KB' });
        }
        break;

      case 'database-queries':
        // Count potential queries
        const loopMatch = text.match(/for\s*\(/gi);
        if (loopMatch) {
          metrics.push({ name: 'queries_multiplier', value: loopMatch.length, unit: 'x' });
        }
        break;

      case 'api-efficiency':
        const fetchMatch = text.match(/fetch|axios|\.get\(|\.post\(/gi);
        if (fetchMatch) {
          metrics.push({ name: 'sequential_calls', value: fetchMatch.length, unit: 'calls' });
        }
        break;
    }

    return metrics;
  }

  /**
   * Get relevant files to scan
   */
  private async getRelevantFiles(
    dirPath: string,
    options: DetectionOptions
  ): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.css', '.scss', '.html'];

    async function walk(currentPath: string) {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          // Skip node_modules and common exclusions
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '.next' ||
            entry.name === 'coverage'
          ) {
            continue;
          }

          // Check exclude patterns
          if (options.excludePatterns?.some(pattern => entry.name.match(pattern))) {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              if (
                !options.includePatterns?.length ||
                options.includePatterns.some(pattern => entry.name.match(pattern))
              ) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await walk(dirPath);
    return files;
  }
}
