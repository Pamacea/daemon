/**
 * NestJS Code Analyzer
 *
 * Analyse spécifique pour les projets NestJS :
 * - Détection des modules et dépendances
 * - Validation des patterns (Dependency Injection)
 * - Vérification des décorateurs
 * - Tests des guards et pipes
 * - Analyse des intercepteurs
 *
 * @module services/review/analyzers/nestjs-analyzer
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type {
  Issue,
  IssueCategory,
  IssueSeverity,
  Location,
} from '../review.types.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Résultat d'analyse NestJS
 */
export interface NestJSAnalysisResult {
  modules: NestJSModuleInfo[];
  controllers: NestJSControllerInfo[];
  services: NestJSServiceInfo[];
  guards: NestJSGuardInfo[];
  pipes: NestJSPipeInfo[];
  interceptors: NestJSInterceptorInfo[];
  issues: Issue[];
  stats: NestJSStats;
}

/**
 * Informations sur un module NestJS
 */
export interface NestJSModuleInfo {
  name: string;
  file: string;
  imports: string[];
  providers: string[];
  controllers: string[];
  exports: string[];
  location: Location;
}

/**
 * Informations sur un contrôleur NestJS
 */
export interface NestJSControllerInfo {
  name: string;
  file: string;
  route: string;
  methods: string[];
  guards: string[];
  pipes: string[];
  interceptors: string[];
  location: Location;
}

/**
 * Informations sur un service NestJS
 */
export interface NestJSServiceInfo {
  name: string;
  file: string;
  injectable: boolean;
  dependencies: string[];
  scope: 'DEFAULT' | 'REQUEST' | 'TRANSIENT';
  location: Location;
}

/**
 * Informations sur un guard NestJS
 */
export interface NestJSGuardInfo {
  name: string;
  file: string;
  canActivate: boolean;
  usedIn: string[];
  location: Location;
}

/**
 * Informations sur un pipe NestJS
 */
export interface NestJSPipeInfo {
  name: string;
  file: string;
  transform: boolean;
  usedIn: string[];
  location: Location;
}

/**
 * Informations sur un intercepteur NestJS
 */
export interface NestJSInterceptorInfo {
  name: string;
  file: string;
  intercept: boolean;
  usedIn: string[];
  location: Location;
}

/**
 * Statistiques d'analyse NestJS
 */
export interface NestJSStats {
  totalModules: number;
  totalControllers: number;
  totalServices: number;
  totalGuards: number;
  totalPipes: number;
  totalInterceptors: number;
  diIssues: number;
  decoratorIssues: number;
  patternIssues: number;
}

/**
 * Patterns de décorateurs NestJS
 */
const NESTJS_DECORATORS = {
  module: ['Module', 'Global'],
  controller: ['Controller', 'Get', 'Post', 'Put', 'Patch', 'Delete', 'Param', 'Query', 'Body', 'Headers'],
  service: ['Injectable', 'Inject'],
  guard: ['Injectable', 'UseGuards'],
  pipe: ['Injectable', 'UsePipes', 'ParseIntPipe', 'ParseBoolPipe', 'ParseFloatPipe', 'ParseEnumPipe', 'ParseUUIDPipe', 'ValidationPipe'],
  interceptor: ['Injectable', 'UseInterceptors', 'UseFilters', 'UsePipes'],
  exception: ['Catch', 'HttpException', 'BadRequestException', 'NotFoundException', 'UnauthorizedException', 'ForbiddenException'],
};

/**
 * Configuration de l'analyseur NestJS
 */
export interface NestJSAnalyzerConfig {
  /** Vérifier les décorateurs manquants */
  checkMissingDecorators?: boolean;
  /** Vérifier les dépendances cycliques */
  checkCircularDependencies?: boolean;
  /** Vérifier les Single Responsibility */
  checkSingleResponsibility?: boolean;
  /** Vérifier l'erreur handling */
  checkErrorHandling?: boolean;
  /** Vérifier les DTOs */
  checkDTOs?: boolean;
}

/**
 * Analyseur NestJS
 */
export class NestJSAnalyzer {
  private readonly logger: Logger;
  private config: Required<NestJSAnalyzerConfig>;

  constructor(config: NestJSAnalyzerConfig = {}) {
    this.logger = createLogger('NestJSAnalyzer');
    this.config = {
      checkMissingDecorators: config.checkMissingDecorators ?? true,
      checkCircularDependencies: config.checkCircularDependencies ?? true,
      checkSingleResponsibility: config.checkSingleResponsibility ?? true,
      checkErrorHandling: config.checkErrorHandling ?? true,
      checkDTOs: config.checkDTOs ?? true,
    };
  }

