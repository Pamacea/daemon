/**
 * Tests for FileSystemHelper utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileSystemHelper } from '../file-helper.js';

// Mock fs promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  access: vi.fn(),
  copyFile: vi.fn(),
}));

describe('FileSystemHelper', () => {
  let fileHelper: FileSystemHelper;

  beforeEach(() => {
    fileHelper = new FileSystemHelper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create file helper', () => {
      expect(fileHelper).toBeInstanceOf(FileSystemHelper);
    });
  });

  describe('readFile', () => {
    it('should have readFile method', () => {
      expect(typeof fileHelper.readFile).toBe('function');
    });
  });

  describe('writeFile', () => {
    it('should have writeFile method', () => {
      expect(typeof fileHelper.writeFile).toBe('function');
    });
  });

  describe('readJson', () => {
    it('should have readJson method', () => {
      expect(typeof fileHelper.readJson).toBe('function');
    });
  });

  describe('writeJson', () => {
    it('should have writeJson method', () => {
      expect(typeof fileHelper.writeJson).toBe('function');
    });
  });

  describe('ensureDir', () => {
    it('should have ensureDir method', () => {
      expect(typeof fileHelper.ensureDir).toBe('function');
    });
  });

  describe('findFiles', () => {
    it('should have findFiles method', () => {
      expect(typeof fileHelper.findFiles).toBe('function');
    });
  });

  describe('copyFile', () => {
    it('should have copyFile method', () => {
      expect(typeof fileHelper.copyFile).toBe('function');
    });
  });

  describe('exists', () => {
    it('should have exists method', () => {
      expect(typeof fileHelper.exists).toBe('function');
    });
  });
});
