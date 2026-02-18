/**
 * Command Executor
 *
 * Utility for executing shell commands with:
 * - Async execution using promisified exec
 * - Timeout handling
 * - Retry logic with exponential backoff
 * - Environment and working directory control
 * - Structured error handling
 * - Execution metrics
 *
 * @example
 * ```ts
 * import { CommandExecutor } from '@pamacea/daemon/utils';
 *
 * const executor = new CommandExecutor();
 * const result = await executor.execute('npm test', {
 *   timeout: 30000,
 *   retries: 2
 * });
 *
 * if (result.success) {
 *   console.log(result.data.stdout);
 * }
 * ```
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import {
  CommandExecutionError,
  CommandFailedError,
  CommandTimeoutError,
  CommandNotFoundError,
  type DaemonErrorOptions,
} from '../errors/command.error.js';
import type { Result } from '../../core/types/common.types.js';

const execAsync = promisify(exec);

/**
 * Default configuration values
 */
const DEFAULTS = {
  timeout: 30000, // 30 seconds
  retries: 0,
  silent: false,
} as const;

/**
 * Options for command execution
 */
export interface CommandOptions {
  /**
   * Maximum time to wait for command completion (milliseconds)
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Suppress output logging
   * @default false
   */
  silent?: boolean;

  /**
   * Number of retry attempts on failure
   * @default 0
   */
  retries?: number;

  /**
   * Working directory for command execution
   * @default current working directory
   */
  cwd?: string;

  /**
   * Environment variables for command execution
   * Merges with process.env
   */
  env?: Record<string, string> | NodeJS.ProcessEnv;

  /**
   * Input to pass to stdin
   */
  input?: string | Buffer | undefined;

  /**
   * Maximum buffer size for stdout/stderr
   * @default 1024 * 1024 (1MB)
   */
  maxBuffer?: number;

  /**
   * Initial delay before first retry (milliseconds)
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Multiplier for exponential backoff
   * @default 2
   */
  retryBackoffMultiplier?: number;

  /**
   * Whether to reject on non-zero exit code
   * @default true
   */
  rejectOnError?: boolean;
}

/**
 * Result of command execution
 */
export interface CommandResult {
  /**
   * Whether the command succeeded (exit code 0)
   */
  success: boolean;

  /**
   * Standard output from the command
   */
  stdout: string;

  /**
   * Standard error output from the command
   */
  stderr: string;

  /**
   * Process exit code
   */
  exitCode: number | null;

  /**
   * Execution duration in milliseconds
   */
  duration: number;

  /**
   * The command that was executed
   */
  command: string;

  /**
   * Number of retry attempts used
   */
  attempts: number;

  /**
   * Error if command failed (only present when success is false)
   */
  error?: Error;
}

/**
 * Options for parallel command execution
 */
export interface ParallelCommandOptions {
  /**
   * Maximum number of concurrent commands
   * @default Infinity (no limit)
   */
  concurrency?: number;

  /**
   * Whether to stop all commands on first failure
   * @default false
   */
  stopOnError?: boolean;

  /**
   * Global timeout for all commands (milliseconds)
   */
  timeout?: number;
}

/**
 * Single command definition for parallel execution
 */
export interface CommandDefinition {
  /**
   * Unique identifier for this command
   */
  id: string;

  /**
   * Command string to execute
   */
  command: string;

  /**
   * Options specific to this command
   */
  options?: CommandOptions;
}

/**
 * Result of parallel command execution
 */
export interface ParallelExecutionResult {
  /**
   * Map of command results by ID
   */
  results: Map<string, CommandResult>;

  /**
   * Overall success status (true if all commands succeeded)
   */
  success: boolean;

  /**
   * Total execution duration in milliseconds
   */
  duration: number;

  /**
   * Number of successful commands
   */
  successful: number;

  /**
   * Number of failed commands
   */
  failed: number;

  /**
   * Total number of commands
   */
  total: number;
}

/**
 * Resolve error code to specific error type
 */
