/**
 * DockerManager - Gestion des conteneurs Docker
 *
 * Service pour gérer les opérations Docker de manière asynchrone.
 * Utilise CommandExecutor pour l'exécution des commandes.
 *
 * @module services/docker/docker-manager
 */

import * as path from 'node:path';
import type {
  DockerConfig,
  DockerCreateOptions,
  DockerExecOptions,
  DockerExecResult,
  DockerLogOptions,
  ContainerStatus,
  DockerBuildOptions,
  DockerResult,
} from '../../core/types/docker.types.js';
import {
  ContainerNotFoundError,
  ContainerAlreadyExistsError,
  ImageBuildError,
  ContainerStartError,
  ContainerStopError,
  DockerDaemonUnavailableError,
} from '../../shared/errors/docker.error.js';
import { CommandExecutor, type CommandOptions } from '../../shared/utils/command-executor.js';
import { createLogger, type Logger } from '../../shared/utils/logger.js';

/**
 * Configuration par défaut pour le DockerManager
 */
const DEFAULT_CONFIG: DockerConfig = {
  imageName: 'daemon-tools',
  containerName: 'daemon-tools',
  dockerfilePath: path.join(process.cwd(), 'bin', 'Dockerfile'),
  buildContext: path.join(process.cwd(), 'bin'),
};

/**
 * Options de construction d'image
 */
export interface BuildOptions {
  /** Supprimer la sortie de build */
  silent?: boolean;
  /** Timeout en millisecondes */
  timeout?: number;
  /** Ne pas utiliser le cache */
  noCache?: boolean;
  /** Récupérer la dernière image de base */
  pull?: boolean;
  /** Utiliser le mode quiet */
  quiet?: boolean;
  /** Plateforme cible */
  platform?: string;
  /** Stage cible (multi-stage builds) */
  target?: string;
  /** Arguments de build */
  buildArgs?: Record<string, string>;
  /** Images pour le cache */
  cacheFrom?: string[];
  /** Tags de l'image */
  tags?: string[];
  /** Contexte de build */
  context?: string;
  /** Dockerfile */
  dockerfile?: string;
}

/**
 * Résultat de construction
 */
export interface BuildResult {
  success: boolean;
  imageId?: string;
  duration: number;
  error?: string;
}

/**
 * Options de setup pour le conteneur
 */
export interface SetupOptions {
  /** Exécuter en mode silencieux */
  silent?: boolean;
  /** Callback appelé avant le build */
  onBuildStart?: () => void;
  /** Callback appelé après le build */
  onBuildComplete?: () => void;
  /** Callback appelé en cas d'erreur de build */
  onBuildError?: (error: Error) => void;
}

/**
 * Statut retourné par setup
 */
export type SetupStatus = 'running' | 'started' | 'created' | 'built';

/**
 * Résultat de l'opération setup
 */
export interface SetupResult {
  /** Statut actuel du conteneur */
  status: SetupStatus;
  /** Durée de l'opération */
  duration: number;
}

/**
 * Manager pour les opérations Docker
 *
 * Toutes les opérations sont asynchrones et utilisent CommandExecutor.
 */
export class DockerManager {
  private readonly config: DockerConfig;
  private readonly executor: CommandExecutor;
  private readonly logger: Logger;

  constructor(config: Partial<DockerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.executor = new CommandExecutor();
    this.logger = createLogger('DockerManager');
  }

  /**
   * Vérifie si Docker est en cours d'exécution
   */
  async isRunning(): Promise<boolean> {
    const result = await this.executor.execute('docker info', { timeout: 5000 });
    return result.success;
  }

  /**
   * Vérifie si l'image Docker existe
   */
  async isImageBuilt(): Promise<boolean> {
    const result = await this.executor.execute(
      `docker images -q ${this.config.imageName}`,
      { timeout: 5000 }
    );
    return result.success && result.data?.stdout.trim().length > 0;
  }

