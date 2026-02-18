/**
 * Command execution errors.
 *
 * Error codes:
 * - COMMAND_001: Generic command execution error
 * - COMMAND_002: Command not found
 * - COMMAND_003: Command timeout
 * - COMMAND_004: Command returned non-zero exit code
 * - COMMAND_005: Invalid command arguments
 * - COMMAND_006: Command cancelled
 */

import { DaemonError, type DaemonErrorOptions, type ErrorContext } from './base.error.js';

/**
 * Base class for all command execution errors
 */
export class CommandExecutionError extends DaemonError {
  public readonly command: string;
  public readonly exitCode: number | null;
  public readonly stdout: string;
  public readonly stderr: string;

  constructor(
    message: string,
    command: string,
    exitCode: number | null,
    stdout: string,
    stderr: string,
    options?: DaemonErrorOptions
  ) {
    super(message, 'COMMAND_001', {
      ...options,
      context: {
        command,
        exitCode,
        stdout,
        stderr,
        ...options?.context,
      },
    });
    this.name = 'CommandExecutionError';
    this.command = command;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }

  /**
   * Check if the command failed due to a non-zero exit code
   */
  isNonZeroExit(): boolean {
    return this.exitCode !== null && this.exitCode !== 0;
  }
}

/**
 * Thrown when a command executable is not found
 */
export class CommandNotFoundError extends CommandExecutionError {
  constructor(command: string, options?: DaemonErrorOptions) {
    super(
      `Command not found: ${command}`,
      command,
      null,
      '',
      '',
      options
    );
    this.name = 'CommandNotFoundError';
  }
}

/**
 * Thrown when a command execution times out
 */
export class CommandTimeoutError extends CommandExecutionError {
  constructor(command: string, timeout: number, options?: DaemonErrorOptions) {
    super(
      `Command timed out after ${timeout}ms: ${command}`,
      command,
      null,
      '',
      '',
      {
        ...options,
        context: {
          timeout,
          ...options?.context,
        },
      }
    );
    this.name = 'CommandTimeoutError';
  }
}

/**
 * Thrown when a command returns a non-zero exit code
 */
export class CommandFailedError extends CommandExecutionError {
  constructor(
    command: string,
    exitCode: number,
    stdout: string,
    stderr: string,
    options?: DaemonErrorOptions
  ) {
    super(
      `Command failed with exit code ${exitCode}: ${command}`,
      command,
      exitCode,
      stdout,
      stderr,
      options
    );
    this.name = 'CommandFailedError';
  }
}

/**
 * Thrown when command arguments are invalid
 */
export class InvalidCommandArgumentsError extends CommandExecutionError {
  constructor(command: string, reason: string, options?: DaemonErrorOptions) {
    super(
      `Invalid command arguments for ${command}: ${reason}`,
      command,
      null,
      '',
      '',
      {
        ...options,
        context: {
          reason,
          ...options?.context,
        },
      }
    );
    this.name = 'InvalidCommandArgumentsError';
  }
}

/**
 * Thrown when a command is cancelled by the user or system
 */
export class CommandCancelledError extends CommandExecutionError {
  constructor(command: string, options?: DaemonErrorOptions) {
    super(
      `Command cancelled: ${command}`,
      command,
      null,
      '',
      '',
      options
    );
    this.name = 'CommandCancelledError';
  }
}

// Re-export DaemonErrorOptions for convenience
export type { DaemonErrorOptions, ErrorContext };
