/**
 * NestJS E2E API Test Template
 *
 * End-to-end tests for NestJS API endpoints:
 * - Full HTTP request/response cycle
 * - Authentication flows
 * - Database integration
 * - API contract validation
 *
 * @package test
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('API E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );

    // Enable shutdown hooks
    app.enableShutdownHooks();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication (e2e)', () => {
    describe('POST /auth/register', () => {
      it('should register a new user', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `test-${Date.now()}@example.com`,
            password: 'SecurePass123!',
            name: 'Test User',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('email');
            expect(res.body).not.toHaveProperty('password');
          });
      });

      it('should reject duplicate email', () => {
        const email = `duplicate-${Date.now()}@example.com`;

        return request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email,
            password: 'SecurePass123!',
            name: 'Test User',
          })
          .expect(201)
          .then(() => {
            return request(app.getHttpServer())
              .post('/auth/register')
              .send({
                email,
                password: 'SecurePass123!',
                name: 'Test User',
              })
              .expect(409);
          });
      });

      it('should reject invalid email format', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: 'invalid-email',
            password: 'SecurePass123!',
            name: 'Test User',
          })
          .expect(400);
      });

      it('should reject weak password', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `test-${Date.now()}@example.com`,
            password: 'weak',
            name: 'Test User',
          })
          .expect(400);
      });
    });

    describe('POST /auth/login', () => {
      it('should login with valid credentials', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'SecurePass123!',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('refresh_token');
            authToken = res.body.access_token;
          });
      });

      it('should reject invalid credentials', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword123!',
          })
          .expect(401);
      });

      it('should reject non-existent user', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: `nonexistent-${Date.now()}@example.com`,
            password: 'SecurePass123!',
          })
          .expect(401);
      });
    });

    describe('POST /auth/refresh', () => {
      it('should refresh access token', () => {
        return request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refresh_token: 'valid-refresh-token' })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('access_token');
          });
      });

      it('should reject invalid refresh token', () => {
        return request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refresh_token: 'invalid-token' })
          .expect(401);
      });
    });
  });

  describe('Resources (e2e)', () => {
    let resourceId: string;

    describe('GET /resources', () => {
      it('should return array of resources', () => {
        return request(app.getHttpServer())
          .get('/resources')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveProperty('data');
          });
      });

      it('should support pagination', () => {
        return request(app.getHttpServer())
          .get('/resources?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('meta');
            expect(res.body.meta).toHaveProperty('page');
            expect(res.body.meta).toHaveProperty('limit');
          });
      });

      it('should support filtering', () => {
        return request(app.getHttpServer())
          .get('/resources?status=active')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.data.every((item: any) => item.status === 'active')).toBe(true);
          });
      });

      it('should support sorting', () => {
        return request(app.getHttpServer())
          .get('/resources?sort=name&order=asc')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            const names = res.body.data.map((item: any) => item.name);
            const sortedNames = [...names].sort();
            expect(names).toEqual(sortedNames);
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .get('/resources')
          .expect(401);
      });
    });

    describe('POST /resources', () => {
      it('should create a new resource', () => {
        const newResource = {
          name: 'Test Resource',
          description: 'Test Description',
          status: 'active',
        };

        return request(app.getHttpServer())
          .post('/resources')
          .set('Authorization', `Bearer ${authToken}`)
          .send(newResource)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe(newResource.name);
            resourceId = res.body.id;
          });
      });

      it('should reject invalid data', () => {
        return request(app.getHttpServer())
          .post('/resources')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: '', // Invalid: empty name
            status: 'invalid-status',
          })
          .expect(400);
      });

      it('should strip non-whitelisted properties', () => {
        return request(app.getHttpServer())
          .post('/resources')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Resource',
            maliciousProperty: 'should be stripped',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).not.toHaveProperty('maliciousProperty');
          });
      });
    });

    describe('GET /resources/:id', () => {
      it('should return a single resource', () => {
        return request(app.getHttpServer())
          .get(`/resources/${resourceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.id).toBe(resourceId);
          });
      });

      it('should return 404 for non-existent resource', () => {
        return request(app.getHttpServer())
          .get('/resources/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });

      it('should validate UUID format', () => {
        return request(app.getHttpServer())
          .get('/resources/invalid-uuid-format')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);
      });
    });

    describe('PATCH /resources/:id', () => {
      it('should update a resource', () => {
        const updates = {
          name: 'Updated Resource Name',
        };

        return request(app.getHttpServer())
          .patch(`/resources/${resourceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updates)
          .expect(200)
          .expect((res) => {
            expect(res.body.name).toBe(updates.name);
          });
      });

      it('should return 404 for non-existent resource', () => {
        return request(app.getHttpServer())
          .patch('/resources/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Updated' })
          .expect(404);
      });

      it('should reject invalid updates', () => {
        return request(app.getHttpServer())
          .patch(`/resources/${resourceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'invalid-status-value',
          })
          .expect(400);
      });
    });

    describe('DELETE /resources/:id', () => {
      it('should delete a resource', () => {
        return request(app.getHttpServer())
          .delete(`/resources/${resourceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(204);
      });

      it('should return 404 for already deleted resource', () => {
        return request(app.getHttpServer())
          .delete(`/resources/${resourceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('Error Handling (e2e)', () => {
    it('should return consistent error format', () => {
      return request(app.getHttpServer())
        .get('/resources/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('error');
        });
    });

    it('should handle validation errors consistently', () => {
      return request(app.getHttpServer())
        .post('/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(Array.isArray(res.body.message)).toBe(true);
        });
    });

    it('should include request ID in error responses', () => {
      return request(app.getHttpServer())
        .get('/resources/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Request-ID', 'test-request-id')
        .expect(404)
        .expect((res) => {
          expect(res.headers['x-request-id']).toBeDefined();
        });
    });
  });

  describe('Performance (e2e)', () => {
    it('should respond to simple GET within 200ms', async () => {
      const start = Date.now();

      await request(app.getHttpServer())
        .get('/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/resources')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });
    });
  });

  describe('CORS (e2e)', () => {
    it('should include CORS headers', () => {
      return request(app.getHttpServer())
        .options('/resources')
        .set('Origin', 'https://example.com')
        .expect(204)
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBeDefined();
        });
    });
  });

  describe('Rate Limiting (e2e)', () => {
    it('should allow requests within rate limit', () => {
      return request(app.getHttpServer())
        .get('/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should block requests exceeding rate limit', async () => {
      const requests = Array.from({ length: 105 }, () =>
        request(app.getHttpServer())
          .get('/resources')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.allSettled(requests);

      const rateLimited = responses.some(
        (r) => r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimited).toBe(true);
    });
  });
});
