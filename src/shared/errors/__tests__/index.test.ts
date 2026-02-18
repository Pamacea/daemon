/**
 * Tests for Error system utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isDaemonError,
  isErrorCategory,
  getErrorMessage,
  getErrorCode,
  ErrorCategory,
  DaemonError,
} from '../index.js';

describe('isDaemonError', () => {
  it('should return true for DaemonError instances', () => {
    const error = new DaemonError('Test', 'TEST_001');

    expect(isDaemonError(error)).toBe(true);
  });

  it('should return false for regular errors', () => {
    const error = new Error('Test');

    expect(isDaemonError(error)).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isDaemonError(null)).toBe(false);
    expect(isDaemonError(undefined)).toBe(false);
    expect(isDaemonError('string')).toBe(false);
    expect(isDaemonError(123)).toBe(false);
  });
});

describe('isErrorCategory', () => {
  it('should check error category', () => {
    const dockerError = new DaemonError('Docker error', 'DOCKER_001');
    const commandError = new DaemonError('Command error', 'COMMAND_001');
    const plainError = new Error('Plain error');

    expect(isErrorCategory(dockerError, ErrorCategory.DOCKER)).toBe(true);
    expect(isErrorCategory(dockerError, ErrorCategory.COMMAND)).toBe(false);
    expect(isErrorCategory(commandError, ErrorCategory.COMMAND)).toBe(true);
    expect(isErrorCategory(plainError, ErrorCategory.DAEMON)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('should return message from DaemonError', () => {
    const error = new DaemonError('Test error', 'TEST_001');

    expect(getErrorMessage(error)).toBe('Test error');
  });

  it('should return message from regular Error', () => {
    const error = new Error('Regular error');

    expect(getErrorMessage(error)).toBe('Regular error');
  });

  it('should convert non-errors to string', () => {
    expect(getErrorMessage('string error')).toBe('string error');
    expect(getErrorMessage(123)).toBe('123');
    expect(getErrorMessage(null)).toBe('null');
  });
});

describe('getErrorCode', () => {
  it('should return code from DaemonError', () => {
    const error = new DaemonError('Test', 'CUSTOM_123');

    expect(getErrorCode(error)).toBe('CUSTOM_123');
  });

  it('should return UNKNOWN for regular errors', () => {
    const error = new Error('Test');

    expect(getErrorCode(error)).toBe('UNKNOWN');
  });

  it('should return UNKNOWN for non-errors', () => {
    expect(getErrorCode('string')).toBe('UNKNOWN');
    expect(getErrorCode(null)).toBe('UNKNOWN');
  });
});