  /**
   * Analyse un projet NestJS
   */
  async analyze(projectPath: string): Promise<NestJSAnalysisResult> {
    const startTime = performance.now();

    this.logger.info(`Starting NestJS analysis for: ${projectPath}`);

    const result: NestJSAnalysisResult = {
      modules: [],
      controllers: [],
      services: [],
      guards: [],
      pipes: [],
      interceptors: [],
      issues: [],
      stats: {
        totalModules: 0,
        totalControllers: 0,
        totalServices: 0,
        totalGuards: 0,
        totalPipes: 0,
        totalInterceptors: 0,
        diIssues: 0,
        decoratorIssues: 0,
        patternIssues: 0,
      },
    };

    // Scanner les fichiers TypeScript
    const tsFiles = await this.findTypeScriptFiles(projectPath);

    // Analyser chaque fichier
    for (const file of tsFiles) {
      const content = await readFile(join(projectPath, file), 'utf-8');
      const relativePath = file;

      // Détecter et analyser les différents types
      await this.analyzeFile(content, relativePath, result);
    }

    // Vérifications inter-fichiers
    if (this.config.checkCircularDependencies) {
      this.checkCircularDeps(result);
    }

    if (this.config.checkSingleResponsibility) {
      this.checkSingleResp(result);
    }

    // Calculer les stats
    this.calculateStats(result);

    const duration = Math.round(performance.now() - startTime);
    this.logger.info(
      `NestJS analysis completed in ${duration}ms (${result.issues.length} issues found)`
    );

    return result;
  }

  /**
   * Trouve tous les fichiers TypeScript dans un projet
   */
  private async findTypeScriptFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    async function scanDir(dir: string, base: string = '') {
      const entries = await readdir(join(projectPath, base, dir), {
        withFileTypes: true,
      });

      for (const entry of entries) {
        // Skip node_modules et autres
        if (
          entry.isDirectory() &&
          !['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)
        ) {
          await scanDir(entry.name, join(base, dir));
        } else if (entry.isFile() && extname(entry.name) === '.ts') {
          files.push(join(base, dir, entry.name));
        }
      }
    }

    await scanDir('');

    return files;
  }