function resolveCommandError(
  command: string,
  exitCode: number | null,
  stdout: string,
  stderr: string,
  duration: number,
  options: CommandOptions
): CommandExecutionError {
  // Check for ENOENT (command not found)
  if (stderr.includes('not found') || stderr.includes('command not found') || stderr.includes('no such file')) {
    return new CommandNotFoundError(command);
  }

  // Check timeout
  if (options.timeout && duration >= options.timeout) {
    return new CommandTimeoutError(command, options.timeout);
  }

  // Default to failed error
  return new CommandFailedError(command, exitCode ?? -1, stdout, stderr);
}

/**
 * Calculate delay with exponential backoff
 */
function calculateRetryDelay(
  attempt: number,
  baseDelay: number,
  multiplier: number
): number {
  return Math.min(baseDelay * Math.pow(multiplier, attempt), 30000);
}

/**
 * Command executor with async execution, retries, and parallel support
 */
export class CommandExecutor {
  private readonly defaultOptions: Partial<CommandOptions>;

  constructor(defaultOptions: Partial<CommandOptions> = {}) {
    this.defaultOptions = {
      timeout: defaultOptions.timeout ?? DEFAULTS.timeout,
      silent: defaultOptions.silent ?? DEFAULTS.silent,
      retries: defaultOptions.retries ?? DEFAULTS.retries,
      cwd: defaultOptions.cwd,
      env: defaultOptions.env,
    };
  }

  /**
   * Execute a single command
   *
   * @param command - Command string to execute
   * @param options - Execution options
   * @returns Result with stdout, stderr, exit code, and duration
   */
  async execute(
    command: string,
    options: CommandOptions = {}
  ): Promise<Result<CommandResult, CommandExecutionError>> {
    const mergedOptions: {
      timeout: number;
      silent: boolean;
      retries: number;
      cwd: string;
      env: Record<string, string> | NodeJS.ProcessEnv;
      input: string | Buffer | undefined;
      maxBuffer: number;
      retryDelay: number;
      retryBackoffMultiplier: number;
      rejectOnError: boolean;
    } = {
      timeout: options.timeout ?? this.defaultOptions.timeout ?? DEFAULTS.timeout,
      silent: options.silent ?? this.defaultOptions.silent ?? DEFAULTS.silent,
      retries: options.retries ?? this.defaultOptions.retries ?? DEFAULTS.retries,
      cwd: options.cwd ?? this.defaultOptions.cwd ?? process.cwd(),
      env: options.env ?? this.defaultOptions.env ?? process.env,
      input: options.input ?? undefined,
      maxBuffer: options.maxBuffer ?? 1024 * 1024,
      retryDelay: options.retryDelay ?? 1000,
      retryBackoffMultiplier: options.retryBackoffMultiplier ?? 2,
      rejectOnError: options.rejectOnError ?? true,
    };

    let lastError: CommandExecutionError | null = null;
    let attempts = 0;
    const maxAttempts = mergedOptions.retries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      attempts = attempt + 1;

      if (attempt > 0 && mergedOptions.retries > 0) {
        const delay = calculateRetryDelay(
          attempt,
          mergedOptions.retryDelay,
          mergedOptions.retryBackoffMultiplier
        );
        await this.sleep(delay);
      }

      const result = await this.executeSingle(command, mergedOptions);

      if (result.success) {
        return result;
      }

      lastError = result.error ?? null;
    }

