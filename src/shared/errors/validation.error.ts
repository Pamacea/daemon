/**
 * Validation errors.
 *
 * Error codes:
 * - VALIDATION_001: Generic validation error
 * - VALIDATION_002: Schema validation error
 * - VALIDATION_003: Required field missing
 * - VALIDATION_004: Invalid format
 * - VALIDATION_005: Value out of range
 * - VALIDATION_006: Configuration validation error
 */

import { DaemonError, type DaemonErrorOptions } from './base.error.js';

/**
 * Validation error details
 */
export interface ValidationErrorDetail {
  field?: string;
  value?: unknown;
  constraint?: string;
  message: string;
}

/**
 * Base class for all validation-related errors
 */
export class ValidationError extends DaemonError {
  public readonly details: ValidationErrorDetail[];

  constructor(
    message: string,
    details: ValidationErrorDetail[] = [],
    options?: DaemonErrorOptions
  ) {
    super(message, 'VALIDATION_001', {
      ...options,
      context: {
        details,
        ...options?.context,
      },
    });
    this.name = 'ValidationError';
    this.details = details;
  }

  /**
   * Get all error messages as a flat array
   */
  getErrorMessages(): string[] {
    return this.details.map(d => d.message);
  }

  /**
   * Get errors for a specific field
   */
  getFieldErrors(field: string): ValidationErrorDetail[] {
    return this.details.filter(d => d.field === field);
  }
}

/**
 * Thrown when schema validation fails
 */
export class SchemaValidationError extends ValidationError {
  constructor(schemaName: string, details: ValidationErrorDetail[], options?: DaemonErrorOptions) {
    super(
      `Schema validation failed for ${schemaName}`,
      details,
      options
    );
    this.name = 'SchemaValidationError';
  }
}

/**
 * Thrown when a required field is missing
 */
export class RequiredFieldError extends ValidationError {
  constructor(field: string, options?: DaemonErrorOptions) {
    super(
      `Required field is missing: ${field}`,
      [{ field, message: `Field '${field}' is required` }],
      options
    );
    this.name = 'RequiredFieldError';
  }
}

/**
 * Thrown when a value has an invalid format
 */
export class InvalidFormatError extends ValidationError {
  constructor(field: string, expectedFormat: string, actualValue: unknown, options?: DaemonErrorOptions) {
    super(
      `Invalid format for field '${field}': expected ${expectedFormat}`,
      [{
        field,
        value: actualValue,
        constraint: expectedFormat,
        message: `Field '${field}' must be in ${expectedFormat} format`,
      }],
      options
    );
    this.name = 'InvalidFormatError';
  }
}

/**
 * Thrown when a value is out of allowed range
 */
export class ValueOutOfRangeError extends ValidationError {
  constructor(field: string, min: number, max: number, actualValue: number, options?: DaemonErrorOptions) {
    super(
      `Value out of range for '${field}': ${actualValue} (expected: ${min}-${max})`,
      [{
        field,
        value: actualValue,
        constraint: `${min}-${max}`,
        message: `Field '${field}' must be between ${min} and ${max}`,
      }],
      options
    );
    this.name = 'ValueOutOfRangeError';
  }
}

/**
 * Thrown when configuration validation fails
 */
export class ConfigurationValidationError extends ValidationError {
  constructor(configPath: string, details: ValidationErrorDetail[], options?: DaemonErrorOptions) {
    super(
      `Configuration validation failed for ${configPath}`,
      details,
      options
    );
    this.name = 'ConfigurationValidationError';
  }
}