  /**
   * Construit l'image Docker
   */
  async build(options: BuildOptions = {}): Promise<BuildResult> {
    const startTime = performance.now();
    const timeout = options.timeout ?? 600000; // 10 minutes par défaut

    this.logger.info(`Building Docker image: ${this.config.imageName}`);

    const buildContext = options.context ?? this.config.buildContext ?? path.dirname(this.config.dockerfilePath ?? '');
    const dockerfile = options.dockerfile ?? this.config.dockerfilePath;
    const tags = options.tags ?? [this.config.imageName];

    const args: string[] = ['build'];

    // Tags
    for (const tag of tags) {
      args.push('-t', tag);
    }

    // Dockerfile
    if (dockerfile) {
      args.push('-f', `"${dockerfile}"`);
    }

    // Options
    if (options.noCache) {
      args.push('--no-cache');
    }
    if (options.pull) {
      args.push('--pull');
    }
    if (options.quiet) {
      args.push('--quiet');
    }
    if (options.platform) {
      args.push('--platform', options.platform);
    }
    if (options.target) {
      args.push('--target', options.target);
    }

    // Build args
    if (options.buildArgs) {
      for (const [key, value] of Object.entries(options.buildArgs)) {
        args.push('--build-arg', `${key}=${value}`);
      }
    }

    // Cache from
    if (options.cacheFrom) {
      for (const cache of options.cacheFrom) {
        args.push('--cache-from', cache);
      }
    }

    // Build context
    args.push(`"${buildContext}"`);

    const command = `docker ${args.join(' ')}`;

    try {
      const result = await this.executor.execute(command, {
        timeout,
        silent: options.silent ?? false,
      });

      if (!result.success) {
        throw result.error;
      }

      const duration = Math.round(performance.now() - startTime);
      this.logger.info(`Image built successfully in ${duration}ms`);

      return {
        success: true,
        duration,
      };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to build image after ${duration}ms`, error);

      throw new ImageBuildError(buildContext, message);
    }
  }

  /**
   * Vérifie si le conteneur est en cours d'exécution
   */
  async isContainerRunning(): Promise<boolean> {
    const result = await this.executor.execute(
      `docker ps --filter "name=^${this.config.containerName}$" --format "{{.Names}}"`,
      { timeout: 5000 }
    );
    return result.success && result.data?.stdout.trim() === this.config.containerName;
  }

  /**
   * Vérifie si le conteneur existe (arrêté ou en cours)
   */
  async containerExists(): Promise<boolean> {
    const result = await this.executor.execute(
      `docker ps -a --filter "name=^${this.config.containerName}$" --format "{{.Names}}"`,
      { timeout: 5000 }
    );
    return result.success && result.data?.stdout.trim() === this.config.containerName;
  }

  /**
   * Retourne le statut du conteneur
   */
  async getContainerStatus(): Promise<ContainerStatus> {
    if (!(await this.containerExists())) {
      return 'unknown';
    }

    if (await this.isContainerRunning()) {
      return 'running';
    }

    // Récupérer le statut détaillé via inspect
    const result = await this.executor.execute(
      `docker inspect -f '{{.State.Status}}' ${this.config.containerName}`,
      { timeout: 5000 }
    );

    if (!result.success || !result.data) {
      return 'unknown';
    }

    const status = result.data.stdout.trim();
    switch (status) {
      case 'paused':
        return 'paused';
      case 'exited':
        return 'exited';
      case 'dead':
        return 'dead';
      case 'restarting':
        return 'restarting';
      case 'removing':
        return 'removing';
      case 'created':
        return 'created';
      default:
        return 'unknown';
    }
  }

  /**
   * Crée un nouveau conteneur
   */
  async create(options: DockerCreateOptions = {}): Promise<void> {
    if (await this.containerExists()) {
      throw new ContainerAlreadyExistsError(this.config.containerName);
    }

    const args = this.buildCreateArgs(options);
    const command = `docker run ${args.join(' ')}`;

    this.logger.info(`Creating container: ${this.config.containerName}`);

    try {
      const result = await this.executor.execute(command, { timeout: 30000 });
      if (!result.success) {
        throw result.error;
      }
      this.logger.info(`Container created: ${this.config.containerName}`);
    } catch (error) {
      this.logger.error(`Failed to create container`, error);
      throw new ImageBuildError(
        this.config.imageName,
        `Container creation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Démarre le conteneur
   */
  async start(): Promise<void> {
    if (await this.isContainerRunning()) {
      this.logger.debug(`Container already running: ${this.config.containerName}`);
      return;
    }

    if (!(await this.containerExists())) {
      await this.create();
      return;
    }

    this.logger.info(`Starting container: ${this.config.containerName}`);

    try {
      const result = await this.executor.execute(
        `docker start ${this.config.containerName}`,
        { timeout: 30000 }
      );
      if (!result.success) {
        throw result.error;
      }
      this.logger.info(`Container started: ${this.config.containerName}`);
    } catch (error) {
      this.logger.error(`Failed to start container`, error);
      throw new ContainerStartError(
        this.config.containerName,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Arrête le conteneur
   */
  async stop(): Promise<void> {
    if (!(await this.isContainerRunning())) {
      this.logger.debug(`Container not running: ${this.config.containerName}`);
      return;
    }

    this.logger.info(`Stopping container: ${this.config.containerName}`);

    try {
      const result = await this.executor.execute(
        `docker stop ${this.config.containerName}`,
        { timeout: 30000 }
      );
      if (!result.success) {
        throw result.error;
      }
      this.logger.info(`Container stopped: ${this.config.containerName}`);
    } catch (error) {
      this.logger.warn(`Failed to stop container: ${this.config.containerName}`, error);
      // Non-critical, on continue
    }
  }

  /**
   * Supprime le conteneur
   */
  async remove(force: boolean = false): Promise<void> {
    if (!(await this.containerExists())) {
      this.logger.debug(`Container does not exist: ${this.config.containerName}`);
      return;
    }

    this.logger.info(`Removing container: ${this.config.containerName}`);

    try {
      const result = await this.executor.execute(
        `docker rm${force ? ' -f' : ''} ${this.config.containerName}`,
        { timeout: 10000 }
      );
      if (!result.success) {
        throw result.error;
      }
      this.logger.info(`Container removed: ${this.config.containerName}`);
    } catch (error) {
      this.logger.warn(`Failed to remove container: ${this.config.containerName}`, error);
      // Non-critical
    }
  }

  /**
   * Redémarre le conteneur
   */
  async restart(): Promise<void> {
    this.logger.info(`Restarting container: ${this.config.containerName}`);

    try {
      const result = await this.executor.execute(
        `docker restart ${this.config.containerName}`,
        { timeout: 30000 }
      );
      if (!result.success) {
        throw result.error;
      }
      this.logger.info(`Container restarted: ${this.config.containerName}`);
    } catch (error) {
      this.logger.error(`Failed to restart container`, error);
      throw new ContainerStartError(
        this.config.containerName,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Exécute une commande dans le conteneur
   */
  async exec(command: string, options: DockerExecOptions = {}): Promise<DockerExecResult> {
    if (!(await this.isContainerRunning())) {
      throw new ContainerStartError(
        this.config.containerName,
        'Container is not running'
      );
    }

    const startTime = performance.now();
    const timeout = options.timeout ?? 60000;

    const args: string[] = ['exec'];

    if (options.workingDir) {
      args.push('-w', options.workingDir);
    }
    if (options.user) {
      args.push('-u', options.user);
    }
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push('-e', `${key}=${value}`);
      }
    }

    args.push(this.config.containerName);
    args.push(command);

    const dockerCommand = `docker ${args.join(' ')}`;

    this.logger.debug(`Executing in container: ${command}`);

    const result = await this.executor.execute(dockerCommand, { timeout });
    const duration = Math.round(performance.now() - startTime);

    this.logger.debug(`Command completed in ${duration}ms`);

    if (result.success && result.data) {
      const data = result.data;
      return {
        success: true,
        stdout: data.stdout,
        stderr: data.stderr,
        exitCode: data.exitCode ?? 0,
        duration,
      };
    }

    // Extract values from failed result
    const failedResult = result as { success: false; data?: { stdout: string }; error?: { stderr?: string; message?: string; exitCode?: number } };
    return {
      success: false,
      stdout: failedResult.data?.stdout ?? '',
      stderr: failedResult.error?.stderr ?? failedResult.error?.message ?? 'Unknown error',
      exitCode: failedResult.error?.exitCode ?? 1,
      duration,
    };
  }

  /**
   * Récupère les logs du conteneur
   */
  async getLogs(options: DockerLogOptions = {}): Promise<string> {
    const tail = options.tail ?? 100;

    const args: string[] = ['logs'];

    if (options.follow) {
      args.push('-f');
    }
    if (options.timestamps) {
      args.push('-t');
    }
    if (options.since) {
      args.push(`--since=${options.since}`);
    }
    if (options.until) {
      args.push(`--until=${options.until}`);
    }

    args.push(`--tail=${tail}`);
    args.push(this.config.containerName);

    const result = await this.executor.execute(`docker ${args.join(' ')}`, {
      timeout: 5000,
    });

    return result.success && result.data ? result.data.stdout : '';
  }

  /**
   * Configure le conteneur (construit, démarre ou crée selon les besoins)
   */
  async setup(options: SetupOptions = {}): Promise<SetupResult> {
    const startTime = performance.now();

    // Vérifier Docker
    if (!(await this.isRunning())) {
      throw new DockerDaemonUnavailableError();
    }

    // Construire l'image si nécessaire
    if (!(await this.isImageBuilt())) {
      if (options.onBuildStart) {
        options.onBuildStart();
      }

      try {
        await this.build({ silent: options.silent ?? false });

        if (options.onBuildComplete) {
          options.onBuildComplete();
        }

        const duration = Math.round(performance.now() - startTime);

        return {
          status: 'built',
          duration,
        };
      } catch (error) {
        if (options.onBuildError) {
          options.onBuildError(error as Error);
        }

        throw error;
      }
    }

    // Démarrer ou créer le conteneur
    if (await this.isContainerRunning()) {
      const duration = Math.round(performance.now() - startTime);

      return {
        status: 'running',
        duration,
      };
    }

    if (await this.containerExists()) {
      await this.start();
      const duration = Math.round(performance.now() - startTime);

      return {
        status: 'started',
        duration,
      };
    }

    await this.create();
    const duration = Math.round(performance.now() - startTime);

    return {
      status: 'created',
      duration,
    };
  }

  /**
   * Retourne la configuration actuelle
   */
  getConfig(): Readonly<DockerConfig> {
    return { ...this.config };
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(updates: Partial<DockerConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Construit les arguments de création de conteneur
   */
  private buildCreateArgs(options: DockerCreateOptions): string[] {
    const args: string[] = [];

    // Nom
    const name = options.name ?? this.config.containerName;
    args.push('--name', name);

    // Détach
    if (options.detach ?? this.config.detach ?? true) {
      args.push('-d');
    }

    // Auto-remove
    if (options.autoRemove ?? this.config.autoRemove) {
      args.push('--rm');
    }

    // Ports
    const ports = { ...this.config.portMappings, ...options.ports };
    for (const [containerPort, hostPort] of Object.entries(ports)) {
      args.push('-p', `${hostPort}:${containerPort}`);
    }

    // Volumes
    const volumes = this.config.volumeMappings ?? {};
    if (options.volumes) {
      for (const volume of options.volumes) {
        args.push('-v', volume);
      }
    }
    for (const [hostPath, containerPath] of Object.entries(volumes)) {
      args.push('-v', `${hostPath}:${containerPath}`);
    }

    // Environment
    const env = { ...this.config.environment, ...options.env };
    for (const [key, value] of Object.entries(env)) {
      args.push('-e', `${key}=${value}`);
    }

    // Env files
    if (options.envFile) {
      for (const envFile of options.envFile) {
        args.push('--env-file', envFile);
      }
    }

    // Working directory
    if (options.workdir) {
      args.push('-w', options.workdir);
    }

    // User
    if (options.user) {
      args.push('-u', options.user);
    }

    // Hostname
    if (options.hostname) {
      args.push('--hostname', options.hostname);
    }

    // Interactive
    if (options.interactive) {
      args.push('-i');
    }

    // TTY
    if (options.tty) {
      args.push('-t');
    }

    // Network
    const network = options.network ?? this.config.network;
    if (network) {
      args.push('--network', network);
    } else if (process.platform === 'linux') {
      // Par défaut sur Linux, utiliser host network
      args.push('--network=host');
    }

    // Healthcheck
    if (options.healthcheck) {
      const hc = options.healthcheck;
      args.push('--health-cmd', hc.command.join(' '));
      if (hc.interval) {
        args.push('--health-interval', String(hc.interval));
      }
      if (hc.timeout) {
        args.push('--health-timeout', String(hc.timeout));
      }
      if (hc.retries) {
        args.push('--health-retries', String(hc.retries));
      }
      if (hc.startPeriod) {
        args.push('--health-start-period', String(hc.startPeriod));
      }
    }

    // Image
    args.push(this.config.imageName);

    // Command
    if (options.command) {
      args.push(...options.command);
    }

    return args;
  }
}

/**
 * Instance singleton par défaut
 */
export const dockerManager = new DockerManager();
