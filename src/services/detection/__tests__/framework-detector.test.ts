/**
 * Tests for FrameworkDetector service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrameworkDetector } from '../framework-detector.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn(),
  constants: { F_OK: 0 },
}));

describe('FrameworkDetector', () => {
  let detector: FrameworkDetector;

  beforeEach(() => {
    detector = new FrameworkDetector();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create detector', () => {
      expect(detector).toBeInstanceOf(FrameworkDetector);
    });
  });

  describe('detect', () => {
    it('should have detect method', () => {
      expect(typeof detector.detect).toBe('function');
    });
  });

  describe('detectLanguage', () => {
    it('should have language detection capability', () => {
      expect(detector).toHaveProperty('detect');
    });
  });

  describe('detectAll', () => {
    it('should have detectAll method', () => {
      expect(typeof detector.detectAll).toBe('function');
    });
  });

  describe('clearCache', () => {
    it('should clear cache', () => {
      expect(() => detector.clearCache()).not.toThrow();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache stats', () => {
      const stats = detector.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });
});
