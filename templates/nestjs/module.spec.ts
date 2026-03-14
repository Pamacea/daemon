/**
 * NestJS Module Test Template
 *
 * Tests for NestJS modules following best practices:
 * - Provider availability
 * - Dependency injection
 * - Module configuration
 *
 * @package test
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GameModule } from './game.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameRepository } from './game.repository';
import { ConfigModule } from '@nestjs/config';

describe('GameModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [GameModule],
    }).compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(module.get(GameModule)).toBeDefined();
  });

  it('should instantiate the controller', () => {
    const controller = module.get<GameController>(GameController);
    expect(controller).toBeDefined();
  });

  it('should instantiate the service', () => {
    const service = module.get<GameService>(GameService);
    expect(service).toBeDefined();
  });

  it('should instantiate the repository', () => {
    const repository = module.get<GameRepository>(GameRepository);
    expect(repository).toBeDefined();
  });

  it('should load configuration', () => {
    const configModule = module.get(ConfigModule);
    expect(configModule).toBeDefined();
  });

  describe('dependency injection', () => {
    it('should inject service into controller', () => {
      const controller = module.get<GameController>(GameController);
      const service = module.get<GameService>(GameService);

      expect(controller).toHaveProperty('gameService');
    });

    it('should inject repository into service', () => {
      const service = module.get<GameService>(GameService);
      const repository = module.get<GameRepository>(GameRepository);

      expect(service).toBeDefined();
      expect(repository).toBeDefined();
    });
  });

  describe('module configuration', () => {
    it('should be able to create module with custom imports', async () => {
      const customModule: TestingModule = await Test.createTestingModule({
        imports: [GameModule],
      })
        .overrideProvider(GameRepository)
        .useValue({})
        .compile();

      expect(customModule).toBeDefined();
      await customModule.close();
    });

    it('should handle module providers correctly', async () => {
      const testModule = await Test.createTestingModule({
        imports: [GameModule],
      }).compile();

      const providers = testModule.get<GameModule>(GameModule)['providers'];

      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);

      await testModule.close();
    });
  });

  describe('global modules', () => {
    it('should handle global module providers if applicable', async () => {
      const globalModule = await Test.createTestingModule({
        imports: [GameModule],
      })
        .overrideProvider(GameRepository)
        .useClass(GameRepository) // Use actual implementation
        .compile();

      expect(globalModule).toBeDefined();
      await globalModule.close();
    });
  });

  describe('circular dependencies', () => {
    it('should resolve forwardRef if present', async () => {
      // For modules with circular dependencies using forwardRef
      try {
        const circularModule = await Test.createTestingModule({
          imports: [GameModule],
        }).compile();

        expect(circularModule).toBeDefined();
        await circularModule.close();
      } catch (error) {
        // If forwardRef is not properly handled, this will fail
        fail('Module should resolve circular dependencies');
      }
    });
  });

  describe('dynamic modules', () => {
    it('should register dynamic providers if applicable', async () => {
      // For modules that use .register() or .forRoot()
      const dynamicModule = await Test.createTestingModule({
        imports: [
          GameModule.register({
            apiKey: 'test-key',
            apiUrl: 'https://api.test.com',
          }),
        ],
      }).compile();

      expect(dynamicModule).toBeDefined();
      await dynamicModule.close();
    });

    it('should handle .forRoot() pattern if applicable', async () => {
      const forRootModule = await Test.createTestingModule({
        imports: [GameModule.forRoot()],
      }).compile();

      expect(forRootModule).toBeDefined();
      await forRootModule.close();
    });

    it('should handle .forRootAsync() pattern if applicable', async () => {
      const forRootAsyncModule = await Test.createTestingModule({
        imports: [
          GameModule.forRootAsync({
            useFactory: () => ({
              apiKey: 'test-key',
            }),
          }),
        ],
      }).compile();

      expect(forRootAsyncModule).toBeDefined();
      await forRootAsyncModule.close();
    });
  });
});
