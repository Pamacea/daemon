/**
 * Docker-specific errors.
 *
 * Error codes:
 * - DOCKER_001: Generic Docker error
 * - DOCKER_002: Container not found
 * - DOCKER_003: Image build failed
 * - DOCKER_004: Container already exists
 * - DOCKER_005: Container start failed
 * - DOCKER_006: Container stop failed
 * - DOCKER_007: Docker daemon not available
 * - DOCKER_008: Image pull failed
 */

import { DaemonError, type ErrorContext, type DaemonErrorOptions } from './base.error.js';

/**
 * Base class for all Docker-related errors
 */
export class BaseDockerError extends DaemonError {
  constructor(message: string, code: string, options?: DaemonErrorOptions) {
    super(message, code, options);
    this.name = 'DockerError';
  }
}

/**
 * Thrown when a container cannot be found
 */
export class ContainerNotFoundError extends BaseDockerError {
  constructor(containerIdOrName: string, options?: DaemonErrorOptions) {
    super(
      `Container not found: ${containerIdOrName}`,
      'DOCKER_002',
      {
        ...options,
        context: {
          containerId: containerIdOrName,
          ...options?.context,
        },
      }
    );
    this.name = 'ContainerNotFoundError';
  }
}

/**
 * Thrown when a Docker image build fails
 */
export class ImageBuildError extends BaseDockerError {
  constructor(
    buildPath: string,
    buildReason: string,
    options?: DaemonErrorOptions
  ) {
    super(
      `Docker image build failed for ${buildPath}: ${buildReason}`,
      'DOCKER_003',
      {
        ...options,
        context: {
          buildPath,
          buildReason,
          ...options?.context,
        },
      }
    );
    this.name = 'ImageBuildError';
  }
}

/**
 * Thrown when a container with the same name already exists
 */
export class ContainerAlreadyExistsError extends BaseDockerError {
  constructor(containerName: string, options?: DaemonErrorOptions) {
    super(
      `Container already exists: ${containerName}`,
      'DOCKER_004',
      {
        ...options,
        context: {
          containerName,
          ...options?.context,
        },
      }
    );
    this.name = 'ContainerAlreadyExistsError';
  }
}

/**
 * Thrown when container start fails
 */
export class ContainerStartError extends BaseDockerError {
  constructor(containerName: string, reason: string, options?: DaemonErrorOptions) {
    super(
      `Failed to start container ${containerName}: ${reason}`,
      'DOCKER_005',
      {
        ...options,
        context: {
          containerName,
          reason,
          ...options?.context,
        },
      }
    );
    this.name = 'ContainerStartError';
  }
}

/**
 * Thrown when container stop fails
 */
export class ContainerStopError extends BaseDockerError {
  constructor(containerName: string, reason: string, options?: DaemonErrorOptions) {
    super(
      `Failed to stop container ${containerName}: ${reason}`,
      'DOCKER_006',
      {
        ...options,
        context: {
          containerName,
          reason,
          ...options?.context,
        },
      }
    );
    this.name = 'ContainerStopError';
  }
}

/**
 * Thrown when Docker daemon is not available or not running
 */
export class DockerDaemonUnavailableError extends BaseDockerError {
  constructor(reason?: string, options?: DaemonErrorOptions) {
    super(
      reason
        ? `Docker daemon unavailable: ${reason}`
        : 'Docker daemon is not running or not accessible',
      'DOCKER_007',
      options
    );
    this.name = 'DockerDaemonUnavailableError';
  }
}

/**
 * Thrown when Docker image pull fails
 */
export class ImagePullError extends BaseDockerError {
  constructor(imageName: string, reason: string, options?: DaemonErrorOptions) {
    super(
      `Failed to pull Docker image ${imageName}: ${reason}`,
      'DOCKER_008',
      {
        ...options,
        context: {
          imageName,
          reason,
          ...options?.context,
        },
      }
    );
    this.name = 'ImagePullError';
  }
}

/**
 * Factory methods pour créer facilement des erreurs Docker
 */
export const DockerErrors = {
  /**
   * Crée une erreur générique Docker
   */
  generic: (message: string, context?: ErrorContext) =>
    new BaseDockerError(message, 'DOCKER_001', { context }),

  /**
   * Crée une erreur conteneur non trouvé
   */
  containerNotFound: (containerName: string) =>
    new ContainerNotFoundError(containerName),

  /**
   * Crée une erreur de build d'image
   */
  imageBuildFailed: (buildPath: string, reason: string) =>
    new ImageBuildError(buildPath, reason),

  /**
   * Crée une erreur conteneur déjà existant
   */
  containerAlreadyExists: (containerName: string) =>
    new ContainerAlreadyExistsError(containerName),

  /**
   * Crée une erreur échec démarrage conteneur
   */
  containerStartFailed: (containerName: string, cause?: unknown) =>
    new ContainerStartError(
      containerName,
      cause instanceof Error ? cause.message : String(cause ?? 'Unknown reason')
    ),

  /**
   * Crée une erreur échec arrêt conteneur
   */
  containerStopFailed: (containerName: string, reason: string) =>
    new ContainerStopError(containerName, reason),

  /**
   * Crée une erreur Docker non disponible
   */
  dockerNotRunning: () =>
    new DockerDaemonUnavailableError(),

  /**
   * Crée une erreur échec exec
   */
  execFailed: (containerName: string, cause: unknown) =>
    new BaseDockerError(
      `Command execution failed in container ${containerName}`,
      'DOCKER_009',
      { cause: cause instanceof Error ? cause : undefined }
    ),

  /**
   * Crée une erreur création conteneur échouée
   */
  containerCreateFailed: (containerName: string, cause?: unknown) =>
    new BaseDockerError(
      `Failed to create container ${containerName}`,
      'DOCKER_010',
      { cause: cause instanceof Error ? cause : undefined }
    ),
};

// Alias pour compatibilité
export const DockerError = DockerErrors;
