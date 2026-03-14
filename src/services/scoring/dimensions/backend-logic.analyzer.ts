/**
 * Backend Logic Analyzer
 *
 * Analyzes backend code quality including API design, error handling consistency,
 * input validation, rate limiting, and caching strategy.
 *
 * @module services/scoring/dimensions/backend-logic
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
 * Backend framework types
 */
type BackendFramework = 'express' | 'fastify' | 'nest' | 'koa' | 'hono' | 'next-api';

/**
 * API route information
 */
interface ApiRoute {
  method: string;
  path: string;
  file: string;
  hasErrorHandling: boolean;
  hasValidation: boolean;
  hasRateLimit: boolean;
  statusCode: number | null;
}

/**
 * Backend metrics
 */
interface BackendMetrics {
  /** Detected framework */
  framework: BackendFramework | 'unknown';
  /** RESTful conventions adherence */
  restfulAdherence: number;
  /** Consistent status codes */
  consistentStatusCodes: boolean;
  /** Error handling presence */
  hasErrorHandling: boolean;
  /** Routes with error handling */
  routesWithErrorHandling: number;
  /** Total routes found */
  totalRoutes: number;
  /** Input validation presence */
  hasInputValidation: boolean;
  /** Routes with validation */
  routesWithValidation: number;
  /** Rate limiting presence */
  hasRateLimiting: boolean;
  /** Caching strategy presence */
  hasCaching: boolean;
  /** API versioning */
  hasApiVersioning: boolean;
}

/**
 * Backend logic analyzer configuration
 */
export interface BackendLogicAnalyzerOptions {
  /** Check API routes */
  checkApiRoutes?: boolean;
  /** Check error handling */
  checkErrorHandling?: boolean;
  /** Check input validation */
  checkInputValidation?: boolean;
  /** Check rate limiting */
  checkRateLimiting?: boolean;
  /** Check caching */
  checkCaching?: boolean;
}

/**
 * Backend Logic Analyzer
 *
 * Evaluates backend code quality across multiple dimensions:
 * - API design (REST conventions, status codes)
 * - Error handling consistency
 * - Input validation
 * - Rate limiting presence
 * - Caching strategy
 */
export class BackendLogicAnalyzer {
  /** Analyzer configuration */
  readonly config: DimensionAnalyzerConfig = {
    dimension: 'backend-logic' as CodeDimension,
    defaultWeight: 0.10,
    estimatedDuration: 25000,
    supportedFrameworks: ['NestJS', 'Express', 'Fastify', 'Hono', 'Koa', 'Next.js'],
  };

  private readonly logger: Logger;
  private readonly executor: CommandExecutor;
  private readonly checkApiRoutesFlag: boolean;
  private readonly checkErrorHandlingFlag: boolean;
  private readonly checkInputValidationFlag: boolean;
  private readonly checkRateLimitingFlag: boolean;
  private readonly checkCachingFlag: boolean;

  constructor(options: BackendLogicAnalyzerOptions = {}) {
    this.logger = createLogger('BackendLogicAnalyzer');
    this.executor = new CommandExecutor();
    this.checkApiRoutesFlag = options.checkApiRoutes ?? true;
    this.checkErrorHandlingFlag = options.checkErrorHandling ?? true;
    this.checkInputValidationFlag = options.checkInputValidation ?? true;
    this.checkRateLimitingFlag = options.checkRateLimiting ?? true;
    this.checkCachingFlag = options.checkCaching ?? true;
  }

  /**
   * Get the dimension this analyzer handles
   */
  getDimension(): CodeDimension {
    return 'backend-logic';
  }

  /**
   * Get the default weight for this dimension
   */
  getWeight(): number {
    return 0.15; // 15% weight in overall score
  }

