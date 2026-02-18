/**
 * Tests for CommandExecutor utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandExecutor } from '../command-executor.js';

// Mock the child_process exec
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

describe('CommandExecutor', () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
    vi.clearAllMocks();
  });

  it('should create executor with default options', () => {
    expect(executor).toBeInstanceOf(CommandExecutor);
  });

  it('should create executor with custom options', () => {
    const customExecutor = new CommandExecutor({
      timeout: 10000,
      retries: 3,
      silent: true,
    });

    expect(customExecutor).toBeInstanceOf(CommandExecutor);
  });

  // Note: Full execution tests require mocking execAsync
  // These are basic structure tests

  describe('execute', () => {
    it('should have execute method', () => {
      expect(typeof executor.execute).toBe('function');
    });
  });

  describe('executeParallel', () => {
    it('should have executeParallel method', () => {
      expect(typeof executor.executeParallel).toBe('function');
    });
  });

  describe('executeSequence', () => {
    it('should have executeParallel method', () => {
      expect(typeof executor.executeParallel).toBe('function');
    });
  });
});
