/**
 * Tests for Logger utility
 */

import { describe, it, expect, vi } from 'vitest';
import { Logger, createLogger, LogLevel } from '../logger.js';

describe('Logger', () => {
  describe('constructor', () => {
    it('should create logger with context', () => {
      const logger = createLogger('TestLogger');

      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('debug', () => {
    it('should have debug method', () => {
      const logger = createLogger('TestLogger');

      expect(typeof logger.debug).toBe('function');
      // Should not throw
      logger.debug('Debug message');
      logger.debug('Debug with context', { key: 'value' });
    });
  });

  describe('info', () => {
    it('should have info method', () => {
      const logger = createLogger('TestLogger');

      expect(typeof logger.info).toBe('function');
      logger.info('Info message');
    });
  });

  describe('warn', () => {
    it('should have warn method', () => {
      const logger = createLogger('TestLogger');

      expect(typeof logger.warn).toBe('function');
      logger.warn('Warning message');
    });
  });

  describe('error', () => {
    it('should have error method', () => {
      const logger = createLogger('TestLogger');

      expect(typeof logger.error).toBe('function');
      logger.error('Error message');

      const error = new Error('Test error');
      logger.error('Error occurred', error);

      logger.error('Error with context', { userId: '123' });
    });
  });

  describe('success', () => {
    it('should have success method', () => {
      const logger = createLogger('TestLogger');

      expect(typeof logger.success).toBe('function');
      logger.success('Success message');
    });
  });

  describe('createLogger', () => {
    it('should create logger with context', () => {
      const customLogger = createLogger('CustomContext');

      expect(customLogger).toBeInstanceOf(Logger);
      customLogger.info('Test');
    });

    it('should create logger with silent option', () => {
      const silentLogger = createLogger('SilentLogger');

      expect(silentLogger).toBeInstanceOf(Logger);
      silentLogger.setLevel(LogLevel.SILENT);
      silentLogger.info('This should not appear');
    });
  });

  describe('setLevel', () => {
    it('should have setLevel method', () => {
      const logger = createLogger('TestLogger');

      expect(typeof logger.setLevel).toBe('function');
      logger.setLevel(LogLevel.SILENT);
      logger.info('Silent info');
      logger.setLevel(LogLevel.INFO);
      logger.info('Visible info');
    });

    it('should have getLevel method', () => {
      const logger = createLogger('TestLogger');

      expect(typeof logger.getLevel).toBe('function');
      const level = logger.getLevel();
      expect(typeof level).toBe('number');
    });
  });
});
