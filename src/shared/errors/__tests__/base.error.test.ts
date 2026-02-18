/**
 * Tests for DaemonError base class
 */

import { describe, it, expect } from 'vitest';
import { DaemonError, type ErrorContext, type DaemonErrorOptions } from '../base.error.js';

describe('DaemonError', () => {
  it('should create error with message and code', () => {
    const error = new DaemonError('Test error', 'TEST_001');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_001');
    expect(error.name).toBe('DaemonError');
  });

  it('should include context in error', () => {
    const context: ErrorContext = { userId: '123', action: 'test' };
    const error = new DaemonError('Test error', 'TEST_002', { context });

    expect(error.context).toEqual(context);
  });

  it('should support cause chaining', () => {
    const originalError = new Error('Original error');
    const error = new DaemonError('Wrapped error', 'TEST_003', { cause: originalError });

    expect(error.cause).toBe(originalError);
  });

  it('should serialize to JSON', () => {
    const context: ErrorContext = { key: 'value' };
    const error = new DaemonError('Test error', 'TEST_004', { context });

    const json = error.toJSON();

    expect(json).toMatchObject({
      name: 'DaemonError',
      message: 'Test error',
      code: 'TEST_004',
      context: { key: 'value' },
    });
    expect(json).toHaveProperty('stack');
  });

  it('should check error code', () => {
    const error = new DaemonError('Test error', 'TEST_005');

    expect(error.isErrorCode('TEST_005')).toBe(true);
    expect(error.isErrorCode('TEST_999')).toBe(false);
  });

  it('should check error category', () => {
    const error = new DaemonError('Test error', 'DOCKER_001');

    expect(error.isErrorCategory('DOCKER')).toBe(true);
    expect(error.isErrorCategory('COMMAND')).toBe(false);
  });

  it('should deserialize from JSON', () => {
    const data = {
      name: 'DaemonError',
      message: 'Test error',
      code: 'TEST_006',
      context: { key: 'value' },
      stack: 'Error: Test error\n    at test.ts:1',
    };

    const error = DaemonError.fromJSON(data);

    expect(error.name).toBe('DaemonError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_006');
    expect(error.context).toEqual({ key: 'value' });
  });
});