  /**
   * Analyse un fichier TypeScript NestJS
   */
  private async analyzeFile(
    content: string,
    filePath: string,
    result: NestJSAnalysisResult
  ): Promise<void> {
    // Détecter le type de fichier par les décorateurs
    const hasModuleDecorator = /@Module\s*\(/.test(content);
    const hasControllerDecorator = /@Controller\s*\(/.test(content);
    const hasInjectableDecorator = /@Injectable\s*\(/.test(content);
    const hasGuardDecorator = /@Injectable\s*\(/.test(content) && /canActivate\s*\(/.test(content);
    const hasPipeDecorator = /@Injectable\s*\(/.test(content) && /transform\s*\(/.test(content);
    const hasInterceptorDecorator =
      /@Injectable\s*\(/.test(content) && /intercept\s*\(/.test(content);

    const location: Location = {
      file: filePath,
      line: 1,
      column: 1,
    };

    // Analyser Module
    if (hasModuleDecorator) {
      const moduleInfo = this.extractModuleInfo(content, filePath, location);
      result.modules.push(moduleInfo);
      this.checkModulePattern(moduleInfo, result);
    }

    // Analyser Controller
    if (hasControllerDecorator) {
      const controllerInfo = this.extractControllerInfo(content, filePath, location);
      result.controllers.push(controllerInfo);
      this.checkControllerPattern(controllerInfo, result);
    }

    // Analyser Service
    if (hasInjectableDecorator && !hasControllerDecorator && !hasModuleDecorator) {
      const serviceInfo = this.extractServiceInfo(content, filePath, location);
      result.services.push(serviceInfo);
      this.checkServicePattern(serviceInfo, result);
    }

    // Analyser Guard
    if (hasGuardDecorator) {
      const guardInfo = this.extractGuardInfo(content, filePath, location);
      result.guards.push(guardInfo);
      this.checkGuardPattern(guardInfo, result);
    }

    // Analyser Pipe
    if (hasPipeDecorator) {
      const pipeInfo = this.extractPipeInfo(content, filePath, location);
      result.pipes.push(pipeInfo);
      this.checkPipePattern(pipeInfo, result);
    }

    // Analyser Interceptor
    if (hasInterceptorDecorator) {
      const interceptorInfo = this.extractInterceptorInfo(content, filePath, location);
      result.interceptors.push(interceptorInfo);
      this.checkInterceptorPattern(interceptorInfo, result);
    }
  }

  /**
   * Extrait les informations d'un module
   */
  private extractModuleInfo(
    content: string,
    file: string,
    location: Location
  ): NestJSModuleInfo {
    const nameMatch = content.match(/export\s+class\s+(\w+)\s+/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';

    const imports = this.extractDecoratorArray(content, 'imports');
    const providers = this.extractDecoratorArray(content, 'providers');
    const controllers = this.extractDecoratorArray(content, 'controllers');
    const exports = this.extractDecoratorArray(content, 'exports');

    return {
      name,
      file,
      imports,
      providers,
      controllers,
      exports,
      location,
    };
  }

  /**
   * Extrait les informations d'un contrôleur
   */
  private extractControllerInfo(
    content: string,
    file: string,
    location: Location
  ): NestJSControllerInfo {
    const nameMatch = content.match(/export\s+class\s+(\w+)\s+/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';

    const routeMatch = content.match(/@Controller\s*\(\s*['"`](.+)['"`]\s*\)/);
    const route = routeMatch ? routeMatch[1] : '';

    const methods: string[] = [];
    const methodPatterns = [
      /@Get\s*\(\s*['"`](.+)['"`]/g,
      /@Post\s*\(\s*['"`](.+)['"`]/g,
      /@Put\s*\(\s*['"`](.+)['"`]/g,
      /@Patch\s*\(\s*['"`](.+)['"`]/g,
      /@Delete\s*\(\s*['"`](.+)['"`]/g,
    ];

    for (const pattern of methodPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        methods.push(match[1]);
      }
    }

    const guards = this.extractClassLevelDecorators(content, 'UseGuards');
    const pipes = this.extractClassLevelDecorators(content, 'UsePipes');
    const interceptors = this.extractClassLevelDecorators(content, 'UseInterceptors');

    return {
      name,
      file,
      route,
      methods,
      guards,
      pipes,
      interceptors,
      location,
    };
  }

  /**
   * Extrait les informations d'un service
   */
  private extractServiceInfo(
    content: string,
    file: string,
    location: Location
  ): NestJSServiceInfo {
    const nameMatch = content.match(/export\s+class\s+(\w+)\s+/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';

    const injectableMatch = /@Injectable\s*\(\s*{\s*scope:\s*Scope\.(\w+)\s*}\s*\)/.exec(content);
    const scope = injectableMatch ? (injectableMatch[1] as any) : 'DEFAULT';

    const dependencies: string[] = [];
    const constructorMatch = content.match(
      /constructor\s*\(\s*([^)]*)\s*\)/s
    );
    if (constructorMatch) {
      const params = constructorMatch[1];
      const paramMatches = params.matchAll(
        /private\s+(?:readonly\s+)?(\w+)/g
      );
      for (const match of paramMatches) {
        dependencies.push(match[1]);
      }
    }

    return {
      name,
      file,
      injectable: true,
      dependencies,
      scope,
      location,
    };
  }

  /**
   * Extrait les informations d'un guard
   */
  private extractGuardInfo(
    content: string,
    file: string,
    location: Location
  ): NestJSGuardInfo {
    const nameMatch = content.match(/export\s+class\s+(\w+)\s+/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';

    const canActivate = /canActivate\s*\(/.test(content);

    return {
      name,
      file,
      canActivate,
      usedIn: [],
      location,
    };
  }

  /**
   * Extrait les informations d'un pipe
   */
  private extractPipeInfo(
    content: string,
    file: string,
    location: Location
  ): NestJSPipeInfo {
    const nameMatch = content.match(/export\s+class\s+(\w+)\s+/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';

    const transform = /transform\s*\(/.test(content);

    return {
      name,
      file,
      transform,
      usedIn: [],
      location,
    };
  }

  /**
   * Extrait les informations d'un intercepteur
   */
  private extractInterceptorInfo(
    content: string,
    file: string,
    location: Location
  ): NestJSInterceptorInfo {
    const nameMatch = content.match(/export\s+class\s+(\w+)\s+/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';

    const intercept = /intercept\s*\(/.test(content);

    return {
      name,
      file,
      intercept,
      usedIn: [],
      location,
    };
  }

  /**
   * Extrait un tableau depuis un décorateur
   */
  private extractDecoratorArray(content: string, key: string): string[] {
    const pattern = new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
    const match = content.match(pattern);
    if (!match) return [];

    const arrayContent = match[1];
    const items: string[] = [];

    // Extraire les noms entre guillemets
    const itemMatches = arrayContent.matchAll(/['"`](\w+)['"`]/g);
    for (const itemMatch of itemMatches) {
      items.push(itemMatch[1]);
    }

    return items;
  }

  /**
   * Extrait les décorateurs au niveau classe
   */
  private extractClassLevelDecorators(content: string, decoratorName: string): string[] {
    const pattern = new RegExp(`@${decoratorName}\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\)`, 'g');
    const matches = content.matchAll(pattern);
    const result: string[] = [];

    for (const match of matches) {
      const items = match[1]?.match(/['"`](\w+)['"`]/g) ?? [];
      result.push(...items.map((i) => i.replace(/['"`]/g, '')));
    }

    return result;
  }

  /**
   * Vérifie les patterns d'un module
   */
  private checkModulePattern(module: NestJSModuleInfo, result: NestJSAnalysisResult): void {
    // Vérifier que les providers sont exportés si utilisés ailleurs
    for (const provider of module.providers) {
      if (!module.exports.includes(provider) && provider !== module.name) {
        result.issues.push({
          id: `nestjs-module-not-exported-${module.name}-${provider}`,
          category: 'code-quality',
          severity: 'medium',
          description: `Provider "${provider}" is provided but not exported from module "${module.name}"`,
          message: `Provider ${provider} in ${module.name} should be exported if used in other modules`,
          location: module.location,
          fixable: false,
          effort: 2,
          ruleId: 'nestjs-module-exports',
        });
        result.stats.diIssues++;
      }
    }

    // Vérifier les imports circulaires potentiels
    for (const imp of module.imports) {
      const importedModule = result.modules.find((m) => m.name === imp);
      if (importedModule && importedModule.imports.includes(module.name)) {
        result.issues.push({
          id: `nestjs-circular-import-${module.name}-${imp}`,
          category: 'code-quality',
          severity: 'high',
          description: `Circular import detected between modules "${module.name}" and "${imp}"`,
          message: `Modules ${module.name} and ${imp} import each other`,
          location: module.location,
          fixable: false,
          effort: 5,
          ruleId: 'nestjs-circular-imports',
        });
        result.stats.diIssues++;
      }
    }
  }

  /**
   * Vérifie les patterns d'un contrôleur
   */
  private checkControllerPattern(
    controller: NestJSControllerInfo,
    result: NestJSAnalysisResult
  ): void {
    // Vérifier que le contrôleur a des routes
    if (controller.methods.length === 0) {
      result.issues.push({
        id: `nestjs-controller-no-routes-${controller.name}`,
        category: 'code-quality',
        severity: 'medium',
        description: `Controller "${controller.name}" has no route handlers`,
        message: `Controller ${controller.name} should have at least one route handler`,
        location: controller.location,
        fixable: false,
        effort: 3,
        ruleId: 'nestjs-controller-no-routes',
      });
      result.stats.patternIssues++;
    }

    // Vérifier que les routes sont protégées si nécessaire
    const hasAuthGuard = controller.guards.some((g) =>
      g.toLowerCase().includes('auth') || g.toLowerCase().includes('jwt')
    );

    // Routes non publiques devraient avoir un guard
    if (!hasAuthGuard && controller.methods.length > 0) {
      result.issues.push({
        id: `nestjs-controller-no-guard-${controller.name}`,
        category: 'security',
        severity: 'medium',
        description: `Controller "${controller.name}" has no authentication guard`,
        message: `Controller ${controller.name} routes should be protected with authentication`,
        location: controller.location,
        fixable: false,
        effort: 2,
        ruleId: 'nestjs-controller-auth',
      });
      result.stats.decoratorIssues++;
    }
  }

  /**
   * Vérifie les patterns d'un service
   */
  private checkServicePattern(service: NestJSServiceInfo, result: NestJSAnalysisResult): void {
    // Vérifier la Single Responsibility
    // Un service ne devrait pas avoir trop de dépendances
    if (service.dependencies.length > 5) {
      result.issues.push({
        id: `nestjs-service-too-many-deps-${service.name}`,
        category: 'code-quality',
        severity: 'medium',
        description: `Service "${service.name}" has ${service.dependencies.length} dependencies (max 5 recommended)`,
        message: `Service ${service.name} may violate Single Responsibility - consider refactoring`,
        location: service.location,
        fixable: false,
        effort: 5,
        ruleId: 'nestjs-service-deps',
      });
      result.stats.patternIssues++;
    }

    // Vérifier que le service est bien injectable
    if (!service.injectable) {
      result.issues.push({
        id: `nestjs-service-not-injectable-${service.name}`,
        category: 'static',
        severity: 'high',
        description: `Service "${service.name}" is missing @Injectable() decorator`,
        message: `Service ${service.name} must have @Injectable() decorator`,
        location: service.location,
        fixable: true,
        effort: 1,
        ruleId: 'nestjs-service-injectable',
      });
      result.stats.decoratorIssues++;
    }
  }

  /**
   * Vérifie les patterns d'un guard
   */
  private checkGuardPattern(guard: NestJSGuardInfo, result: NestJSAnalysisResult): void {
    if (!guard.canActivate) {
      result.issues.push({
        id: `nestjs-guard-no-canActivate-${guard.name}`,
        category: 'static',
        severity: 'high',
        description: `Guard "${guard.name}" is missing canActivate() method`,
        message: `Guard ${guard.name} must implement canActivate() method`,
        location: guard.location,
        fixable: false,
        effort: 3,
        ruleId: 'nestjs-guard-canActivate',
      });
      result.stats.decoratorIssues++;
    }
  }

  /**
   * Vérifie les patterns d'un pipe
   */
  private checkPipePattern(pipe: NestJSPipeInfo, result: NestJSAnalysisResult): void {
    if (!pipe.transform) {
      result.issues.push({
        id: `nestjs-pipe-no-transform-${pipe.name}`,
        category: 'static',
        severity: 'high',
        description: `Pipe "${pipe.name}" is missing transform() method`,
        message: `Pipe ${pipe.name} must implement transform() method`,
        location: pipe.location,
        fixable: false,
        effort: 3,
        ruleId: 'nestjs-pipe-transform',
      });
      result.stats.decoratorIssues++;
    }
  }

  /**
   * Vérifie les patterns d'un intercepteur
   */
  private checkInterceptorPattern(
    interceptor: NestJSInterceptorInfo,
    result: NestJSAnalysisResult
  ): void {
    if (!interceptor.intercept) {
      result.issues.push({
        id: `nestjs-interceptor-no-intercept-${interceptor.name}`,
        category: 'static',
        severity: 'high',
        description: `Interceptor "${interceptor.name}" is missing intercept() method`,
        message: `Interceptor ${interceptor.name} must implement intercept() method`,
        location: interceptor.location,
        fixable: false,
        effort: 3,
        ruleId: 'nestjs-interceptor-intercept',
      });
      result.stats.decoratorIssues++;
    }
  }

  /**
   * Vérifie les dépendances cycliques
   */
  private checkCircularDeps(result: NestJSAnalysisResult): void {
    // Construire un graphe de dépendances entre services
    const serviceMap = new Map<string, Set<string>>();

    for (const service of result.services) {
      const deps = new Set(service.dependencies);
      serviceMap.set(service.name, deps);
    }

    // Détecter les cycles avec DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function hasCycle(node: string, path: string[]): boolean {
      if (recursionStack.has(node)) {
        // Cycle trouvé
        const cycleStart = path.indexOf(node);
        const cycle = [...path.slice(cycleStart), node];
        result.issues.push({
          id: `nestjs-circular-deps-${cycle.join('-')}`,
          category: 'code-quality',
          severity: 'high',
          description: `Circular dependency detected: ${cycle.join(' -> ')}`,
          message: `Services have circular dependencies: ${cycle.join(' -> ')}`,
          location: { file: cycle[0] + '.ts', line: 1, column: 1 },
          fixable: false,
          effort: 5,
          ruleId: 'nestjs-circular-deps',
        });
        result.stats.diIssues++;
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      const deps = serviceMap.get(node);
      if (deps) {
        for (const dep of deps) {
          if (serviceMap.has(dep)) {
            hasCycle(dep, [...path, node]);
          }
        }
      }

      recursionStack.delete(node);
      return false;
    }

    for (const serviceName of serviceMap.keys()) {
      hasCycle(serviceName, []);
    }
  }

  /**
   * Vérifie la Single Responsibility Principle
   */
  private checkSingleResp(result: NestJSAnalysisResult): void {
    // Vérifier que les services ne font pas trop de choses
    for (const service of result.services) {
      // Cette vérification nécessiterait une analyse AST plus poussée
      // Pour l'instant, on se base sur le nombre de dépendances
    }

    // Vérifier que les contrôleurs délèguent aux services
    // (pas de logique métier directement dans les contrôleurs)
  }

  /**
   * Calcule les statistiques
   */
  private calculateStats(result: NestJSAnalysisResult): void {
    result.stats.totalModules = result.modules.length;
    result.stats.totalControllers = result.controllers.length;
    result.stats.totalServices = result.services.length;
    result.stats.totalGuards = result.guards.length;
    result.stats.totalPipes = result.pipes.length;
    result.stats.totalInterceptors = result.interceptors.length;
  }
}
