/**
 * Tests for Command execution errors
 */

import { describe, it, expect } from 'vitest';
import {
  CommandExecutionError,
  CommandNotFoundError,
  CommandTimeoutError,
  CommandFailedError,
  InvalidCommandArgumentsError,
  CommandCancelledError,
} from '../command.error.js';

describe('CommandExecutionError', () => {
  it('should create error with command details', () => {
    const error = new CommandExecutionError(
      'Command failed',
      'npm test',
      1,
      'stdout output',
      'stderr output'
    );

    expect(error.command).toBe('npm test');
    expect(error.exitCode).toBe(1);
    expect(error.stdout).toBe('stdout output');
    expect(error.stderr).toBe('stderr output');
    expect(error.code).toBe('COMMAND_001');
  });

  it('should check non-zero exit code', () => {
    const error1 = new CommandExecutionError('Failed', 'cmd', 1, '', '');
    const error2 = new CommandExecutionError('Failed', 'cmd', 0, '', '');
    const error3 = new CommandExecutionError('Failed', 'cmd', null, '', '');

    expect(error1.isNonZeroExit()).toBe(true);
    expect(error2.isNonZeroExit()).toBe(false);
    expect(error3.isNonZeroExit()).toBe(false);
  });
});

describe('CommandNotFoundError', () => {
  it('should create error for missing command', () => {
    const error = new CommandNotFoundError('nonexistent');

    expect(error.message).toContain('nonexistent');
    expect(error.command).toBe('nonexistent');
    expect(error.name).toBe('CommandNotFoundError');
  });
});

describe('CommandTimeoutError', () => {
  it('should create error with timeout info', () => {
    const error = new CommandTimeoutError('npm test', 5000);

    expect(error.message).toContain('5000ms');
    expect(error.command).toBe('npm test');
    expect(error.name).toBe('CommandTimeoutError');
  });
});

describe('CommandFailedError', () => {
  it('should create error for non-zero exit', () => {
    const error = new CommandFailedError('npm test', 1, 'stdout', 'stderr');

    expect(error.message).toContain('exit code 1');
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe('CommandFailedError');
  });
});

describe('InvalidCommandArgumentsError', () => {
  it('should create error with reason', () => {
    const error = new InvalidCommandArgumentsError('npm test', 'missing required option');

    expect(error.message).toContain('missing required option');
    expect(error.name).toBe('InvalidCommandArgumentsError');
  });
});

describe('CommandCancelledError', () => {
  it('should create cancellation error', () => {
    const error = new CommandCancelledError('npm test');

    expect(error.message).toContain('cancelled');
    expect(error.name).toBe('CommandCancelledError');
  });
});
