/**
 * Tests for DockerManager service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerManager } from '../docker-manager.js';

describe('DockerManager', () => {
  let manager: DockerManager;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create manager with default config', () => {
      manager = new DockerManager({});

      expect(manager).toBeInstanceOf(DockerManager);
    });

    it('should create manager with custom config', () => {
      manager = new DockerManager({
        imageName: 'custom-image',
        containerName: 'custom-container',
      });

      expect(manager).toBeInstanceOf(DockerManager);
    });
  });

  describe('isRunning', () => {
    it('should have isRunning method', () => {
      manager = new DockerManager({});
      expect(typeof manager.isRunning).toBe('function');
    });
  });

  describe('build', () => {
    it('should have build method', () => {
      manager = new DockerManager({});
      expect(typeof manager.build).toBe('function');
    });
  });

  describe('start', () => {
    it('should have start method', () => {
      manager = new DockerManager({});
      expect(typeof manager.start).toBe('function');
    });
  });

  describe('stop', () => {
    it('should have stop method', () => {
      manager = new DockerManager({});
      expect(typeof manager.stop).toBe('function');
    });
  });

  describe('remove', () => {
    it('should have remove method', () => {
      manager = new DockerManager({});
      expect(typeof manager.remove).toBe('function');
    });
  });

  describe('exec', () => {
    it('should have exec method', () => {
      manager = new DockerManager({});
      expect(typeof manager.exec).toBe('function');
    });
  });

  describe('getLogs', () => {
    it('should have getLogs method', () => {
      manager = new DockerManager({});
      expect(typeof manager.getLogs).toBe('function');
    });
  });
});