  /**
   * Analyze backend logic for a project
   *
   * @param projectPath - Path to the project root
   * @param _framework - Detected framework (optional, for framework-specific analysis)
   * @param _options - Scoring options (optional)
   * @returns Dimension score with backend metrics
   */
  async analyze(projectPath: string, _framework?: Framework, _options?: ScoringOptions): Promise<DimensionScore> {
    const startTime = performance.now();

    this.logger.info(`Analyzing backend logic for: ${projectPath}`);

    const issues: Issue[] = [];
    const improvements: Improvement[] = [];

    try {
      // Detect backend framework
      const framework = await this.detectBackendFramework(projectPath);

      // Skip if no backend detected
      if (framework === 'unknown') {
        return this.createNoBackendResult(issues, improvements);
      }

      // Analyze API routes
      const apiRoutes = this.checkApiRoutesFlag ? await this.analyzeApiRoutes(projectPath, framework) : [];

      // Check error handling
      const errorHandling = this.checkErrorHandlingFlag ? await this.checkErrorHandling(projectPath, framework) : { hasErrorHandling: false, consistent: false };

      // Check input validation
      const inputValidation = this.checkInputValidationFlag ? await this.checkInputValidation(projectPath, framework) : { hasValidation: false, coverage: 0 };

      // Check rate limiting
      const rateLimiting = this.checkRateLimitingFlag ? await this.checkRateLimiting(projectPath, framework) : { hasRateLimiting: false };

      // Check caching
      const caching = this.checkCachingFlag ? await this.checkCaching(projectPath, framework) : { hasCaching: false, strategy: null };

      // Check API versioning
      const apiVersioning = await this.checkApiVersioning(projectPath, framework);

      const metrics: BackendMetrics = {
        framework,
        restfulAdherence: this.calculateRestfulAdherence(apiRoutes),
        consistentStatusCodes: this.checkConsistentStatusCodes(apiRoutes),
        hasErrorHandling: errorHandling.hasErrorHandling,
        routesWithErrorHandling: apiRoutes.filter((r) => r.hasErrorHandling).length,
        totalRoutes: apiRoutes.length,
        hasInputValidation: inputValidation.hasValidation,
        routesWithValidation: apiRoutes.filter((r) => r.hasValidation).length,
        hasRateLimiting: rateLimiting.hasRateLimiting,
        hasCaching: caching.hasCaching,
        hasApiVersioning: apiVersioning,
      };

      // Build issues list
      issues.push(...this.identifyBackendIssues(metrics));

      // Build improvements list
      improvements.push(...this.generateBackendImprovements(metrics));

      // Calculate final score
      const score = this.calculateBackendScore(metrics);

      const duration = Math.round(performance.now() - startTime);

      return {
        dimension: this.getDimension(),
        score,
        weight: this.getWeight(),
        weightedScore: score * this.getWeight(),
        issues,
        improvements,
        metadata: {
          itemsChecked: metrics.totalRoutes + 5,
          itemsPassed: this.countPassedChecks(metrics),
          metrics: {
            framework: metrics.framework,
            restfulAdherence: metrics.restfulAdherence,
            consistentStatusCodes: metrics.consistentStatusCodes ? 1 : 0,
            routesWithErrorHandling: metrics.routesWithErrorHandling,
            totalRoutes: metrics.totalRoutes,
            routesWithValidation: metrics.routesWithValidation,
            hasRateLimiting: metrics.hasRateLimiting ? 1 : 0,
            hasCaching: metrics.hasCaching ? 1 : 0,
            hasApiVersioning: metrics.hasApiVersioning ? 1 : 0,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error analyzing backend logic', error);

      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: `Failed to analyze backend logic: ${error instanceof Error ? error.message : String(error)}`,
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
   * Detect backend framework
   */
  private async detectBackendFramework(projectPath: string): Promise<BackendFramework | 'unknown'> {
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if ('@nestjs/core' in deps) return 'nest';
      if ('express' in deps) return 'express';
      if ('fastify' in deps) return 'fastify';
      if ('koa' in deps) return 'koa';
      if ('hono' in deps) return 'hono';

      // Check for Next.js API routes
      if (existsSync(join(projectPath, 'pages', 'api')) || existsSync(join(projectPath, 'app', 'api'))) {
        return 'next-api';
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Analyze API routes
   */
  private async analyzeApiRoutes(projectPath: string, framework: BackendFramework): Promise<ApiRoute[]> {
    const routes: ApiRoute[] = [];

    const apiDirs = [
      join(projectPath, 'pages', 'api'),
      join(projectPath, 'app', 'api'),
      join(projectPath, 'src', 'api'),
      join(projectPath, 'api'),
      join(projectPath, 'src', 'routes'),
      join(projectPath, 'routes'),
    ];

    for (const apiDir of apiDirs) {
      if (!existsSync(apiDir)) continue;

      await this.scanDirectoryForApiRoutes(apiDir, routes, framework);
    }

    return routes;
  }

  /**
   * Scan directory for API routes
   */
  private async scanDirectoryForApiRoutes(dir: string, routes: ApiRoute[], framework: BackendFramework): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectoryForApiRoutes(fullPath, routes, framework);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            const routeInfo = await this.analyzeApiFile(fullPath, framework);
            if (routeInfo) {
              routes.push(routeInfo);
            }
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Analyze a single API file
   */
  private async analyzeApiFile(filepath: string, framework: BackendFramework): Promise<ApiRoute | null> {
    try {
      const content = await readFile(filepath, 'utf-8');
      const relativePath = relative(process.cwd(), filepath);

      // Detect HTTP methods
      const methods: string[] = [];
      if (/export\s+(?:const|function|async\s+function)\s+(GET|get|HEAD|head|POST|post|PUT|put|DELETE|delete|PATCH|patch)/.test(content)) {
        const match = content.match(/(?:export\s+(?:const|function|async\s+function)\s+)(GET|get|HEAD|head|POST|post|PUT|put|DELETE|delete|PATCH|patch)/);
        if (match) methods.push(match[1].toUpperCase());
      }

      if (framework === 'next-api') {
        if (/export\s+(?:const|async\s+function)\s+default/.test(content)) {
          methods.push('GET'); // Default export for Next.js API routes
          if (content.includes('export const POST')) methods.push('POST');
        }
      }

      // Check for error handling
      const hasErrorHandling =
        /try\s*{/.test(content) ||
        /catch\s*\(/.test(content) ||
        /\.catch\(/.test(content) ||
        /error/i.test(content);

      // Check for validation
      const hasValidation =
        /zod/i.test(content) ||
        /joi/i.test(content) ||
        /yup/i.test(content) ||
        /validation/i.test(content) ||
        /schema/i.test(content);

      // Extract status code
      const statusCodeMatch = content.match(/status\((\d+)\)/);
      const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1], 10) : null;

      return {
        method: methods[0] || 'GET',
        path: relativePath,
        file: relativePath,
        hasErrorHandling,
        hasValidation,
        hasRateLimit: content.includes('rate') || content.includes('throttle'),
        statusCode,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check error handling patterns
   */
  private async checkErrorHandling(projectPath: string, framework: BackendFramework): Promise<{ hasErrorHandling: boolean; consistent: boolean }> {
    // Analyze consistency of error handling across routes
    const apiRoutes = await this.analyzeApiRoutes(projectPath, framework);

    if (apiRoutes.length === 0) {
      return { hasErrorHandling: false, consistent: false };
    }

    const routesWithErrorHandling = apiRoutes.filter((r) => r.hasErrorHandling).length;
    const hasErrorHandling = routesWithErrorHandling > 0;
    const consistent = routesWithErrorHandling === apiRoutes.length;

    return { hasErrorHandling, consistent };
  }

  /**
   * Check input validation
   */
  private async checkInputValidation(projectPath: string, framework: BackendFramework): Promise<{ hasValidation: boolean; coverage: number }> {
    const apiRoutes = await this.analyzeApiRoutes(projectPath, framework);

    if (apiRoutes.length === 0) {
      return { hasValidation: false, coverage: 0 };
    }

    const routesWithValidation = apiRoutes.filter((r) => r.hasValidation).length;
    const hasValidation = routesWithValidation > 0;
    const coverage = routesWithValidation / apiRoutes.length;

    return { hasValidation, coverage };
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimiting(projectPath: string, framework: BackendFramework): Promise<{ hasRateLimiting: boolean }> {
    // Check for rate limiting middleware or configuration
    const rateLimitPatterns = [
      /rate-limit/i,
      /express-rate-limit/i,
      /rateLimit/i,
      /throttle/i,
      /x-ratelimit/i,
    ];

    // Check package.json for rate limiting dependencies
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const dep of Object.keys(deps)) {
        if (rateLimitPatterns.some((p) => p.test(dep))) {
          return { hasRateLimiting: true };
        }
      }
    } catch {
      // Ignore
    }

    // Check API routes for rate limiting usage
    const apiRoutes = await this.analyzeApiRoutes(projectPath, framework);
    const hasRateLimiting = apiRoutes.some((r) => r.hasRateLimit);

    return { hasRateLimiting };
  }

  /**
   * Check caching strategy
   */
  private async checkCaching(projectPath: string, framework: BackendFramework): Promise<{ hasCaching: boolean; strategy: string | null }> {
    const cachePatterns = [
      /cache/i,
      /redis/i,
      /memcached/i,
      /swr/i,
      /stale-while-revalidate/i,
    ];

    // Check Next.js caching (ISR, revalidate)
    if (framework === 'next-api') {
      try {
        const appDir = join(projectPath, 'app');
        const pagesDir = join(projectPath, 'pages');

        if (existsSync(appDir)) {
          // Check for revalidate in route files
          const hasRevalidate = await this.directoryContainsPattern(appDir, /revalidate/i);
          if (hasRevalidate) {
            return { hasCaching: true, strategy: 'ISR' };
          }
        }
      } catch {
        // Ignore
      }
    }

    // Check package.json for caching dependencies
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const dep of Object.keys(deps)) {
        if (cachePatterns.some((p) => p.test(dep))) {
          return { hasCaching: true, strategy: dep };
        }
      }
    } catch {
      // Ignore
    }

    return { hasCaching: false, strategy: null };
  }

  /**
   * Check if directory contains pattern
   */
  private async directoryContainsPattern(dir: string, pattern: RegExp): Promise<boolean> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            if (await this.directoryContainsPattern(fullPath, pattern)) {
              return true;
            }
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');
              if (pattern.test(content)) {
                return true;
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

    return false;
  }

  /**
   * Check API versioning
   */
  private async checkApiVersioning(projectPath: string, framework: BackendFramework): Promise<boolean> {
    const versionPatterns = [
      /\/v\d+\//,
      /\/api\/v\d+/,
      /version.*:?/i,
    ];

    const apiDirs = [
      join(projectPath, 'app', 'api'),
      join(projectPath, 'pages', 'api'),
      join(projectPath, 'src', 'api'),
      join(projectPath, 'api'),
    ];

    for (const apiDir of apiDirs) {
      if (!existsSync(apiDir)) continue;

      const hasVersioning = await this.directoryContainsPattern(apiDir, /\/v\d+/);
      if (hasVersioning) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate RESTful adherence score
   */
  private calculateRestfulAdherence(routes: ApiRoute[]): number {
    if (routes.length === 0) return 0;

    let score = 0;
    let maxScore = 0;

    for (const route of routes) {
      maxScore += 10;

      // Proper HTTP method usage (5 points)
      if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(route.method)) {
        score += 5;
      }

      // Proper status codes (3 points)
      if (route.statusCode) {
        if (route.method === 'GET' && route.statusCode === 200) score += 3;
        if (route.method === 'POST' && route.statusCode === 201) score += 3;
        if (route.method === 'DELETE' && (route.statusCode === 204 || route.statusCode === 200)) score += 3;
        if (route.method === 'PUT' && route.statusCode === 200) score += 3;
      }

      // Error handling (2 points)
      if (route.hasErrorHandling) {
        score += 2;
      }
    }

    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  /**
   * Check consistent status codes
   */
  private checkConsistentStatusCodes(routes: ApiRoute[]): boolean {
    const statusCodes = new Set(routes.map((r) => r.statusCode).filter((c) => c !== null));

    // Should have consistent status codes for same methods
    return statusCodes.size <= routes.length;
  }

  /**
   * Identify backend issues
   */
  private identifyBackendIssues(metrics: BackendMetrics): Issue[] {
    const issues: Issue[] = [];

    if (metrics.totalRoutes === 0) {
      issues.push({
        severity: 'low' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: 'No API routes detected',
        fixable: false,
      });
      return issues;
    }

    if (metrics.restfulAdherence < 60) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: `Low RESTful adherence (${metrics.restfulAdherence.toFixed(0)}%)`,
        fixable: true,
        suggestion: 'Follow REST conventions for HTTP methods and status codes',
      });
    }

    if (!metrics.consistentStatusCodes) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: 'Inconsistent HTTP status codes across routes',
        fixable: true,
        suggestion: 'Use consistent status codes (200 for GET, 201 for POST, 204 for DELETE)',
      });
    }

    if (!metrics.hasErrorHandling || metrics.routesWithErrorHandling < metrics.totalRoutes) {
      issues.push({
        severity: 'high' as IssueSeverity,
        category: 'error-handling' as IssueCategory,
        description: `${metrics.totalRoutes - metrics.routesWithErrorHandling} route(s) lack error handling`,
        fixable: true,
        suggestion: 'Add try-catch blocks and error middleware to all routes',
      });
    }

    if (!metrics.hasInputValidation || metrics.routesWithValidation < metrics.totalRoutes) {
      issues.push({
        severity: 'high' as IssueSeverity,
        category: 'error-handling' as IssueCategory,
        description: `${metrics.totalRoutes - metrics.routesWithValidation} route(s) lack input validation`,
        fixable: true,
        suggestion: 'Add input validation using Zod, Joi, or similar',
      });
    }

    if (!metrics.hasRateLimiting) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: 'No rate limiting detected',
        fixable: true,
        suggestion: 'Implement rate limiting to prevent abuse',
      });
    }

    if (!metrics.hasCaching) {
      issues.push({
        severity: 'low' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: 'No caching strategy detected',
        fixable: true,
        suggestion: 'Consider caching for frequently accessed data',
      });
    }

    return issues;
  }

  /**
   * Generate backend improvements
   */
  private generateBackendImprovements(metrics: BackendMetrics): Improvement[] {
    const improvements: Improvement[] = [];

    if (metrics.restfulAdherence < 80) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Improve RESTful API design',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Use proper HTTP methods (GET, POST, PUT, DELETE)',
          'Return appropriate status codes',
          'Use plural nouns for resource names',
          'Implement HATEOAS for linked resources',
        ],
      });
    }

    if (!metrics.hasErrorHandling || metrics.routesWithErrorHandling < metrics.totalRoutes) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Add comprehensive error handling to all API routes',
        effort: 'moderate' as Effort,
        impact: 'high' as Impact,
        steps: [
          'Add try-catch blocks to all route handlers',
          'Implement global error middleware',
          'Return consistent error response format',
          'Log errors for debugging',
        ],
      });
    }

    if (!metrics.hasInputValidation || metrics.routesWithValidation < metrics.totalRoutes) {
      improvements.push({
        type: 'type-safe' as ImprovementType,
        description: 'Add input validation to all API routes',
        effort: 'moderate' as Effort,
        impact: 'high' as Impact,
        steps: [
          'Install validation library (Zod, Joi)',
          'Create validation schemas for request bodies',
          'Validate query parameters',
          'Sanitize user input',
        ],
      });
    }

    if (!metrics.hasRateLimiting) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Implement rate limiting',
        effort: 'quick' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Install rate limiting middleware',
          'Configure rate limits per route',
          'Add rate limit headers to responses',
        ],
      });
    }

    if (!metrics.hasCaching) {
      improvements.push({
        type: 'optimize' as ImprovementType,
        description: 'Implement caching strategy',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Identify cacheable endpoints',
          'Set appropriate cache headers',
          'Consider Redis for distributed caching',
          'Implement cache invalidation strategy',
        ],
      });
    }

    if (!metrics.hasApiVersioning) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Add API versioning',
        effort: 'moderate' as Effort,
        impact: 'low' as Impact,
        steps: [
          'Add version prefix to routes (e.g., /api/v1)',
          'Document version changes',
          'Maintain backward compatibility',
        ],
      });
    }

    return improvements;
  }

  /**
   * Calculate backend score
   */
  private calculateBackendScore(metrics: BackendMetrics): number {
    if (metrics.totalRoutes === 0) {
      return 100; // No backend = N/A = perfect for this dimension
    }

    let score = 0;

    // RESTful adherence (25 points)
    score += (metrics.restfulAdherence / 100) * 25;

    // Error handling (25 points)
    const errorHandlingRatio = metrics.routesWithErrorHandling / metrics.totalRoutes;
    score += errorHandlingRatio * 25;

    // Input validation (20 points)
    const validationRatio = metrics.routesWithValidation / metrics.totalRoutes;
    score += validationRatio * 20;

    // Rate limiting (15 points)
    if (metrics.hasRateLimiting) score += 15;

    // Caching (10 points)
    if (metrics.hasCaching) score += 10;

    // API versioning (5 points)
    if (metrics.hasApiVersioning) score += 5;

    return Math.min(100, score);
  }

  /**
   * Count passed checks for metadata
   */
  private countPassedChecks(metrics: BackendMetrics): number {
    let count = 0;
    if (metrics.restfulAdherence >= 80) count++;
    if (metrics.consistentStatusCodes) count++;
    if (metrics.routesWithErrorHandling === metrics.totalRoutes && metrics.totalRoutes > 0) count++;
    if (metrics.routesWithValidation === metrics.totalRoutes && metrics.totalRoutes > 0) count++;
    if (metrics.hasRateLimiting) count++;
    if (metrics.hasCaching) count++;
    return count;
  }

  /**
   * Create result when no backend detected
   */
  private createNoBackendResult(issues: Issue[], improvements: Improvement[]): DimensionScore {
    return {
      dimension: this.getDimension(),
      score: 100, // No backend to score
      weight: this.getWeight(),
      weightedScore: 100 * this.getWeight(),
      issues: [],
      improvements: [],
      metadata: {
        itemsChecked: 0,
        itemsPassed: 0,
        metrics: { framework: 'unknown' },
      },
    };
  }
}

/**
 * Default analyzer instance
 */
export const backendLogicAnalyzer = new BackendLogicAnalyzer();
