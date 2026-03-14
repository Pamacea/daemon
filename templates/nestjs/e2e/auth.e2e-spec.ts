/**
 * NestJS Authentication E2E Test Template
 *
 * End-to-end tests for authentication flows:
 * - Registration
 * - Login
 * - Token refresh
 * - Password reset
 * - Logout
 * - Protected routes
 *
 * @package test
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../../src/app.module';

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let refreshToken: string;
  let userId: string;

  // Test user credentials
  const testUser = {
    email: `e2e-test-${Date.now()}@example.com`,
    password: 'SecurePass123!',
    name: 'E2E Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );

    app.enableShutdownHooks();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Registration Flow', () => {
    describe('POST /auth/register', () => {
      it('should register a new user successfully', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser)
          .expect(201)
          .expect((res) => {
            expect(res.body).toMatchObject({
              id: expect.any(String),
              email: testUser.email,
              name: testUser.name,
            });
            expect(res.body).not.toHaveProperty('password');
            expect(res.body).not.toHaveProperty('hash');
            userId = res.body.id;
          });
      });

      it('should return authentication tokens after registration', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `tokens-${Date.now()}@example.com`,
            password: 'SecurePass123!',
            name: 'Token User',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('refresh_token');
          });
      });

      it('should reject duplicate email registration', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser)
          .expect(409)
          .expect((res) => {
            expect(res.body).toMatchObject({
              statusCode: 409,
              message: expect.stringContaining('email'),
            });
          });
      });

      it('should reject registration with invalid email', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: 'not-an-email',
            password: testUser.password,
            name: testUser.name,
          })
          .expect(400);
      });

      it('should reject registration with weak password', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `weak-${Date.now()}@example.com`,
            password: '123',
            name: 'Weak User',
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining([
                expect.stringContaining('password'),
              ])
            );
          });
      });

      it('should reject registration with missing required fields', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `incomplete-${Date.now()}@example.com`,
          })
          .expect(400);
      });

      it('should reject registration with extra fields', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `extra-${Date.now()}@example.com`,
            password: 'SecurePass123!',
            name: 'Extra User',
            role: 'admin', // Should be stripped or rejected
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.role).not.toBe('admin');
            expect(res.body.role).toBe('user');
          });
      });
    });
  });

  describe('Login Flow', () => {
    describe('POST /auth/login', () => {
      it('should login with valid credentials', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              access_token: expect.any(String),
              refresh_token: expect.any(String),
              user: {
                id: expect.any(String),
                email: testUser.email,
              },
            });
            authToken = res.body.access_token;
            refreshToken = res.body.refresh_token;
          });
      });

      it('should reject login with invalid email', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: testUser.password,
          })
          .expect(401)
          .expect((res) => {
            expect(res.body).toMatchObject({
              statusCode: 401,
              message: expect.stringContaining('credentials'),
            });
          });
      });

      it('should reject login with invalid password', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!',
          })
          .expect(401);
      });

      it('should reject login with missing email', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            password: testUser.password,
          })
          .expect(400);
      });

      it('should reject login with missing password', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testUser.email,
          })
          .expect(400);
      });
    });
  });

  describe('Token Refresh Flow', () => {
    describe('POST /auth/refresh', () => {
      it('should refresh access token with valid refresh token', () => {
        return request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refresh_token: refreshToken })
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              access_token: expect.any(String),
              refresh_token: expect.any(String),
            });
            // New tokens should be different
            expect(res.body.access_token).not.toBe(authToken);
            authToken = res.body.access_token;
          });
      });

      it('should reject refresh with invalid token', () => {
        return request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refresh_token: 'invalid-refresh-token' })
          .expect(401);
      });

      it('should reject refresh with expired token', () => {
        return request(app.getHttpServer())
          .post('/auth/refresh')
          .send({
            refresh_token:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.expired',
          })
          .expect(401);
      });

      it('should reject refresh without token', () => {
        return request(app.getHttpServer())
          .post('/auth/refresh')
          .send({})
          .expect(400);
      });
    });
  });

  describe('Password Reset Flow', () => {
    describe('POST /auth/password-reset/request', () => {
      it('should initiate password reset', () => {
        return request(app.getHttpServer())
          .post('/auth/password-reset/request')
          .send({ email: testUser.email })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('token');
          });
      });

      it('should not reveal if email exists or not', () => {
        return request(app.getHttpServer())
          .post('/auth/password-reset/request')
          .send({ email: 'nonexistent@example.com' })
          .expect(201);
      });

      it('should reject request without email', () => {
        return request(app.getHttpServer())
          .post('/auth/password-reset/request')
          .send({})
          .expect(400);
      });
    });

    describe('POST /auth/password-reset/confirm', () => {
      let resetToken: string;

      beforeAll(() => {
        // Get reset token from previous request
        // In real test, you'd extract this from email or mock
        resetToken = 'valid-reset-token';
      });

      it('should reset password with valid token', () => {
        return request(app.getHttpServer())
          .post('/auth/password-reset/confirm')
          .send({
            token: resetToken,
            newPassword: 'NewSecurePass456!',
          })
          .expect(200);
      });

      it('should reject reset with invalid token', () => {
        return request(app.getHttpServer())
          .post('/auth/password-reset/confirm')
          .send({
            token: 'invalid-token',
            newPassword: 'NewSecurePass456!',
          })
          .expect(401);
      });

      it('should reject reset with weak password', () => {
        return request(app.getHttpServer())
          .post('/auth/password-reset/confirm')
          .send({
            token: resetToken,
            newPassword: 'weak',
          })
          .expect(400);
      });

      it('should reject reset without token', () => {
        return request(app.getHttpServer())
          .post('/auth/password-reset/confirm')
          .send({
            newPassword: 'NewSecurePass456!',
          })
          .expect(400);
      });
    });
  });

  describe('Logout Flow', () => {
    describe('POST /auth/logout', () => {
      it('should logout with valid token', () => {
        return request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(204);
      });

      it('should reject logout without token', () => {
        return request(app.getHttpServer())
          .post('/auth/logout')
          .expect(401);
      });

      it('should invalidate refresh token on logout', () => {
        return request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(204)
          .then(() => {
            // Try to use refresh token after logout
            return request(app.getHttpServer())
              .post('/auth/refresh')
              .send({ refresh_token: refreshToken })
              .expect(401);
          });
      });
    });
  });

  describe('Protected Routes', () => {
    describe('Authentication Guard', () => {
      it('should allow access with valid token', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              id: expect.any(String),
              email: testUser.email,
            });
          });
      });

      it('should reject access without token', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .expect(401);
      });

      it('should reject access with invalid token', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });

      it('should reject access with expired token', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .set(
            'Authorization',
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.expired'
          )
          .expect(401);
      });

      it('should reject access with malformed token', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', 'Bearer not-a-jwt')
          .expect(401);
      });
    });
  });

  describe('Authorization (Role-based)', () => {
    let adminToken: string;

    beforeAll(async () => {
      // Login as admin
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'AdminPass123!',
        });

      adminToken = res.body.access_token;
    });

    describe('Admin Routes', () => {
      it('should allow access for admin users', () => {
        return request(app.getHttpServer())
          .get('/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should deny access for regular users', () => {
        return request(app.getHttpServer())
          .get('/admin/users')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      });
    });

    describe('Resource Ownership', () => {
      let userResourceId: string;

      beforeAll(async () => {
        const res = await request(app.getHttpServer())
          .post('/resources')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'My Resource' });

        userResourceId = res.body.id;
      });

      it('should allow user to update their own resource', () => {
        return request(app.getHttpServer())
          .patch(`/resources/${userResourceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Updated Name' })
          .expect(200);
      });

      it('should prevent user from accessing others resources', () => {
        // Assuming resource IDs are UUIDs
        const otherResourceId = '00000000-0000-0000-0000-000000000001';

        return request(app.getHttpServer())
          .patch(`/resources/${otherResourceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Hacked Name' })
          .expect(403);
      });
    });
  });

  describe('Session Management', () => {
    it('should allow multiple concurrent sessions', async () => {
      const sessions = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: testUser.email, password: testUser.password }),
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: testUser.email, password: testUser.password }),
      ]);

      sessions.forEach((res) => {
        expect(res.body).toHaveProperty('access_token');
      });
    });

    it('should track active sessions', () => {
      return request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should allow revoking specific session', () => {
      return request(app.getHttpServer())
        .delete('/auth/sessions/specific-session-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should allow revoking all sessions', () => {
      return request(app.getHttpServer())
        .delete('/auth/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });
});
