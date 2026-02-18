/**
 * Framework Detector Service
 *
 * Detects the web framework used in a project based on:
 * - package.json dependencies
 * - Configuration files
 * - Project structure
 *
 * Ported from agents/detector.js FRAMEWORK_PATTERNS
 */

import { readFile, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import type { Framework, PackageJson, Language, TestRunner } from '../../core/types/project.types.js';
import type { DetectionResult, FrameworkPattern, DetectionResults, DatabaseType, DependencyDetection, TestCountResult, CoverageInfo } from '../../core/types/detection.types.js';

/**
 * Framework detection patterns
 *
 * Derived from agents/detector.js FRAMEWORK_PATTERNS
 */
const FRAMEWORK_PATTERNS: FrameworkPattern[] = [
  {
    name: 'Next.js',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"next"\s*:/, scope: 'both', priority: 10 },
      { type: 'file-exists', file: 'next.config.js', shouldExist: true, priority: 8 },
      { type: 'file-exists', file: 'next.config.mjs', shouldExist: true, priority: 8 },
      { type: 'file-exists', file: 'next.config.ts', shouldExist: true, priority: 8 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'Remix',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"@remix-run\/node"\s*:/, scope: 'both', priority: 10 },
      { type: 'file-exists', file: 'remix.config.js', shouldExist: true, priority: 8 },
      { type: 'file-exists', file: 'remix.config.ts', shouldExist: true, priority: 8 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'SvelteKit',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"@sveltejs\/kit"\s*:/, scope: 'both', priority: 10 },
      { type: 'file-exists', file: 'svelte.config.js', shouldExist: true, priority: 8 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'Nuxt',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"nuxt"\s*:/, scope: 'both', priority: 10 },
      { type: 'file-exists', file: 'nuxt.config.ts', shouldExist: true, priority: 8 },
      { type: 'file-exists', file: 'nuxt.config.js', shouldExist: true, priority: 8 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'Vite + React',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"vite"\s*:/, scope: 'both', priority: 5 },
      { type: 'package-json', file: 'package.json', pattern: /"react"\s*:/, scope: 'both', priority: 5 },
    ],
    excludes: ['Next.js', 'Remix', 'SvelteKit', 'Nuxt'],
    confidenceThreshold: 0.6,
  },
  {
    name: 'Vite + Vue',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"vite"\s*:/, scope: 'both', priority: 5 },
      { type: 'package-json', file: 'package.json', pattern: /"vue"\s*:/, scope: 'both', priority: 5 },
    ],
    confidenceThreshold: 0.6,
  },
  {
    name: 'Vite + Svelte',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"vite"\s*:/, scope: 'both', priority: 5 },
      { type: 'package-json', file: 'package.json', pattern: /"svelte"\s*:/, scope: 'both', priority: 5 },
    ],
    confidenceThreshold: 0.6,
  },
  {
    name: 'Astro',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"astro"\s*:/, scope: 'both', priority: 10 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'Gatsby',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"gatsby"\s*:/, scope: 'both', priority: 10 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'Angular',
    patterns: [
      { type: 'file-exists', file: 'angular.json', shouldExist: true, priority: 10 },
    ],
    confidenceThreshold: 0.5,
  },
];

/**
 * Backend framework patterns for fallback detection
 */
const BACKEND_FRAMEWORKS: FrameworkPattern[] = [
  {
    name: 'Express',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"express"\s*:/, scope: 'dependencies', priority: 10 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'Fastify',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"fastify"\s*:/, scope: 'dependencies', priority: 10 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'Hono',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"hono"\s*:/, scope: 'dependencies', priority: 10 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'Koa',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"koa"\s*:/, scope: 'dependencies', priority: 10 },
    ],
    confidenceThreshold: 0.5,
  },
  {
    name: 'NestJS',
    patterns: [
      { type: 'package-json', file: 'package.json', pattern: /"@nestjs\/core"\s*:/, scope: 'dependencies', priority: 10 },
    ],
    confidenceThreshold: 0.5,
  },
];

/**
 * Cache entry for detection results
 */
interface CacheEntry {
  result: DetectionResult<Framework>;
  timestamp: number;
}

/**
 * Framework Detector Options
 */
export interface FrameworkDetectorOptions {
  /** Enable result caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtl?: number;
  /** Include backend frameworks in detection */
  includeBackend?: boolean;
  /** Custom patterns to add */
  customPatterns?: FrameworkPattern[];
}

