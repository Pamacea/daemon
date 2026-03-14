/**
 * NestJS Guard Test Template
 *
 * Tests for NestJS guards following best practices:
 * - Authentication logic
 * - Authorization checks
 * - Role/permission validation
 * - Context handling
 *
 * @package test
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AuthGuard(reflector);
  });

  describe('canActivate', () => {
    it('should allow access with valid token', () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      jest.spyOn(guard, 'validateToken').mockResolvedValue(true);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(true);
    });

    it('should deny access without token', () => {
      const context = createMockExecutionContext({
        headers: {},
      });

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(false);
    });

    it('should deny access with invalid token', () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      jest.spyOn(guard, 'validateToken').mockResolvedValue(false);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(false);
    });

    it('should handle malformed authorization header', () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'InvalidFormat token',
        },
      });

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(false);
    });

    it('should extract user from request and attach to context', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const mockUser = { id: '1', username: 'test' };
      jest.spyOn(guard, 'getUserFromToken').mockResolvedValue(mockUser);

      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(mockUser);
    });
  });

  describe('public routes', () => {
    it('should allow access to public routes', () => {
      const context = createMockExecutionContext({
        headers: {},
      });

      jest.spyOn(reflector, 'get').mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(true);
      expect(reflector.get).toHaveBeenCalledWith('isPublic', expect.any());
    });

    it('should check for isPublic decorator on handler', () => {
      const context = createMockExecutionContext();

      jest.spyOn(reflector, 'get').mockReturnValue(true);

      guard.canActivate(context);

      expect(reflector.get).toHaveBeenCalledWith(
        'isPublic',
        context.getHandler()
      );
    });
  });
});

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  describe('canActivate', () => {
    it('should allow access when user has required role', () => {
      const context = createMockExecutionContext({
        user: { roles: ['admin'] },
      });

      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(true);
    });

    it('should deny access when user lacks required role', () => {
      const context = createMockExecutionContext({
        user: { roles: ['user'] },
      });

      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(false);
    });

    it('should allow access when no roles are required', () => {
      const context = createMockExecutionContext({
        user: { roles: ['user'] },
      });

      jest.spyOn(reflector, 'get').mockReturnValue(null);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(true);
    });

    it('should allow access when user has multiple roles including required', () => {
      const context = createMockExecutionContext({
        user: { roles: ['user', 'moderator', 'admin'] },
      });

      jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'moderator']);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(true);
    });

    it('should handle user without roles property', () => {
      const context = createMockExecutionContext({
        user: {},
      });

      jest.spyOn(reflector, 'get').mockReturnValue(['user']);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(false);
    });

    it('should handle missing user in request', () => {
      const context = createMockExecutionContext({
        user: null,
      });

      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(false);
    });
  });

  describe('role hierarchy', () => {
    it('should respect role hierarchy', () => {
      const context = createMockExecutionContext({
        user: { roles: ['super-admin'] },
      });

      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      jest.spyOn(guard, 'hasHigherRole').mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).resolves.toBe(true);
    });
  });
});

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: any;

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    };
    guard = new JwtAuthGuard(jwtService);
  });

  describe('canActivate', () => {
    it('should validate JWT token', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      });

      const payload = { sub: '1', username: 'test' };
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid.jwt.token');
    });

    it('should attach user payload to request', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      });

      const payload = { sub: '1', username: 'test' };
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(payload);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer invalid.token',
        },
      });

      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(
        new Error('Invalid token')
      );

      await expect(guard.canActivate(context)).rejects.toThrow();
    });

    it('should handle expired tokens', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer expired.token',
        },
      });

      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(
        new Error('Token expired')
      );

      await expect(guard.canActivate(context)).rejects.toThrow();
    });
  });
});

// Helper function to create mock ExecutionContext
function createMockExecutionContext(requestData: any = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: requestData.headers || {},
        user: requestData.user,
        ...requestData,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getArgByIndex: () => ({}),
    getArgs: () => [],
    getType: () => 'http',
  } as unknown as ExecutionContext;
}
