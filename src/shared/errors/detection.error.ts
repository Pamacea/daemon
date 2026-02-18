/**
 * Framework detection errors.
 *
 * Error codes:
 * - DETECTION_001: Generic detection error
 * - DETECTION_002: Unsupported framework
 * - DETECTION_003: No framework detected
 * - DETECTION_004: Ambiguous framework detection
 * - DETECTION_005: Invalid project structure
 */

import { DaemonError, type ErrorContext, type DaemonErrorOptions } from './base.error.js';

/**
 * Base class for all detection-related errors
 */
export class DetectionError extends DaemonError {
  constructor(message: string, code: string, options?: DaemonErrorOptions) {
    super(message, code, options);
    this.name = 'DetectionError';
  }
}

/**
 * Thrown when a framework is not supported by Daemon
 */
export class UnsupportedFrameworkError extends DetectionError {
  constructor(framework: string, options?: DaemonErrorOptions) {
    super(
      `Unsupported framework: ${framework}. Daemon currently supports a limited set of frameworks.`,
      'DETECTION_002',
      {
        ...options,
        context: {
          framework,
          ...options?.context,
        },
      }
    );
    this.name = 'UnsupportedFrameworkError';
  }
}

/**
 * Thrown when no framework can be detected in the project
 */
export class NoFrameworkDetectedError extends DetectionError {
  constructor(projectPath: string, options?: DaemonErrorOptions) {
    super(
      `No supported framework detected in ${projectPath}`,
      'DETECTION_003',
      {
        ...options,
        context: {
          projectPath,
          ...options?.context,
        },
      }
    );
    this.name = 'NoFrameworkDetectedError';
  }
}

/**
 * Thrown when framework detection is ambiguous (multiple possible frameworks)
 */
export class AmbiguousFrameworkError extends DetectionError {
  constructor(candidates: string[], options?: DaemonErrorOptions) {
    super(
      `Ambiguous framework detection: multiple frameworks detected (${candidates.join(', ')})`,
      'DETECTION_004',
      {
        ...options,
        context: {
          candidates,
          ...options?.context,
        },
      }
    );
    this.name = 'AmbiguousFrameworkError';
  }
}

/**
 * Thrown when the project structure is invalid or corrupted
 */
export class InvalidProjectStructureError extends DetectionError {
  constructor(projectPath: string, reason: string, options?: DaemonErrorOptions) {
    super(
      `Invalid project structure at ${projectPath}: ${reason}`,
      'DETECTION_005',
      {
        ...options,
        context: {
          projectPath,
          reason,
          ...options?.context,
        },
      }
    );
    this.name = 'InvalidProjectStructureError';
  }
}