    // All retries exhausted
    return {
      success: false,
      error: lastError ?? new CommandExecutionError(command, command, null, '', ''),
    };
  }

  /**
   * Execute multiple commands in parallel
   *
   * @param commands - Array of command definitions
   * @param parallelOptions - Parallel execution options
   * @returns Aggregate result of all commands
   */
  async executeParallel(
    commands: CommandDefinition[],
    parallelOptions: ParallelCommandOptions = {}
  ): Promise<ParallelExecutionResult> {
    const startTime = performance.now();
    const results = new Map<string, CommandResult>();
    const { concurrency = Infinity, stopOnError = false } = parallelOptions;

    let successful = 0;
    let failed = 0;
    let shouldStop = false;

    // Process commands in batches based on concurrency
    for (let i = 0; i < commands.length; i += concurrency) {
      if (shouldStop) break;

      const batch = commands.slice(i, i + concurrency);
      const batchPromises = batch.map(async (cmd) => {
        if (shouldStop) return null;

        const result = await this.execute(cmd.command, cmd.options);
        const cmdResult = result.success
          ? result.data
          : {
              success: false,
              stdout: '',
              stderr: result.error?.stderr ?? '',
              exitCode: result.error?.exitCode ?? null,
              duration: 0,
              command: cmd.command,
              attempts: 1,
              error: result.error,
            };

        results.set(cmd.id, cmdResult);

        if (cmdResult.success) {
          successful++;
        } else {
          failed++;
          if (stopOnError) {
            shouldStop = true;
          }
        }

        return cmdResult;
      });

      await Promise.all(batchPromises);
    }

    const duration = Math.round(performance.now() - startTime);

    return {
      results,
      success: failed === 0,
      duration,
      successful,
      failed,
      total: commands.length,
    };
  }

  /**
   * Execute command and return Result type
   */
  private async executeSingle(
    command: string,
    options: {
      timeout: number;
      silent: boolean;
      retries: number;
      cwd: string;
      env: Record<string, string> | NodeJS.ProcessEnv;
      input: string | Buffer | undefined;
      maxBuffer: number;
      retryDelay: number;
      retryBackoffMultiplier: number;
      rejectOnError: boolean;
    }
  ): Promise<Result<CommandResult, CommandExecutionError>> {
    const startTime = performance.now();

    try {
      // Build exec options
      const execOptions = {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        timeout: options.timeout,
        maxBuffer: options.maxBuffer,
        encoding: 'utf8' as const,
      };

      // Execute command with timeout wrapper
      const result = await Promise.race([
        execAsync(command, execOptions),
        this.createTimeoutReject(options.timeout, command),
      ]) as { stdout: string; stderr: string };

      const duration = Math.round(performance.now() - startTime);

      return {
        success: true,
        data: {
          success: true,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: 0,
          duration,
          command,
          attempts: 1,
        },
      };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      const err = error as { code?: string; stdout?: string; stderr?: string; killed?: boolean };

      // Extract stdout/stderr from error
      const stdout = (err.stdout as string) ?? '';
      const stderr = (err.stderr as string) ?? '';

      // Determine exit code
      let exitCode: number | null = null;
      if (err.killed) {
        exitCode = null; // Killed by timeout
      } else if (err.code === 'ENOENT') {
        exitCode = null; // Command not found
      }

      // Create appropriate error
      const commandError = resolveCommandError(
        command,
        exitCode,
        stdout,
        stderr,
        duration,
        options
      );

      return {
        success: false,
        error: commandError,
      };
    }
  }

  /**
   * Create a promise that rejects after timeout
   */
  private createTimeoutReject<T>(timeout: number, command: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new CommandTimeoutError(command, timeout));
      }, timeout + 100); // Add small buffer
    });
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute command synchronously (for compatibility only - not recommended)
   *
   * @deprecated Use execute() instead for async execution
   */
  executeSync(
    _command: string,
    _options?: CommandOptions
  ): Result<CommandResult, CommandExecutionError> {
    throw new Error(
      'Synchronous execution is not supported. Use the async execute() method instead.'
    );
  }
}

/**
 * Default singleton instance
 */
export const commandExecutor = new CommandExecutor();

/**
 * Convenience function to execute a command
 *
 * @example
 * ```ts
 * import { executeCommand } from '@pamacea/daemon/utils';
 *
 * const result = await executeCommand('npm test', { timeout: 60000 });
 * ```
 */
export async function executeCommand(
  command: string,
  options?: CommandOptions
): Promise<Result<CommandResult, CommandExecutionError>> {
  return commandExecutor.execute(command, options);
}

/**
 * Convenience function to execute commands in parallel
 *
 * @example
 * ```ts
 * import { executeCommandsParallel } from '@pamacea/daemon/utils';
 *
 * const result = await executeCommandsParallel([
 *   { id: 'test', command: 'npm test' },
 *   { id: 'lint', command: 'npm run lint' },
 * ], { concurrency: 2 });
 * ```
 */
export async function executeCommandsParallel(
  commands: CommandDefinition[],
  options?: ParallelCommandOptions
): Promise<ParallelExecutionResult> {
  return commandExecutor.executeParallel(commands, options);
}
