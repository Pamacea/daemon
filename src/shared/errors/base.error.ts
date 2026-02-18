/**
 * DaemonError - Base class for all Daemon-specific errors.
 *
 * Features:
 * - Proper Error extension (maintains correct prototype chain)
 * - Unique error codes for identification
 * - Cause chaining for error tracing
 * - Serializable for IPC/log transport
 *
 * @example
 * ```ts
 * throw new DaemonError('Something went wrong', 'DAEMON_001', {
 *   cause: originalError,
 *   context: { projectId: '123' }
 * });
 * ```
 */

export type ErrorContext = Record<string, unknown>;

export interface DaemonErrorOptions extends ErrorOptions {
  context?: ErrorContext;
}

export class DaemonError extends Error {
  /**
   * Unique error code for identification and categorization
   * Format: CATEGORY_### (e.g., DOCKER_001, DETECTION_001)
   */
  public readonly code: string;

  /**
   * Additional contextual information about the error
   */
  public readonly context: ErrorContext;

  /**
   * The name of the error class
   */
  public override name: string;

  constructor(message: string, code: string, options?: DaemonErrorOptions) {
    // Call Error constructor with cause support
    super(message, options);

    // Set the prototype chain correctly for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.code = code;
    this.context = options?.context ?? {};
  }

  /**
   * Convert error to a plain object for serialization (JSON, IPC, logging)
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      cause: this.cause instanceof Error
        ? {
            name: this.cause.name,
            message: this.cause.message,
            code: 'code' in this.cause ? (this.cause as DaemonError).code : undefined,
          }
        : this.cause,
      stack: this.stack,
    };
  }

  /**
   * Create a DaemonError from a plain object (deserialization)
   */
  static fromJSON(data: Record<string, unknown>): DaemonError {
    const error = new DaemonError(
      data['message'] as string,
      data['code'] as string,
      {
        cause: data['cause'] as ErrorOptions,
        context: data['context'] as ErrorContext,
      }
    );
    error.name = data['name'] as string;
    error.stack = data['stack'] as string;
    return error;
  }

  /**
   * Check if this error is of a specific type by code
   */
  isErrorCode(code: string): boolean {
    return this.code === code;
  }

  /**
   * Check if this error matches a code prefix (category)
   */
  isErrorCategory(category: string): boolean {
    return this.code.startsWith(category);
  }
}
