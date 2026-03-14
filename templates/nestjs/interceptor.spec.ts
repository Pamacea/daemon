/**
 * NestJS Interceptor Test Template
 *
 * Tests for NestJS interceptors following best practices:
 * - Request/response transformation
 * - Logging and monitoring
 * - Caching behavior
 * - Timeout handling
 *
 * @package test
 */

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, Observable, throwError } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggingInterceptor } from './logging.interceptor';
import { TransformInterceptor } from './transform.interceptor';
import { TimeoutInterceptor } from './timeout.interceptor';
import { CacheInterceptor } from './cache.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('intercept', () => {
    it('should log request start and end', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        complete: () => {
          expect(consoleSpy).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should log request method and url', (done) => {
      const request = {
        method: 'GET',
        url: '/test',
      };
      const context = createMockExecutionContext(request);
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        complete: () => {
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('GET')
          );
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('/test')
          );
          done();
        },
      });
    });

    it('should log response time', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const startTime = Date.now();

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        complete: () => {
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('ms')
          );
          done();
        },
      });
    });

    it('should log errors', (done) => {
      const context = createMockExecutionContext();
      const error = new Error('Test error');
      const next: CallHandler = {
        handle: () => throwError(() => error),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        error: () => {
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Error')
          );
          done();
        },
      });
    });
  });

  describe('log formatting', () => {
    it('should format logs with timestamp', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        complete: () => {
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
          );
          done();
        },
      });
    });

    it('should include correlation ID if present', (done) => {
      const request = {
        headers: {
          'x-correlation-id': 'test-123',
        },
      };
      const context = createMockExecutionContext(request);
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        complete: () => {
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('test-123')
          );
          done();
        },
      });
    });
  });
});

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  describe('intercept', () => {
    it('should wrap response data', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('data');
          expect(data.data).toEqual({ data: 'test' });
          done();
        },
      });
    });

    it('should include timestamp in response', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('timestamp');
          expect(typeof data.timestamp).toBe('number');
          done();
        },
      });
    });

    it('should include status code', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('statusCode');
          done();
        },
      });
    });

    it('should handle null responses', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () => of(null),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('data');
          expect(data.data).toBeNull();
          done();
        },
      });
    });

    it('should handle array responses', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () => of([{ id: 1 }, { id: 2 }]),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('data');
          expect(Array.isArray(data.data)).toBe(true);
          done();
        },
      });
    });
  });
});

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;

  beforeEach(() => {
    interceptor = new TimeoutInterceptor(5000); // 5 second timeout
  });

  describe('intercept', () => {
    it('should complete requests within timeout', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: (data) => {
          expect(data).toEqual({ data: 'test' });
          done();
        },
      });
    });

    it('should timeout slow requests', (done) => {
      const context = createMockExecutionContext();
      const next: CallHandler = {
        handle: () =>
          new Observable((subscriber) => {
            setTimeout(() => subscriber.next({ data: 'test' }), 10000);
          }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        error: (error) => {
          expect(error).toBeDefined();
          done();
        },
      });
    }, 6000);

    it('should handle timeout from constructor', () => {
      const customInterceptor = new TimeoutInterceptor(1000);
      expect(customInterceptor).toBeDefined();
    });
  });
});

describe('CacheInterceptor', () => {
  let interceptor: CacheInterceptor;
  let cacheManager: any;

  beforeEach(() => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };
    interceptor = new CacheInterceptor(cacheManager);
  });

  describe('intercept', () => {
    it('should return cached value if available', (done) => {
      const context = createMockExecutionContext();
      const cachedValue = { data: 'cached' };

      jest.spyOn(interceptor, 'getCacheKey').mockReturnValue('cache-key');
      cacheManager.get.mockResolvedValue(cachedValue);

      const next: CallHandler = {
        handle: () => of({ data: 'fresh' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: (data) => {
          expect(data).toEqual(cachedValue);
          expect(cacheManager.get).toHaveBeenCalledWith('cache-key');
          expect(cacheManager.set).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should cache fresh values', (done) => {
      const context = createMockExecutionContext();
      const freshValue = { data: 'fresh' };

      jest.spyOn(interceptor, 'getCacheKey').mockReturnValue('cache-key');
      cacheManager.get.mockResolvedValue(null);

      const next: CallHandler = {
        handle: () => of(freshValue),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: (data) => {
          expect(data).toEqual(freshValue);
          expect(cacheManager.set).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should respect cache TTL', (done) => {
      const context = createMockExecutionContext();
      const freshValue = { data: 'fresh' };

      jest.spyOn(interceptor, 'getCacheKey').mockReturnValue('cache-key');
      cacheManager.get.mockResolvedValue(null);

      const next: CallHandler = {
        handle: () => of(freshValue),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: () => {
          expect(cacheManager.set).toHaveBeenCalledWith(
            'cache-key',
            freshValue,
            expect.any(Number)
          );
          done();
        },
      });
    });

    it('should skip cache for POST requests', (done) => {
      const request = { method: 'POST' };
      const context = createMockExecutionContext(request);
      const next: CallHandler = {
        handle: () => of({ data: 'test' }),
      };

      const result$ = interceptor.intercept(context, next) as Observable<any>;

      result$.subscribe({
        next: (data) => {
          expect(cacheManager.get).not.toHaveBeenCalled();
          expect(cacheManager.set).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('cache key generation', () => {
    it('should generate cache key from request', () => {
      const request = {
        method: 'GET',
        url: '/test',
        query: { page: '1' },
      };
      const context = createMockExecutionContext(request);

      const cacheKey = interceptor.getCacheKey(context);

      expect(cacheKey).toContain('GET');
      expect(cacheKey).toContain('/test');
    });

    it('should handle cache key with user-specific data', () => {
      const request = {
        method: 'GET',
        url: '/test',
        user: { id: '123' },
      };
      const context = createMockExecutionContext(request);

      const cacheKey = interceptor.getCacheKey(context);

      expect(cacheKey).toContain('123');
    });
  });
});

// Helper function to create mock ExecutionContext
function createMockExecutionContext(request: any = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: request.method || 'GET',
        url: request.url || '/',
        headers: request.headers || {},
        query: request.query || {},
        user: request.user,
        ...request,
      }),
      getResponse: () => ({
        statusCode: 200,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getArgByIndex: () => ({}),
    getArgs: () => [],
    getType: () => 'http',
  } as unknown as ExecutionContext;
}
