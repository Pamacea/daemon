/**
 * Tests for Validation errors
 */

import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  SchemaValidationError,
  RequiredFieldError,
  InvalidFormatError,
  ValueOutOfRangeError,
  ConfigurationValidationError,
  type ValidationErrorDetail,
} from '../validation.error.js';

describe('ValidationError', () => {
  it('should create error with details', () => {
    const details: ValidationErrorDetail[] = [
      { field: 'email', message: 'Invalid email format' },
      { field: 'age', message: 'Must be positive' },
    ];
    const error = new ValidationError('Validation failed', details);

    expect(error.details).toEqual(details);
    expect(error.code).toBe('VALIDATION_001');
  });

  it('should get error messages', () => {
    const details: ValidationErrorDetail[] = [
      { field: 'email', message: 'Invalid email' },
      { field: 'age', message: 'Too young' },
    ];
    const error = new ValidationError('Validation failed', details);

    const messages = error.getErrorMessages();

    expect(messages).toEqual(['Invalid email', 'Too young']);
  });

  it('should get field-specific errors', () => {
    const details: ValidationErrorDetail[] = [
      { field: 'email', message: 'Invalid email' },
      { field: 'email', message: 'Already taken' },
      { field: 'age', message: 'Too young' },
    ];
    const error = new ValidationError('Validation failed', details);

    const emailErrors = error.getFieldErrors('email');

    expect(emailErrors).toHaveLength(2);
    expect(emailErrors[0].message).toBe('Invalid email');
  });
});

describe('SchemaValidationError', () => {
  it('should create error for schema validation', () => {
    const details: ValidationErrorDetail[] = [
      { field: 'name', message: 'Required' },
    ];
    const error = new SchemaValidationError('UserSchema', details);

    expect(error.message).toContain('UserSchema');
    expect(error.details).toEqual(details);
  });
});

describe('RequiredFieldError', () => {
  it('should create error for missing field', () => {
    const error = new RequiredFieldError('email');

    expect(error.message).toContain('email');
    expect(error.details[0].field).toBe('email');
  });
});

describe('InvalidFormatError', () => {
  it('should create error for invalid format', () => {
    const error = new InvalidFormatError('email', 'email', 'invalid-email');

    expect(error.message).toContain('email');
    expect(error.details[0].constraint).toBe('email');
    expect(error.details[0].value).toBe('invalid-email');
  });
});

describe('ValueOutOfRangeError', () => {
  it('should create error for out of range value', () => {
    const error = new ValueOutOfRangeError('age', 18, 100, 150);

    expect(error.message).toContain('150');
    expect(error.message).toContain('18-100');
    expect(error.details[0].constraint).toBe('18-100');
  });
});

describe('ConfigurationValidationError', () => {
  it('should create error for config validation', () => {
    const details: ValidationErrorDetail[] = [
      { field: 'port', message: 'Must be a number' },
    ];
    const error = new ConfigurationValidationError('database.config', details);

    expect(error.message).toContain('database.config');
  });
});
