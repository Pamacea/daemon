/**
 * NestJS Test Module Fixture
 *
 * Reusable test module configuration for unit testing.
 * Provides common providers, mocks, and utilities.
 *
 * @package test
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

// Mock repositories
export const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  query: jest.fn(),
});

// Mock JwtService
export const mockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  verifyAsync: jest.fn(),
  decode: jest.fn(),
});

// Mock ConfigService
export const mockConfigService = () => ({
  get: jest.fn((key: string) => {
    const config: Record<string, any> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '1h',
      DATABASE_URL: 'sqlite::memory:',
    };
    return config[key];
  }),
});

/**
 * Create a test module with common configuration
 */
export async function createTestModule(options: {
  imports?: any[];
  providers?: any[];
  controllers?: any[];
}) {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({
        secret: 'test-secret',
        signOptions: { expiresIn: '1h' },
      }),
      ...(options.imports ?? []),
    ],
    providers: options.providers ?? [],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(JwtService)
    .useValue(mockJwtService())
    .compile();

  return moduleFixture;
}

/**
 * Create a test application with global configuration
 */
export async function createTestApplication(module: TestingModule): Promise<INestApplication> {
  const app = module.createNestApplication();

  // Apply global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Enable shutdown hooks
  app.enableShutdownHooks();

  await app.init();

  return app;
}

/**
 * Mock user for authentication tests
 */
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['user'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Mock admin user for role tests
 */
export const mockAdmin = {
  id: '2',
  email: 'admin@example.com',
  name: 'Admin User',
  roles: ['admin'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Create mock ExecutionContext
 */
export function createMockExecutionContext(request: any = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        url: '/',
        headers: {},
        user: null,
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
  };
}

/**
 * Create mock CallHandler
 */
export function createMockCallHandler(value: any = { data: 'test' }) {
  return {
    handle: () => of(value),
  };
}

/**
 * Helper to create test entity
 */
export function createTestEntity(overrides: Partial<any> = {}) {
  return {
    id: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Wait for async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create test database connection options
 */
export function createTestDatabaseOptions() {
  return {
    type: 'sqlite',
    database: ':memory:',
    dropSchema: true,
    synchronize: true,
    logging: false,
  };
}

/**
 * Setup test database
 */
export async function setupTestDatabase(entities: any[]) {
  const { DataSource } = require('typeorm');

  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities,
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();

  return dataSource;
}

/**
 * Clean test database
 */
export async function cleanTestDatabase(dataSource: any) {
  const entities = dataSource.entityMetadatas;
  const repositoryNames = entities.map((e: any) => e.name);

  // Clear all tables
  for (const name of repositoryNames) {
    const repository = dataSource.getRepository(name);
    await repository.clear();
  }
}

/**
 * Mock file upload for testing
 */
export function createMockFile(overrides: Partial<Express.Multer.File> = {}) {
  return {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('test'),
    destination: '/tmp',
    filename: 'test.jpg',
    path: '/tmp/test.jpg',
    stream: null,
    ...overrides,
  };
}

/**
 * Create test DTO with validation
 */
export function createTestDto<T>(dto: Class<T>, data: Partial<T>): T {
  return Object.assign(Object.create(dto.prototype), data);
}

/**
 * Type for class reference
 */
type Class<T> = new (...args: any[]) => T;

/**
 * Mock pagination options
 */
export function createMockPaginationOptions(overrides: any = {}) {
  return {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC' as const,
    ...overrides,
  };
}

/**
 * Mock filtered query options
 */
export function createMockFilterOptions(overrides: any = {}) {
  return {
    search: '',
    status: null,
    dateFrom: null,
    dateTo: null,
    ...overrides,
  };
}

/**
 * Export all test utilities
 */
export const testUtils = {
  createTestModule,
  createTestApplication,
  createMockExecutionContext,
  createMockCallHandler,
  createTestEntity,
  delay,
  createTestDatabaseOptions,
  setupTestDatabase,
  cleanTestDatabase,
  createMockFile,
  createTestDto,
  createMockPaginationOptions,
  createMockFilterOptions,
  mockRepository,
  mockJwtService,
  mockConfigService,
  mockUser,
  mockAdmin,
};

// Import RxJS 'of' for observable creation
import { of } from 'rxjs';
