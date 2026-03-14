/**
 * Business Logic Analyzer
 *
 * Analyzes business logic quality including domain separation, business rule consistency,
 * edge case handling, and state management appropriateness.
 *
 * @module services/scoring/dimensions/business-logic
 */

import { readFile, access, readdir } from 'node:fs/promises';
import { join, extname, relative, dirname } from 'node:path';
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
 * Domain structure type
 */
type DomainStructure = 'features' | 'layered' | 'modular' | 'flat' | 'unknown';

/**
 * State management type
 */
type StateManagement = 'tanstack-query' | 'zustand' | 'redux' | 'context' | 'local' | 'unknown';

/**
 * Business logic metrics
 */
interface BusinessLogicMetrics {
  /** Domain separation score */
  domainSeparation: number;
  /** Detected structure type */
  structureType: DomainStructure;
  /** Business rule consistency */
  ruleConsistency: number;
  /** Edge case handling */
  edgeCaseHandling: number;
  /** State management appropriateness */
  stateManagementScore: number;
  /** Detected state management */
  stateManagement: StateManagement;
  /** Feature isolation */
  featureIsolation: number;
  /** DDD patterns adherence */
  dddAdherence: number;
}

/**
 * Feature module info
 */
interface FeatureModule {
  name: string;
  path: string;
  hasComponents: boolean;
  hasHooks: boolean;
  hasServices: boolean;
  hasTypes: boolean;
  hasActions: boolean;
  isolationScore: number;
}

/**
 * Business logic analyzer configuration
 */
export interface BusinessLogicAnalyzerOptions {
  /** Check domain separation */
  checkDomainSeparation?: boolean;
  /** Check business rules */
  checkBusinessRules?: boolean;
  /** Check edge case handling */
  checkEdgeCaseHandling?: boolean;
  /** Check state management */
  checkStateManagement?: boolean;
}

/**
 * Business Logic Analyzer
 *
 * Evaluates business logic quality across multiple dimensions:
 * - Domain separation (features/ pattern)
 * - Business rule consistency
 * - Edge case handling
 * - State management appropriateness
 */
