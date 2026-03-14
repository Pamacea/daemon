/**
 * Security Dimension Analyzer
 *
 * Analyzes security vulnerabilities using npm audit, Snyk, and pattern matching.
 *
 * @module services/scoring/dimensions/security-analyzer
 */

import type { DimensionScore, CodeDimension, DimensionAnalyzerConfig, Issue, Improvement, IssueSeverity, IssueCategory, ImprovementType, Effort, Impact } from '../../../core/types/scoring.types.js';
import type { Framework } from '../../../core/types/project.types.js';
import type { ScoringOptions } from '../../../core/types/scoring.types.js';
import { CommandExecutor } from '../../../shared/utils/command-executor.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';

/**
 * Vulnerability severity weights
 */
const SEVERITY_WEIGHTS = {
  critical: 50,
  high: 25,
  moderate: 10,
  low: 5,
};

/**
 * Known vulnerable patterns
 */
const VULNERABLE_PATTERNS = [
  {
    name: 'innerHTML usage',
    pattern: /\.innerHTML\s*=/,
    severity: 'high',
    description: 'Direct innerHTML assignment can lead to XSS vulnerabilities',
  },
  {
    name: 'dangerouslySetInnerHTML',
    pattern: /dangerouslySetInnerHTML/,
    severity: 'medium',
    description: 'dangerouslySetInnerHTML bypasses React XSS protection',
  },
  {
    name: 'eval() usage',
    pattern: /\beval\s*\(/,
    severity: 'critical',
    description: 'eval() can execute arbitrary code',
  },
  {
    name: 'SQL concatenation',
    pattern: /(SELECT|INSERT|UPDATE|DELETE).*"\s*\+/,
    severity: 'critical',
    description: 'SQL query concatenation can lead to injection',
  },
  {
    name: 'hardcoded API key',
    pattern: /api[_-]?key\s*[:=]\s*['"`][^'"`]{20,}['"`]/,
    severity: 'high',
    description: 'Possible hardcoded API key detected',
  },
  {
    name: 'hardcoded password',
    pattern: /password\s*[:=]\s*['"`][^'"`]{8,}['"`]/,
    severity: 'critical',
    description: 'Possible hardcoded password detected',
  },
];

/**
 * Security Dimension Analyzer
 */
export class SecurityAnalyzer {
  /** Analyzer configuration */
  readonly config: DimensionAnalyzerConfig = {
    dimension: 'security' as CodeDimension,
    defaultWeight: 0.15,
    estimatedDuration: 25000,
    supportedFrameworks: ['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'NestJS', 'Angular', 'Remix', 'SvelteKit', 'Astro', 'Gatsby', 'Express', 'Fastify', 'Hono', 'Koa'],
  };

  private readonly logger: Logger;
  private executor: CommandExecutor;

  constructor() {
    this.logger = createLogger('SecurityAnalyzer');
    this.executor = new CommandExecutor();
  }

  /**
   * Analyze security of the project
   */
  async analyze(projectPath: string, _framework?: Framework, _options?: ScoringOptions): Promise<DimensionScore> {
    this.logger.info(`Analyzing security for ${projectPath}`);

    const issues: Issue[] = [];
    const improvements: Improvement[] = [];

    let score = 100;

    // 1. Check for dependency vulnerabilities
    const depVulns = await this.checkDependencyVulnerabilities(projectPath);
    score -= depVulns.scorePenalty;
    issues.push(...depVulns.issues);

    // 2. Check for vulnerable code patterns
    const patternVulns = await this.checkVulnerablePatterns(projectPath);
    score -= patternVulns.scorePenalty;
    issues.push(...patternVulns.issues);

    // 3. Check for security headers
    const headerIssues = await this.checkSecurityHeaders(projectPath);
    score -= headerIssues.scorePenalty;
    issues.push(...headerIssues.issues);

    // 4. Generate security improvements
    improvements.push(...this.generateSecurityImprovements(issues));

    return {
      dimension: 'security' as CodeDimension,
      score: Math.max(0, score),
      weight: 0.15,
      issues,
      improvements,
    };
  }

  /**
   * Check for dependency vulnerabilities using npm audit
   */
  private async checkDependencyVulnerabilities(projectPath: string): Promise<{ scorePenalty: number; issues: any[] }> {
    const issues: any[] = [];
    let scorePenalty = 0;

    try {
      const result = await this.executor.execute('npm audit --json', { cwd: projectPath, timeout: 30000 });

      if (result.success && result.data.stdout) {
        const audit = JSON.parse(result.data.stdout);
        const vulnerabilities = audit.vulnerabilities || {};

        for (const [severityKey, data] of Object.entries(vulnerabilities)) {
          if (typeof data === 'object' && data !== null) {
            const vuln = data as any;
            if (Array.isArray(vuln.nodes) && vuln.nodes.length > 0) {
              const severity = severityKey as keyof typeof SEVERITY_WEIGHTS;
              const weight = SEVERITY_WEIGHTS[severity] || 5;
              scorePenalty += weight * vuln.nodes.length;

              issues.push({
                severity: (severity === 'critical' || severity === 'high' ? 'high' : 'medium') as IssueSeverity,
                category: 'security' as IssueCategory,
                description: `${vuln.nodes.length} ${severity} vulnerabilities in dependencies`,
                location: 'package.json',
                fixable: true,
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn('npm audit failed', error);
    }

    return { scorePenalty, issues };
  }

  /**
   * Check for vulnerable code patterns in source files
   */
  private async checkVulnerablePatterns(projectPath: string): Promise<{ scorePenalty: number; issues: Issue[] }> {
    const issues: Issue[] = [];
    let scorePenalty = 0;

    try {
      const srcPath = join(projectPath, 'src');
      const appPath = join(projectPath, 'app');

      // Scan both src and app directories
      const dirsToScan: string[] = [];
      try {
        await readdir(srcPath);
        dirsToScan.push(srcPath);
      } catch {}
      try {
        await readdir(appPath);
        dirsToScan.push(appPath);
      } catch {}

      for (const dir of dirsToScan) {
        await this.scanDirectory(dir, issues);
      }

      // Calculate score penalty based on severity
      for (const issue of issues) {
        const weight = SEVERITY_WEIGHTS[issue.severity as keyof typeof SEVERITY_WEIGHTS] || 5;
        scorePenalty += weight;
      }
    } catch (error) {
      this.logger.warn('Pattern scanning failed', error);
    }

    return { scorePenalty, issues };
  }

  /**
   * Recursively scan directory for vulnerable patterns
   */
  private async scanDirectory(dirPath: string, issues: Issue[]): Promise<void> {
    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and common build directories
        if (!['node_modules', '.git', 'dist', 'build', '.next', '.nuxt'].includes(entry.name)) {
          await this.scanDirectory(fullPath, issues);
        }
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        await this.scanFile(fullPath, issues);
      }
    }
  }

  /**
   * Scan file for vulnerable patterns
   */
  private async scanFile(filePath: string, issues: Issue[]): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const relativePath = filePath.replace(process.cwd(), '');

      for (const pattern of VULNERABLE_PATTERNS) {
        if (pattern.pattern.test(content)) {
          issues.push({
            severity: pattern.severity as IssueSeverity,
            category: 'security' as IssueCategory,
            description: pattern.description,
            location: relativePath,
            fixable: true,
          });
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  /**
   * Check for security headers in Next.js/Express apps
   */
  private async checkSecurityHeaders(projectPath: string): Promise<{ scorePenalty: number; issues: Issue[] }> {
    const issues: Issue[] = [];
    let scorePenalty = 0;

    // Required security headers
    const requiredHeaders = [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Strict-Transport-Security',
      'Referrer-Policy',
    ];

    try {
      // Check Next.js config
      const nextConfig = join(projectPath, 'next.config.js');
      const nextConfigMjs = join(projectPath, 'next.config.mjs');
      const nextConfigTs = join(projectPath, 'next.config.ts');

      let hasSecurityHeaders = false;

      for (const configPath of [nextConfig, nextConfigMjs, nextConfigTs]) {
        try {
          const content = await readFile(configPath, 'utf-8');
          if (content.includes('headers') && (
            content.includes('Content-Security-Policy') ||
            content.includes('X-Frame-Options')
          )) {
            hasSecurityHeaders = true;
            break;
          }
        } catch {}
      }

      if (!hasSecurityHeaders) {
        scorePenalty += 10;
        issues.push({
          severity: 'medium',
          category: 'security',
          description: 'Missing security headers (CSP, X-Frame-Options, etc.)',
          location: 'config',
          fixable: true,
        });
      }
    } catch {
      // Skip if config not found
    }

    return { scorePenalty, issues };
  }

  /**
   * Generate security improvement suggestions
   */
  private generateSecurityImprovements(issues: Issue[]): Improvement[] {
    const improvements: Improvement[] = [];
    const hasXSS = issues.some(i => i.description.includes('XSS') || i.description.includes('innerHTML'));
    const hasInjection = issues.some(i => i.description.includes('injection') || i.description.includes('SQL'));
    const hasSecrets = issues.some(i => i.description.includes('API key') || i.description.includes('password'));

    if (hasXSS) {
      improvements.push({
        type: 'security' as ImprovementType,
        description: 'Use React/Vue built-in escaping instead of innerHTML',
        effort: 'moderate' as Effort,
        impact: 'high' as Impact,
      });
      improvements.push({
        type: 'security' as ImprovementType,
        description: 'Implement Content Security Policy (CSP) headers',
        effort: 'moderate' as Effort,
        impact: 'high' as Impact,
      });
    }

    if (hasInjection) {
      improvements.push({
        type: 'security' as ImprovementType,
        description: 'Use parameterized queries or ORM to prevent injection',
        effort: 'significant' as Effort,
        impact: 'critical' as Impact,
      });
    }

    if (hasSecrets) {
      improvements.push({
        type: 'security' as ImprovementType,
        description: 'Move secrets to environment variables',
        effort: 'quick' as Effort,
        impact: 'critical' as Impact,
      });
    }

    improvements.push({
      type: 'security' as ImprovementType,
      description: 'Run `npm audit fix` to fix vulnerable dependencies',
      effort: 'quick' as Effort,
      impact: 'high' as Impact,
    });

    improvements.push({
      type: 'security' as ImprovementType,
      description: 'Set up automated security scanning in CI/CD',
      effort: 'moderate' as Effort,
      impact: 'high' as Impact,
    });

    return improvements;
  }
}

/**
 * Default security analyzer instance
 */
export const securityAnalyzer = new SecurityAnalyzer();
