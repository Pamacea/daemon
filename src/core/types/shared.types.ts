/**
 * Shared types for Daemon
 *
 * Common utility types used across the application.
 */

/**
 * Command execution options
 */
export interface CommandOptions {
  /** Command timeout in milliseconds */
  timeout?: number;
  /** Silent mode - suppress output */
  silent?: boolean;
  /** Number of retries on failure */
  retries?: number;
  /** Error handling strategy */
  onError?: 'throw' | 'return' | 'ignore';
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Command execution result
 */
export interface CommandResult {
  /** Whether command succeeded */
  success: boolean;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * File system options
 */
export interface FsOptions {
  /** Encoding */
  encoding?: BufferEncoding;
  /** Create parent directories if needed */
  recursive?: boolean;
  /** File permissions mode */
  mode?: number;
}

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Log entry
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Optional metadata */
  meta?: Record<string, unknown>;
  /** Optional error */
  error?: Error;
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /** Minimum log level */
  level?: LogLevel;
  /** Enable colors */
  color?: boolean;
  /** Enable timestamps */
  timestamp?: boolean;
  /** Custom prefix */
  prefix?: string;
  /** Output stream */
  stream?: NodeJS.WritableStream;
}

/**
 * Error types
 */
export type ErrorType =
  | 'DOCKER_NOT_RUNNING'
  | 'DOCKER_BUILD_FAILED'
  | 'DOCKER_EXEC_FAILED'
  | 'DETECTION_FAILED'
  | 'FILE_NOT_FOUND'
  | 'INVALID_CONFIG'
  | 'COMMAND_FAILED'
  | 'TEST_FAILED'
  | 'UNKNOWN';

/**
 * Error context
 */
export interface ErrorContext {
  /** Error type */
  type: ErrorType;
  /** Error message */
  message: string;
  /** Original cause */
  cause?: unknown;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Maybe type for optional values
 */
export type Maybe<T> = T | null | undefined;

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