export class BusinessLogicAnalyzer {
  /** Analyzer configuration */
  readonly config: DimensionAnalyzerConfig = {
    dimension: 'business-logic' as CodeDimension,
    defaultWeight: 0.05,
    estimatedDuration: 20000,
    supportedFrameworks: ['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'Angular', 'Remix', 'SvelteKit', 'Astro', 'Gatsby'],
  };

  private readonly logger: Logger;
  private readonly executor: CommandExecutor;
  private readonly _checkDomainSeparation: boolean;
  private readonly _checkBusinessRules: boolean;
  private readonly _checkEdgeCaseHandling: boolean;
  private readonly _checkStateManagement: boolean;

  constructor(options: BusinessLogicAnalyzerOptions = {}) {
    this.logger = createLogger('BusinessLogicAnalyzer');
    this.executor = new CommandExecutor();
    this._checkDomainSeparation = options.checkDomainSeparation ?? true;
    this._checkBusinessRules = options.checkBusinessRules ?? true;
    this._checkEdgeCaseHandling = options.checkEdgeCaseHandling ?? true;
    this._checkStateManagement = options.checkStateManagement ?? true;
  }

  /**
   * Get the dimension this analyzer handles
   */
  getDimension(): CodeDimension {
    return 'business-logic';
  }

  /**
   * Get the default weight for this dimension
   */
  getWeight(): number {
    return 0.10; // 10% weight in overall score
  }

  /**
   * Analyze business logic for a project
   *
   * @param projectPath - Path to the project root
   * @param _framework - Detected framework (optional, for framework-specific analysis)
   * @param _options - Scoring options (optional)
   * @returns Dimension score with business logic metrics
   */
  async analyze(projectPath: string, _framework?: Framework, _options?: ScoringOptions): Promise<DimensionScore> {
    const startTime = performance.now();

    this.logger.info(`Analyzing business logic for: ${projectPath}`);

    const issues: Issue[] = [];
    const improvements: Improvement[] = [];

    try {
      // Analyze project structure
      const structureType = this._checkDomainSeparation ? await this.analyzeProjectStructure(projectPath) : 'flat';

      // Analyze feature modules
      const featureModules = this._checkDomainSeparation ? await this.analyzeFeatureModules(projectPath) : [];

      // Check state management
      const stateManagement = this._checkStateManagement ? await this.analyzeStateManagement(projectPath) : 'unknown';

      // Check business rules consistency
      const ruleConsistency = this._checkBusinessRules ? await this.checkBusinessRuleConsistency(projectPath) : 0;

      // Check edge case handling
      const edgeCaseHandling = this._checkEdgeCaseHandling ? await this.checkEdgeCaseHandlingPatterns(projectPath) : 0;

      // Check DDD patterns
      const dddAdherence = await this.checkDddPatterns(projectPath);

      const metrics: BusinessLogicMetrics = {
        domainSeparation: this.calculateDomainSeparationScore(structureType, featureModules),
        structureType,
        ruleConsistency,
        edgeCaseHandling,
        stateManagementScore: this.calculateStateManagementScore(stateManagement),
        stateManagement,
        featureIsolation: this.calculateFeatureIsolation(featureModules),
        dddAdherence,
      };

      // Build issues list
      issues.push(...this.identifyBusinessLogicIssues(metrics));

      // Build improvements list
      improvements.push(...this.generateBusinessLogicImprovements(metrics));

      // Calculate final score
      const score = this.calculateBusinessLogicScore(metrics);

      const duration = Math.round(performance.now() - startTime);

      return {
        dimension: this.getDimension(),
        score,
        weight: this.getWeight(),
        weightedScore: score * this.getWeight(),
        issues,
        improvements,
        metadata: {
          itemsChecked: 5 + featureModules.length,
          itemsPassed: this.countPassedChecks(metrics),
          metrics: {
            structureType: metrics.structureType,
            domainSeparation: metrics.domainSeparation,
            ruleConsistency: metrics.ruleConsistency,
            edgeCaseHandling: metrics.edgeCaseHandling,
            stateManagement: metrics.stateManagement,
            stateManagementScore: metrics.stateManagementScore,
            featureIsolation: metrics.featureIsolation,
            dddAdherence: metrics.dddAdherence,
            featureModuleCount: featureModules.length,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error analyzing business logic', error);

      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: `Failed to analyze business logic: ${error instanceof Error ? error.message : String(error)}`,
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
   * Analyze project structure
   */
  private async analyzeProjectStructure(projectPath: string): Promise<DomainStructure> {
    const srcDir = join(projectPath, 'src');
    const appDir = join(projectPath, 'app');

    // Check for features directory pattern
    const featuresDir = join(srcDir, 'features');
    if (existsSync(featuresDir)) {
      return 'features';
    }

    // Check for layered architecture
    if (existsSync(join(srcDir, 'services')) && existsSync(join(srcDir, 'controllers'))) {
      return 'layered';
    }

    // Check for modular structure
    const modulesDir = join(srcDir, 'modules');
    if (existsSync(modulesDir)) {
      return 'modular';
    }

    // Check if flat (everything in one directory)
    if (existsSync(srcDir)) {
      try {
        const entries = await readdir(srcDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory());

        if (dirs.length <= 3) {
          return 'flat';
        }
      } catch {
        // Ignore
      }
    }

    return 'unknown';
  }

  /**
   * Analyze feature modules
   */
  private async analyzeFeatureModules(projectPath: string): Promise<FeatureModule[]> {
    const modules: FeatureModule[] = [];

    const featuresDir = join(projectPath, 'src', 'features');
    const modulesDir = join(projectPath, 'src', 'modules');
    const appDir = join(projectPath, 'app');

    if (existsSync(featuresDir)) {
      await this.scanFeaturesDirectory(featuresDir, modules);
    } else if (existsSync(modulesDir)) {
      await this.scanFeaturesDirectory(modulesDir, modules);
    } else if (existsSync(appDir)) {
      // Analyze app directory structure
      await this.scanAppDirectory(appDir, modules);
    }

    return modules;
  }

  /**
   * Scan features directory for feature modules
   */
  private async scanFeaturesDirectory(dir: string, modules: FeatureModule[]): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-feature directories
          if (['shared', 'common', 'lib', 'utils', 'components'].includes(entry.name)) {
            continue;
          }

          const feature = await this.analyzeFeatureModule(fullPath, entry.name);
          if (feature) {
            modules.push(feature);
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Scan app directory for feature modules
   */
  private async scanAppDirectory(dir: string, modules: FeatureModule[]): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
            // Next.js route group - treat as potential feature
            const feature = await this.analyzeFeatureModule(fullPath, entry.name);
            if (feature) {
              modules.push(feature);
            }
          } else {
            await this.scanAppDirectory(fullPath, modules);
          }
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Analyze a single feature module
   */
  private async analyzeFeatureModule(modulePath: string, name: string): Promise<FeatureModule | null> {
    try {
      const entries = await readdir(modulePath, { withFileTypes: true });

      const feature: FeatureModule = {
        name,
        path: relative(process.cwd(), modulePath),
        hasComponents: false,
        hasHooks: false,
        hasServices: false,
        hasTypes: false,
        hasActions: false,
        isolationScore: 0,
      };

      let hasFeatureFiles = 0;
      let totalFeatureFiles = 0;

      for (const entry of entries) {
        const ext = extname(entry.name);

        if (entry.isFile()) {
          totalFeatureFiles++;

          if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
            // Test files are good
            hasFeatureFiles++;
            continue;
          }

          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            try {
              const content = await readFile(join(modulePath, entry.name), 'utf-8');

              // Check for feature-specific patterns
              if (/component|Component/.test(content) || entry.name.includes('component')) {
                feature.hasComponents = true;
                hasFeatureFiles++;
              }
              if (/use[A-Z]/.test(content) || entry.name.includes('hook') || entry.name.includes('use')) {
                feature.hasHooks = true;
                hasFeatureFiles++;
              }
              if (/service|Service/.test(content) || entry.name.includes('service')) {
                feature.hasServices = true;
                hasFeatureFiles++;
              }
              if (/interface|type/.test(content) || entry.name.endsWith('.types.ts') || entry.name.endsWith('.types.js')) {
                feature.hasTypes = true;
                hasFeatureFiles++;
              }
              if (/action|Action|server/.test(content)) {
                feature.hasActions = true;
                hasFeatureFiles++;
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      }

      // Calculate isolation score based on self-contained files
      feature.isolationScore = totalFeatureFiles > 0 ? hasFeatureFiles / totalFeatureFiles : 0;

      return feature;
    } catch {
      return null;
    }
  }

  /**
   * Analyze state management
   */
  private async analyzeStateManagement(projectPath: string): Promise<StateManagement> {
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if ('@tanstack/react-query' in deps || '@tanstack/react-query' in deps) {
        return 'tanstack-query';
      }

      if ('zustand' in deps) {
        return 'zustand';
      }

      if ('@reduxjs/toolkit' in deps || 'redux' in deps) {
        return 'redux';
      }

      // Check if using only React Context
      const srcDir = join(projectPath, 'src');
      if (existsSync(srcDir)) {
        const hasContext = await this.directoryContainsPattern(srcDir, /createContext|useContext|Context\.Provider/);
        if (hasContext) {
          return 'context';
        }
      }

      return 'local';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check business rule consistency
   */
  private async checkBusinessRuleConsistency(projectPath: string): Promise<number> {
    // Check for consistent validation patterns
    const srcDir = join(projectPath, 'src');

    if (!existsSync(srcDir)) {
      return 50; // Neutral score
    }

    let hasValidation = false;
    let hasSchema = false;
    let hasConstants = false;

    await this.scanDirectoryForPatterns(srcDir, [
      { pattern: /zod\.|Joi|yup\./, found: () => { hasValidation = true; } },
      { pattern: /schema|Schema/i, found: () => { hasSchema = true; } },
      { pattern: /const\s+[A-Z_]+\s*=/, found: () => { hasConstants = true; } },
    ]);

    let score = 0;
    if (hasValidation) score += 40;
    if (hasSchema) score += 30;
    if (hasConstants) score += 30;

    return score;
  }

  /**
   * Check edge case handling
   */
  private async checkEdgeCaseHandlingPatterns(projectPath: string): Promise<number> {
    const srcDir = join(projectPath, 'src');
    const appDir = join(projectPath, 'app');

    const dirsToCheck: string[] = [];
    if (existsSync(srcDir)) dirsToCheck.push(srcDir);
    if (existsSync(appDir)) dirsToCheck.push(appDir);

    let edgeCasePatterns = 0;
    let totalPatterns = 0;

    const edgeCaseRegexes = [
      /if\s*\(\s*!/,
      /\|\|/,
      /\?\?/,
      /else\s*if/,
      /try\s*{/,
      /catch\s*\(/,
      /throw\s+new/,
      /\.default/,
      /undefined/i,
      /null/i,
    ];

    for (const dir of dirsToCheck) {
      await this.scanDirectoryForEdgeCases(dir, (count) => {
        edgeCasePatterns += count;
        totalPatterns += edgeCaseRegexes.length;
      });
    }

    if (totalPatterns === 0) return 50;

    return Math.min(100, (edgeCasePatterns / totalPatterns) * 100);
  }

  /**
   * Scan directory for edge case patterns
   */
  private async scanDirectoryForEdgeCases(dir: string, callback: (count: number) => void): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            await this.scanDirectoryForEdgeCases(fullPath, callback);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');

              let count = 0;
              const edgeCaseRegexes = [
                /if\s*\(\s*!/,
                /\|\|/,
                /\?\?/,
                /else\s*if/,
                /try\s*{/,
                /catch\s*\(/,
              ];

              for (const regex of edgeCaseRegexes) {
                if (regex.test(content)) {
                  count++;
                }
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
   * Check DDD patterns
   */
  private async checkDddPatterns(projectPath: string): Promise<number> {
    let score = 0;

    const srcDir = join(projectPath, 'src');
    if (!existsSync(srcDir)) {
      return 0;
    }

    // Check for DDD directory structure
    const dddDirs = ['domain', 'application', 'infrastructure', 'interfaces'];
    for (const dddDir of dddDirs) {
      if (existsSync(join(srcDir, dddDir))) {
        score += 25;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Scan directory for patterns
   */
  private async scanDirectoryForPatterns(dir: string, patterns: Array<{ pattern: RegExp; found: () => void }>): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            await this.scanDirectoryForPatterns(fullPath, patterns);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');

              for (const { pattern, found } of patterns) {
                if (pattern.test(content)) {
                  found();
                  break;
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
   * Check if directory contains pattern
   */
  private async directoryContainsPattern(dir: string, pattern: RegExp): Promise<boolean> {
    let found = false;

    await this.scanDirectoryForPatterns(dir, [
      { pattern, found: () => { found = true; } },
    ]);

    return found;
  }

  /**
   * Calculate domain separation score
   */
  private calculateDomainSeparationScore(structureType: DomainStructure, featureModules: FeatureModule[]): number {
    let score = 0;

    // Base score from structure type
    switch (structureType) {
      case 'features':
        score += 50;
        break;
      case 'layered':
        score += 30;
        break;
      case 'modular':
        score += 40;
        break;
      case 'flat':
        score += 10;
        break;
      default:
        score += 20;
    }

    // Bonus for well-structured feature modules
    if (featureModules.length > 0) {
      const avgIsolation = featureModules.reduce((sum, m) => sum + m.isolationScore, 0) / featureModules.length;
      score += avgIsolation * 50;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate feature isolation score
   */
  private calculateFeatureIsolation(featureModules: FeatureModule[]): number {
    if (featureModules.length === 0) return 0;

    let totalIsolation = 0;
    for (const module of featureModules) {
      let hasAll = 0;
      if (module.hasComponents) hasAll++;
      if (module.hasHooks) hasAll++;
      if (module.hasTypes) hasAll++;
      if (module.hasActions) hasAll++;

      totalIsolation += hasAll / 4;
    }

    return (totalIsolation / featureModules.length) * 100;
  }

  /**
   * Calculate state management score
   */
  private calculateStateManagementScore(stateManagement: StateManagement): number {
    const scores: Record<StateManagement, number> = {
      'tanstack-query': 100,
      'zustand': 90,
      'redux': 80,
      'context': 60,
      'local': 40,
      'unknown': 50,
    };

    return scores[stateManagement];
  }

  /**
   * Identify business logic issues
   */
  private identifyBusinessLogicIssues(metrics: BusinessLogicMetrics): Issue[] {
    const issues: Issue[] = [];

    if (metrics.structureType === 'flat') {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: 'Flat project structure detected - consider feature-based organization',
        fixable: true,
        suggestion: 'Organize code by features using the features/ pattern for better maintainability',
      });
    }

    if (metrics.domainSeparation < 50) {
      issues.push({
        severity: 'medium' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: 'Poor domain separation - business logic mixed with UI',
        fixable: true,
        suggestion: 'Separate business logic into services and use feature-based organization',
      });
    }

    if (metrics.ruleConsistency < 60) {
      issues.push({
        severity: 'low' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: 'Inconsistent business rule patterns detected',
        fixable: true,
        suggestion: 'Centralize validation rules and use schemas for consistent validation',
      });
    }

    if (metrics.edgeCaseHandling < 50) {
      issues.push({
        severity: 'low' as IssueSeverity,
        category: 'error-handling' as IssueCategory,
        description: 'Insufficient edge case handling detected',
        fixable: true,
        suggestion: 'Add proper null checks, error handling, and default values throughout the codebase',
      });
    }

    if (metrics.stateManagement === 'local' && metrics.stateManagementScore < 50) {
      issues.push({
        severity: 'low' as IssueSeverity,
        category: 'architecture' as IssueCategory,
        description: 'Only local state management detected - consider state management library for server data',
        fixable: true,
        suggestion: 'Use TanStack Query for server state and Zustand for client state',
      });
    }

    return issues;
  }

  /**
   * Generate business logic improvements
   */
  private generateBusinessLogicImprovements(metrics: BusinessLogicMetrics): Improvement[] {
    const improvements: Improvement[] = [];

    if (metrics.structureType === 'flat' || metrics.domainSeparation < 60) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Reorganize code into feature-based modules',
        effort: 'significant' as Effort,
        impact: 'high' as Impact,
        steps: [
          'Create features/ directory',
          'Group related components, hooks, and services by feature',
          'Create barrel exports for each feature',
          'Update imports to use feature paths',
        ],
      });
    }

    if (metrics.ruleConsistency < 70) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Centralize business rules and validation',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Create schemas using Zod or similar',
          'Extract business rules into service functions',
          'Define constants for business values',
          'Create shared validation utilities',
        ],
      });
    }

    if (metrics.edgeCaseHandling < 60) {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Improve edge case handling',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Add null checks for all external data',
          'Implement proper error boundaries',
          'Use default values for optional props',
          'Handle loading and error states consistently',
        ],
      });
    }

    if (metrics.stateManagement === 'local') {
      improvements.push({
        type: 'refactor' as ImprovementType,
        description: 'Implement appropriate state management strategy',
        effort: 'moderate' as Effort,
        impact: 'medium' as Impact,
        steps: [
          'Use TanStack Query for server state',
          'Use Zustand for global client state',
          'Keep component-local state for UI-only state',
          'Avoid prop drilling with context or state library',
        ],
      });
    }

    improvements.push({
      type: 'refactor' as ImprovementType,
      description: 'Consider Domain-Driven Design patterns for complex business logic',
      effort: 'major' as Effort,
      impact: 'medium' as Impact,
      steps: [
        'Identify bounded contexts in the application',
        'Create domain models with business logic',
        'Separate domain logic from application logic',
        'Implement repository patterns for data access',
      ],
    });

    return improvements;
  }

  /**
   * Calculate business logic score
   */
  private calculateBusinessLogicScore(metrics: BusinessLogicMetrics): number {
    let score = 0;

    // Domain separation (30 points)
    score += (metrics.domainSeparation / 100) * 30;

    // Business rule consistency (25 points)
    score += (metrics.ruleConsistency / 100) * 25;

    // Edge case handling (20 points)
    score += (metrics.edgeCaseHandling / 100) * 20;

    // State management (15 points)
    score += (metrics.stateManagementScore / 100) * 15;

    // Feature isolation (10 points)
    score += (metrics.featureIsolation / 100) * 10;

    return Math.min(100, score);
  }

  /**
   * Count passed checks for metadata
   */
  private countPassedChecks(metrics: BusinessLogicMetrics): number {
    let count = 0;
    if (metrics.domainSeparation >= 70) count++;
    if (metrics.ruleConsistency >= 70) count++;
    if (metrics.edgeCaseHandling >= 60) count++;
    if (metrics.stateManagementScore >= 70) count++;
    if (metrics.featureIsolation >= 60) count++;
    return count;
  }
}

/**
 * Default analyzer instance
 */
export const businessLogicAnalyzer = new BusinessLogicAnalyzer();