/**
 * Framework detection result with scoring
 */
export interface FrameworkScore {
  /** Framework name */
  framework: Framework;
  /** Confidence score (0-1) */
  score: number;
  /** Evidence for this detection */
  evidence: string[];
}

/**
 * Framework Detector Service
 *
 * Detects web frameworks from project structure and dependencies
 */
export class FrameworkDetector {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtl: number;
  private patterns: FrameworkPattern[];
  private includeBackend: boolean;

  /**
   * Create a new FrameworkDetector
   */
  constructor(options: FrameworkDetectorOptions = {}) {
    this.cacheTtl = options.cacheTtl ?? 300_000; // 5 minutes
    this.includeBackend = options.includeBackend ?? true;
    this.patterns = this.buildPatternList(options.customPatterns);
  }

  /**
   * Build combined pattern list
   */
  private buildPatternList(customPatterns?: FrameworkPattern[]): FrameworkPattern[] {
    const basePatterns = [...FRAMEWORK_PATTERNS];
    if (this.includeBackend) {
      basePatterns.push(...BACKEND_FRAMEWORKS);
    }
    if (customPatterns) {
      basePatterns.push(...customPatterns);
    }
    return basePatterns;
  }

  /**
   * Detect framework for a project directory
   *
   * @param projectPath - Path to project root
   * @returns Detection result with framework and confidence
   */
  async detect(projectPath: string): Promise<DetectionResult<Framework>> {
    const scores = await this.detectWithScore(projectPath);

    if (scores.length === 0) {
      return {
        value: 'Unknown',
        confidence: 0,
        evidence: ['No framework patterns matched'],
      };
    }

    const top = scores[0];
    if (!top) {
      return {
        value: 'Unknown',
        confidence: 0,
        evidence: ['No framework patterns matched'],
      };
    }

    const alternatives = scores.slice(1).map((s) => ({
      value: s.framework,
      confidence: s.score,
    }));

    return {
      value: top.framework,
      confidence: top.score,
      evidence: top.evidence,
      alternatives,
    };
  }

