/**
 * Dependency Analyzer
 *
 * Analyse des dépendances du projet:
 * - Détection des packages obsolètes
 * - Vulnérabilités de sécurité
 * - Dépendances en double
 * - Dépendances non utilisées
 * - Conformité des licences
 *
 * @module services/review/analyzers/dependency-analyzer
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { access, constants } from 'node:fs/promises';

import type {
  Issue,
  DependencyAnalysis,
  DependencyInfo,
  DependencyAnalyzerConfig,
} from '../review.types.js';
import type { DockerExecResult } from '../../../core/types/docker.types.js';
import { DockerManager } from '../../docker/docker-manager.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Licence MIT (permissive)
 */
const PERMISSIVE_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD'];

/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG: DependencyAnalyzerConfig = {
  checkOutdated: true,
  checkVulnerabilities: true,
  detectUnused: true,
  detectDuplicates: true,
  checkLicenses: true,
  allowedLicenses: PERMISSIVE_LICENSES,
};

/**
 * Analyseur de dépendances
 */
export class DependencyAnalyzer {
  private readonly docker: DockerManager;
  private readonly logger: Logger;
  private config: DependencyAnalyzerConfig;
  private issueCounter = 0;

  constructor(config: DependencyAnalyzerConfig = {}, docker?: DockerManager) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.docker = docker ?? new DockerManager();
    this.logger = createLogger('DependencyAnalyzer');
  }

  /**
   * Configure l'analyseur
   */
  configure(config: Partial<DependencyAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Analyse les dépendances d'un projet
   *
   * @param projectPath - Chemin du projet à analyser
   * @returns Analyse des dépendances et issues
   */
  async analyze(projectPath: string): Promise<{ analysis: DependencyAnalysis; issues: Issue[] }> {
    this.issueCounter = 0;
    const startTime = performance.now();

    this.logger.info(`Starting dependency analysis for: ${projectPath}`);

    // Lire le package.json
    const pkgJson = await this.readPackageJson(projectPath);
    if (!pkgJson) {
      this.logger.warn('No package.json found');
      return {
        analysis: {
          outdated: [],
          vulnerable: [],
          unused: [],
          duplicates: [],
          licenseIssues: [],
        },
        issues: [],
      };
    }

    const analysis: DependencyAnalysis = {
      outdated: [],
      vulnerable: [],
      unused: [],
      duplicates: [],
      licenseIssues: [],
    };

    const issues: Issue[] = [];

    // Vérifier les packages obsolètes
    if (this.config.checkOutdated) {
      const outdated = await this.checkOutdated(projectPath, pkgJson);
      analysis.outdated = outdated;
      for (const dep of outdated) {
        issues.push(this.dependencyToIssue(dep, 'outdated'));
      }
    }

    // Vérifier les vulnérabilités
    if (this.config.checkVulnerabilities) {
      const vulnerable = await this.checkVulnerabilities(projectPath);
      analysis.vulnerable = vulnerable;
      for (const dep of vulnerable) {
        issues.push(this.dependencyToIssue(dep, 'vulnerable'));
      }
    }

    // Détecter les dépendances non utilisées
    if (this.config.detectUnused) {
      const unused = await this.detectUnused(projectPath, pkgJson);
      analysis.unused = unused;
      for (const dep of unused) {
        issues.push(this.dependencyToIssue(dep, 'unused'));
      }
    }

    // Détecter les doublons
    if (this.config.detectDuplicates) {
      const duplicates = await this.detectDuplicates(projectPath);
      analysis.duplicates = duplicates;
      for (const dup of duplicates) {
        issues.push(this.duplicateToIssue(dup, projectPath));
      }
    }

    // Vérifier les licences
    if (this.config.checkLicenses) {
      const licenseIssues = await this.checkLicenses(projectPath, pkgJson);
      analysis.licenseIssues = licenseIssues;
      for (const issue of licenseIssues) {
        issues.push(this.licenseIssueToIssue(issue, projectPath));
      }
    }

    const duration = Math.round(performance.now() - startTime);
    this.logger.info(`Dependency analysis completed in ${duration}ms (${issues.length} issues found)`);

    return { analysis, issues };
  }

  /**
   * Vérifie les packages obsolètes
   */
  private async checkOutdated(projectPath: string, pkgJson: PackageJson): Promise<DependencyInfo[]> {
    const outdated: DependencyInfo[] = [];

    try {
      const command = 'npm outdated --json';
      const result = await this.docker.exec(command, {
        workingDir: projectPath,
        timeout: 60000,
      });

      if (!result.success || !result.stdout) {
        return outdated;
      }

      const outdatedData = JSON.parse(result.stdout) as Record<string, OutdatedPackage>;

      for (const [name, info] of Object.entries(outdatedData)) {
        const depType = this.getDependencyType(pkgJson, name);
        outdated.push({
          name,
          version: info.current,
          latest: info.latest,
          type: depType,
          isUsed: true, // On assume que c'est utilisé si dans package.json
        });
      }
    } catch (error) {
      // npm outdated peut échouer
      this.logger.debug('npm outdated check failed');
    }

    return outdated;
  }

  /**
   * Vérifie les vulnérabilités de sécurité
   */
  private async checkVulnerabilities(projectPath: string): Promise<DependencyInfo[]> {
    const vulnerable: DependencyInfo[] = [];

    try {
      const command = 'npm audit --json';
      const result = await this.docker.exec(command, {
        workingDir: projectPath,
        timeout: 60000,
      });

      if (!result.success || !result.stdout) {
        return vulnerable;
      }

      const auditResult = JSON.parse(result.stdout) as NpmAuditResult;

      for (const [vulnId, vuln] of Object.entries(auditResult.vulnerabilities ?? {})) {
        vulnerable.push({
          name: vuln.name,
          version: vuln.range?.split(' ')[1] ?? 'unknown',
          latest: vuln.fixAvailable?.version,
          vulnerableVersions: [vuln.range ?? 'unknown'],
          vulnerabilitySeverity: this.mapSeverity(vuln.severity),
          isUsed: true,
          type: 'dependencies' as const,
        });
      }
    } catch (error) {
      this.logger.debug('npm audit check failed');
    }

    return vulnerable;
  }

  /**
   * Détecte les dépendances non utilisées
   */
  private async detectUnused(projectPath: string, pkgJson: PackageJson): Promise<DependencyInfo[]> {
    const unused: DependencyInfo[] = [];

    try {
      const command = 'npx depcheck --json';
      const result = await this.docker.exec(command, {
        workingDir: projectPath,
        timeout: 60000,
      });

      if (!result.success || !result.stdout) {
        return unused;
      }

      const depcheckResult = JSON.parse(result.stdout) as DepcheckResult;

      // Dépendances non utilisées
      for (const dep of depcheckResult.dependencies ?? []) {
        unused.push({
          name: dep,
          version: pkgJson.dependencies?.[dep] ?? pkgJson.devDependencies?.[dep] ?? 'unknown',
          type: pkgJson.dependencies?.[dep] ? 'dependencies' : 'devDependencies',
          isUsed: false,
        });
      }

      // DevDependencies non utilisées
      for (const dep of depcheckResult.devDependencies ?? []) {
        unused.push({
          name: dep,
          version: pkgJson.devDependencies?.[dep] ?? 'unknown',
          type: 'devDependencies',
          isUsed: false,
        });
      }
    } catch (error) {
      this.logger.debug('depcheck failed, skipping unused detection');
    }

    return unused;
  }

  /**
   * Détecte les dépendances en double
   */
  private async detectDuplicates(projectPath: string): Promise<Array<{ name: string; versions: string[] }>> {
    const duplicates: Array<{ name: string; versions: string[] }> = [];

    try {
      const command = 'npm ls --json --depth=0';
      const result = await this.docker.exec(command, {
        workingDir: projectPath,
        timeout: 30000,
      });

      if (!result.success || !result.stdout) {
        return duplicates;
      }

      const lsResult = JSON.parse(result.stdout) as NpmLsResult;

      // Analyser les dépendances pour trouver les doublons
      const seenVersions: Record<string, Set<string>> = {};

      const traverse = (deps: Record<string, NpmDependency> | undefined) => {
        if (!deps) return;

        for (const [name, info] of Object.entries(deps)) {
          if (!seenVersions[name]) {
            seenVersions[name] = new Set();
          }
          if (info.version) {
            seenVersions[name].add(info.version);
          }

          if (info.dependencies) {
            traverse(info.dependencies);
          }
        }
      };

      if (lsResult.dependencies) {
        traverse(lsResult.dependencies);
      }

      // Filtrer les doublons
      for (const [name, versions] of Object.entries(seenVersions)) {
        if (versions.size > 1) {
          duplicates.push({
            name,
            versions: Array.from(versions),
          });
        }
      }
    } catch (error) {
      this.logger.debug('npm ls failed, skipping duplicate detection');
    }

    return duplicates;
  }

  /**
   * Vérifie les licences des dépendances
   */
  private async checkLicenses(
    projectPath: string,
    pkgJson: PackageJson
  ): Promise<Array<{ name: string; license: string; issue: string }>> {
    const issues: Array<{ name: string; license: string; issue: string }> = [];

    try {
      const command = 'npx license-checker --production --json';
      const result = await this.docker.exec(command, {
        workingDir: projectPath,
        timeout: 60000,
      });

      if (!result.success || !result.stdout) {
        return issues;
      }

      const licenses = JSON.parse(result.stdout) as Record<string, LicenseInfo>;

      for (const [id, info] of Object.entries(licenses)) {
        const name = id.split('@')[0] ?? id;

        // Vérifier si la licence est autorisée
        if (
          info.licenses &&
          !this.config.allowedLicenses?.some((allowed) =>
            typeof info.licenses === 'string'
              ? info.licenses.includes(allowed)
              : info.licenses.some((l) => l.includes(allowed))
          )
        ) {
          issues.push({
            name,
            license: typeof info.licenses === 'string' ? info.licenses : info.licenses.join(', '),
            issue: 'License not in allowed list',
          });
        }
      }
    } catch (error) {
      this.logger.debug('license-checker failed, skipping license check');
    }

    return issues;
  }

  /**
   * Convertit une info de dépendance en Issue
   */
  private dependencyToIssue(dep: DependencyInfo, type: 'outdated' | 'vulnerable' | 'unused'): Issue {
    const isVulnerable = dep.vulnerabilitySeverity !== undefined;
    const isOutdated = dep.latest !== undefined && dep.latest !== dep.version;
    const isUnused = !dep.isUsed;

    let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'low';
    let description = '';
    let message = '';

    if (isVulnerable) {
      severity = dep.vulnerabilitySeverity ?? 'high';
      description = `Security vulnerability in ${dep.name}`;
      message = `Package ${dep.name}@${dep.version} has known vulnerabilities. Update to ${dep.latest ?? 'latest version'}.`;
    } else if (isUnused) {
      severity = 'low';
      description = `Unused dependency: ${dep.name}`;
      message = `Package ${dep.name} is installed but not used in the codebase.`;
    } else if (isOutdated) {
      severity = 'low';
      description = `Outdated dependency: ${dep.name}`;
      message = `Package ${dep.name} is outdated. Current: ${dep.version}, Latest: ${dep.latest}.`;
    } else {
      severity = 'info';
      description = `Dependency issue: ${dep.name}`;
      message = `Review ${dep.name} for potential issues.`;
    }

    return {
      id: this.generateIssueId(type, dep.name),
      category: 'dependency',
      severity,
      description,
      message,
      location: {
        file: 'package.json',
        line: 1,
      },
      fixable: !isVulnerable || (dep.latest !== undefined),
      effort: isVulnerable ? 5 : isUnused ? 2 : 3,
      suggestions: [
        isVulnerable && dep.latest
          ? `Update to ${dep.latest}`
          : isUnused
            ? 'Remove unused dependency'
            : isOutdated && dep.latest
              ? `Update to ${dep.latest}`
              : 'Review dependency',
      ],
    };
  }

  /**
   * Convertit un doublon en Issue
   */
  private duplicateToIssue(dup: { name: string; versions: string[] }, projectPath: string): Issue {
    return {
      id: this.generateIssueId('duplicate', dup.name),
      category: 'dependency',
      severity: 'medium',
      description: `Duplicate versions of ${dup.name} found`,
      message: `Package ${dup.name} has multiple versions in the dependency tree: ${dup.versions.join(', ')}. This can increase bundle size and cause bugs.`,
      location: {
        file: join(projectPath, 'package.json'),
        line: 1,
      },
      fixable: false,
      effort: 4,
      suggestions: ['Run npm dedupe to resolve duplicate versions'],
    };
  }

  /**
   * Convertit un problème de licence en Issue
   */
  private licenseIssueToIssue(issue: { name: string; license: string; issue: string }, projectPath: string): Issue {
    return {
      id: this.generateIssueId('license', issue.name),
      category: 'dependency',
      severity: 'medium',
      description: `License issue: ${issue.name}`,
      message: `Package ${issue.name} uses license "${issue.license}" which may not be compliant with project policy.`,
      location: {
        file: join(projectPath, 'package.json'),
        line: 1,
      },
      fixable: false,
      effort: 6,
      suggestions: ['Review package for alternative', 'Check if license is acceptable for your use case'],
    };
  }

  /**
   * Génère un ID unique pour l'issue
   */
  private generateIssueId(type: string, name: string): string {
    return `dep-${type}-${name}`.replace(/[^a-zA-Z0-9-]/g, '-');
  }

  /**
   * Map la sévérité npm audit vers notre format
   */
  private mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'moderate':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'low';
    }
  }

  /**
   * Détermine le type de dépendance
   */
  private getDependencyType(pkgJson: PackageJson, name: string): 'dependencies' | 'devDependencies' | 'peerDependencies' {
    if (pkgJson.dependencies?.[name]) {
      return 'dependencies';
    }
    if (pkgJson.devDependencies?.[name]) {
      return 'devDependencies';
    }
    return 'peerDependencies';
  }

  /**
   * Lit et parse le package.json
   */
  private async readPackageJson(projectPath: string): Promise<PackageJson | null> {
    try {
      const pkgPath = join(projectPath, 'package.json');
      await access(pkgPath, constants.F_OK);
      const content = await readFile(pkgPath, 'utf-8');
      return JSON.parse(content) as PackageJson;
    } catch {
      return null;
    }
  }
}

/**
 * Package.json simplifié
 */
interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Résultat npm outdated
 */
interface OutdatedPackage {
  current: string;
  latest: string;
  wanted: string;
}

/**
 * Résultat npm audit
 */
interface NpmAuditResult {
  vulnerabilities: Record<string, NpmVulnerability>;
}

/**
 * Vulnérabilité npm
 */
interface NpmVulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  range: string;
  fixAvailable?: {
    version: string;
  };
}

/**
 * Résultat depcheck
 */
interface DepcheckResult {
  dependencies: string[];
  devDependencies: string[];
}

/**
 * Résultat npm ls
 */
interface NpmLsResult {
  dependencies?: Record<string, NpmDependency>;
}

/**
 * Dépendance npm ls
 */
interface NpmDependency {
  version: string;
  dependencies?: Record<string, NpmDependency>;
}

/**
 * Info licence
 */
interface LicenseInfo {
  licenses: string | string[];
  publisher: string;
  email: string;
  licensePath: string;
}
