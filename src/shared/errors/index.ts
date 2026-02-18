/**
 * Daemon Error System
 *
 * Centralized error handling for the Daemon toolkit.
 * All errors extend DaemonError base class with:
 * - Unique error codes
 * - Cause chaining support
 * - Serialization capabilities
 *
 * @example
 * ```ts
 * import {
 *   ContainerNotFoundError,
 *   UnsupportedFrameworkError,
 *   CommandFailedError
 * } from '@pamacea/daemon/errors';
 *
 * throw new ContainerNotFoundError('my-container');
 * ```
 */

// Base error
export {
  DaemonError,
  type ErrorContext,
  type DaemonErrorOptions,
} from './base.error.js';

// Re-import DaemonError for type use in this file
import { DaemonError as DaemonErrorClass } from './base.error.js';
type DaemonError = DaemonErrorClass;

// Docker errors
export {
  DockerErrors,
  BaseDockerError,
  ContainerNotFoundError,
  ImageBuildError,
  ContainerAlreadyExistsError,
  ContainerStartError,
  ContainerStopError,
  DockerDaemonUnavailableError,
  ImagePullError,
} from './docker.error.js';

// Detection errors
export {
  DetectionError,
  UnsupportedFrameworkError,
} from './detection.error.js';

// Command errors
export {
  CommandExecutionError,
  CommandNotFoundError,
  CommandTimeoutError,
  CommandFailedError,
  InvalidCommandArgumentsError,
  CommandCancelledError,
} from './command.error.js';

// Validation errors
export {
  ValidationError,
  SchemaValidationError,
  RequiredFieldError,
  InvalidFormatError,
  ValueOutOfRangeError,
  ConfigurationValidationError,
  type ValidationErrorDetail,
} from './validation.error.js';

// File system errors
export {
  FileSystemError,
  FileNotFoundError,
  FilePermissionError,
  InvalidJsonError,
  DirectoryCreationError,
  FileWriteError,
  FileReadError,
  FileCopyError,
  FileSearchError,
} from './file.error.js';

/**
 * Error code categories
 */
export enum ErrorCategory {
  DAEMON = 'DAEMON',
  DOCKER = 'DOCKER',
  DETECTION = 'DETECTION',
  COMMAND = 'COMMAND',
  VALIDATION = 'VALIDATION',
  FILESYSTEM = 'FILE',
}

/**
 * Check if an error is a DaemonError
 */
export function isDaemonError(error: unknown): error is DaemonError {
  const err = error as Record<string, unknown>;
  return err !== null && typeof err === 'object' && 'code' in err && 'message' in err;
}

/**
 * Check if an error belongs to a specific category
 */
export function isErrorCategory(error: unknown, category: ErrorCategory): boolean {
  const err = error as Record<string, unknown>;
  if (!isDaemonError(error)) {
    return false;
  }
  const code = err.code as string;
  return typeof code === 'string' && code.startsWith(category);
}

/**
 * Get a safe error message (handles unknown errors)
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  const err = error as Record<string, unknown>;
  if (err !== null && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return String(error);
}

/**
 * Get error code from any error (returns 'UNKNOWN' if not a DaemonError)
 */
export function getErrorCode(error: unknown): string {
  const err = error as Record<string, unknown>;
  if (err !== null && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  return 'UNKNOWN';
}