  /**
   * Detect all matching frameworks with scores
   *
   * @param projectPath - Path to project root
   * @returns Array of frameworks sorted by confidence score
   */
  async detectWithScore(projectPath: string): Promise<FrameworkScore[]> {
    const cacheKey = this.getCacheKey(projectPath);
    const cached = this.getFromCache(cacheKey);
    if (cached && cached.value !== null) {
      return [
        {
          framework: cached.value,
          score: cached.confidence,
          evidence: cached.evidence,
        },
      ];
    }

    const pkg = await this.readPackageJson(projectPath);
    const results: FrameworkScore[] = [];

    for (const frameworkPattern of this.patterns) {
      const score = await this.scoreFramework(projectPath, frameworkPattern, pkg);

      if (score.score >= frameworkPattern.confidenceThreshold) {
        results.push(score);
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Cache the best result
    if (results.length > 0) {
      this.setToCache(cacheKey, {
        value: results[0].framework,
        confidence: results[0].score,
        evidence: results[0].evidence,
      });
    }

    return results;
  }

  /**
   * Score a single framework pattern
   */
  private async scoreFramework(
    projectPath: string,
    frameworkPattern: FrameworkPattern,
    pkg: PackageJson | null
  ): Promise<FrameworkScore> {
    let totalScore = 0;
    let maxScore = 0;
    const evidence: string[] = [];

    for (const pattern of frameworkPattern.patterns) {
      maxScore += pattern.priority;

      switch (pattern.type) {
        case 'file-exists': {
          const exists = await this.fileExists(join(projectPath, pattern.file));
          if (exists === pattern.shouldExist) {
            totalScore += pattern.priority;
            evidence.push(
              pattern.shouldExist
                ? `Found ${pattern.file}`
                : `Confirmed ${pattern.file} does not exist`
            );
          }
          break;
        }
        case 'package-json': {
          if (pkg) {
            const deps = this.getDeps(pkg, pattern.scope);
            const content = JSON.stringify(deps);
            if (pattern.pattern.test(content)) {
              totalScore += pattern.priority;
              evidence.push(`Pattern matched in ${pattern.scope}`);
            }
          }
          break;
        }
        case 'content-match': {
          const filePath = join(projectPath, pattern.file);
          try {
            const content = await readFile(filePath, 'utf-8');
            if (pattern.pattern.test(content)) {
              totalScore += pattern.priority;
              evidence.push(`Pattern matched in ${pattern.file}`);
            }
          } catch {
            // File not readable
          }
          break;
        }
      }
    }

    // Normalize score to 0-1
    const normalizedScore = maxScore > 0 ? totalScore / maxScore : 0;

    return {
      framework: frameworkPattern.name,
      score: normalizedScore,
      evidence,
    };
  }

  /**
   * Get all supported framework names
   *
   * @returns Array of framework names
   */
  getSupportedFrameworks(): Framework[] {
    return this.patterns.map((p) => p.name);
  }

  /**
   * Get patterns for a specific framework
   *
   * @param framework - Framework name
   * @returns Framework pattern or undefined
   */
  getFrameworkPattern(framework: Framework): FrameworkPattern | undefined {
    return this.patterns.find((p) => p.name === framework);
  }

  /**
   * Check if a framework is detected with high confidence
   *
   * @param projectPath - Path to project root
   * @param framework - Framework to check
   * @param threshold - Minimum confidence threshold (default: 0.7)
   * @returns True if framework is detected with confidence >= threshold
   */
  async isFramework(
    projectPath: string,
    framework: Framework,
    threshold: number = 0.7
  ): Promise<boolean> {
    const result = await this.detect(projectPath);
    return result.value === framework && result.confidence >= threshold;
  }

  /**
   * Get all detected frameworks as a ranked list
   *
   * @param projectPath - Path to project root
   * @returns Array of framework names ranked by confidence
   */
  async getRankedList(projectPath: string): Promise<Framework[]> {
    const scores = await this.detectWithScore(projectPath);
    return scores.map((s) => s.framework);
  }

  /**
   * Clear the detection cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Read and parse package.json
   */
  private async readPackageJson(projectPath: string): Promise<PackageJson | null> {
    try {
      const pkgPath = join(projectPath, 'package.json');
      const content = await readFile(pkgPath, 'utf-8');
      return JSON.parse(content) as PackageJson;
    } catch {
      return null;
    }
  }

  /**
   * Get dependencies based on scope
   */
  private getDeps(pkg: PackageJson, scope: 'dependencies' | 'devDependencies' | 'both'): Record<string, string> {
    if (scope === 'both') {
      return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    }
    return pkg[scope] ?? {};
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cache key for project path
   */
  private getCacheKey(projectPath: string): string {
    return projectPath;
  }

  /**
   * Get cached result if available and not expired
   */
  private getFromCache(key: string): DetectionResult<Framework> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTtl) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Store result in cache
   */
  private setToCache(key: string, result: DetectionResult<Framework>): void {
    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  /**
   * Detect all project information (framework, language, test runner, database)
   *
   * @param projectPath - Path to project root
   * @param options - Detection options
   * @returns Complete detection results
   */
  async detectAll(
    projectPath: string,
    options?: { verbose?: boolean }
  ): Promise<DetectionResults> {
    const startTime = Date.now();

    // Detect framework
    const frameworkResult = await this.detect(projectPath);

    // Detect language (from framework + package.json)
    const languageResult = await this.detectLanguage(projectPath);

    // Detect test runner
    const testRunnerResult = await this.detectTestRunner(projectPath);

    // Detect database
    const databaseResult = await this.detectDatabase(projectPath);

    // Count test files
    const testCounts: TestCountResult = await this.countTestFiles(projectPath);

    // Get coverage (placeholder for now)
    const coverage: CoverageInfo | null = null;

    // Detect dependencies (basic implementation)
    const dependencies: DependencyDetection[] = [];
    const pkg = await this.readPackageJson(projectPath);
    if (pkg) {
      const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      for (const [name, version] of Object.entries(allDeps)) {
        dependencies.push({
          category: 'Framework',
          packageName: name,
          version,
        });
      }
    }

    return {
      framework: frameworkResult,
      language: languageResult,
      testRunner: testRunnerResult,
      database: databaseResult,
      testCounts,
      coverage,
      duration: Date.now() - startTime,
      dependencies,
      timestamp: new Date(),
    };
  }

  /**
   * Detect project language
   */
  private async detectLanguage(projectPath: string): Promise<DetectionResult<Language>> {
    const pkg = await this.readPackageJson(projectPath);

    // Check for TypeScript
    const hasTs = pkg?.devDependencies?.typescript || pkg?.dependencies?.typescript;
    const hasTsConfig = await this.fileExists(join(projectPath, 'tsconfig.json'));

    if (hasTs || hasTsConfig) {
      return {
        value: 'TypeScript',
        confidence: hasTsConfig ? 0.9 : 0.7,
        evidence: hasTsConfig ? ['Found tsconfig.json'] : ['Found typescript in dependencies'],
      };
    }

    return {
      value: 'JavaScript',
      confidence: 0.5,
      evidence: ['Default language assumption'],
    };
  }

  /**
   * Detect test runner
   */
  private async detectTestRunner(projectPath: string): Promise<DetectionResult<TestRunner>> {
    const pkg = await this.readPackageJson(projectPath);
    const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };

    if ('vitest' in deps) {
      return {
        value: 'Vitest',
        confidence: 0.9,
        evidence: ['Found vitest in dependencies'],
      };
    }

    if ('jest' in deps) {
      return {
        value: 'Jest',
        confidence: 0.9,
        evidence: ['Found jest in dependencies'],
      };
    }

    if ('mocha' in deps) {
      return {
        value: 'Mocha',
        confidence: 0.8,
        evidence: ['Found mocha in dependencies'],
      };
    }

    // Default to vitest
    return {
      value: 'Vitest',
      confidence: 0.3,
      evidence: ['Default test runner'],
    };
  }

  /**
   * Detect database
   */
  private async detectDatabase(projectPath: string): Promise<DetectionResult<DatabaseType>> {
    const pkg = await this.readPackageJson(projectPath);
    const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };

    if ('@prisma/client' in deps || 'prisma' in deps) {
      return {
        value: 'Prisma',
        confidence: 0.9,
        evidence: ['Found Prisma in dependencies'],
      };
    }

    if ('@tanstack/react-query' in deps) {
      return {
        value: 'None',
        confidence: 0.6,
        evidence: ['Found TanStack Query (likely API client)'],
      };
    }

    return {
      value: 'None',
      confidence: 1,
      evidence: ['No database detected'],
    };
  }

  /**
   * Count test files in project
   */
  private async countTestFiles(
    projectPath: string
  ): Promise<TestCountResult> {
    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');

    let total = 0;
    let inSrc = 0;
    let outsideSrc = 0;

    const testExtensions = ['.test.ts', '.test.tsx', '.test.js', '.test.jsx', '.spec.ts', '.spec.tsx', '.spec.js', '.spec.jsx'];

    try {
      const entries = await readdir(projectPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name === 'src') {
          const srcTests = await this.countTestsInDir(join(projectPath, 'src'), testExtensions);
          inSrc = srcTests;
          total += srcTests;
        } else if (entry.isDirectory() && (entry.name === 'tests' || entry.name === 'test')) {
          const testFiles = await this.countTestsInDir(join(projectPath, entry.name), testExtensions);
          outsideSrc += testFiles;
          total += testFiles;
        } else if (entry.isFile() && testExtensions.some((ext) => entry.name.endsWith(ext))) {
          outsideSrc++;
          total++;
        }
      }
    } catch {
      // Ignore errors
    }

    return {
      total,
      inSrc,
      outsideSrc,
      byExtension: {},
    };
  }

  /**
   * Recursively count test files in directory
   */
  private async countTestsInDir(dirPath: string, testExtensions: string[]): Promise<number> {
    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');

    let count = 0;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and other common directories
          if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            continue;
          }
          count += await this.countTestsInDir(fullPath, testExtensions);
        } else if (testExtensions.some((ext) => entry.name.endsWith(ext))) {
          count++;
        }
      }
    } catch {
      // Ignore errors
    }

    return count;
  }
}

/**
 * Default framework detector instance
 */
let defaultDetector: FrameworkDetector | null = null;

/**
 * Get or create default framework detector
 */
export function getFrameworkDetector(options?: FrameworkDetectorOptions): FrameworkDetector {
  if (!defaultDetector) {
    defaultDetector = new FrameworkDetector(options);
  }
  return defaultDetector;
}

/**
 * Quick detection function using default detector
 *
 * @param projectPath - Path to project root
 * @returns Detected framework or null
 */
export async function detectFramework(projectPath: string): Promise<Framework> {
  const detector = getFrameworkDetector();
  const result = await detector.detect(projectPath);
  return result.value ?? 'Unknown';
}
