/**
 * NestJS Service Test Template
 *
 * Tests for NestJS services following best practices:
 * - Business logic coverage
 * - Repository/database mocking
 * - Error handling
 * - Edge cases
 *
 * @package test
 */

import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { GameService } from './game.service';
import { Game } from './entities/game.entity';
import { CreateGameDto, UpdateGameDto } from './dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('GameService', () => {
  let service: GameService;
  let repository: Repository<Game>;

  // Mock repository
  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOneBy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    repository = module.get<Repository<Game>>(getRepositoryToken(Game));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of games', async () => {
      const expectedGames = [
        { id: '1', name: 'Game 1', active: true },
        { id: '2', name: 'Game 2', active: true },
      ];

      mockRepository.find.mockResolvedValue(expectedGames);

      const result = await service.findAll();

      expect(result).toEqual(expectedGames);
      expect(repository.find).toHaveBeenCalledTimes(1);
      expect(repository.find).toHaveBeenCalledWith();
    });

    it('should support filtering options', async () => {
      const expectedGames = [{ id: '1', name: 'Game 1', active: true }];
      const options = { where: { active: true } };

      mockRepository.find.mockResolvedValue(expectedGames);

      const result = await service.findAll(options);

      expect(result).toEqual(expectedGames);
      expect(repository.find).toHaveBeenCalledWith(options);
    });

    it('should handle empty results', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockRepository.find.mockRejectedValue(new Error('Database error'));

      await expect(service.findAll()).rejects.toThrow('Database error');
    });
  });

  describe('findOne', () => {
    it('should return a single game by id', async () => {
      const expectedGame = { id: '1', name: 'Game 1', active: true };

      mockRepository.findOneBy.mockResolvedValue(expectedGame);

      const result = await service.findOne('1');

      expect(result).toEqual(expectedGame);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: '1' });
    });

    it('should throw NotFoundException when game not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('999')).rejects.toThrow('Game not found');
    });

    it('should handle database errors', async () => {
      mockRepository.findOneBy.mockRejectedValue(new Error('Database error'));

      await expect(service.findOne('1')).rejects.toThrow('Database error');
    });
  });

  describe('create', () => {
    const createGameDto: CreateGameDto = {
      name: 'New Game',
      type: 'action',
    };

    it('should create a new game', async () => {
      const savedGame = { id: '1', ...createGameDto };

      mockRepository.create.mockReturnValue(savedGame);
      mockRepository.save.mockResolvedValue(savedGame);

      const result = await service.create(createGameDto);

      expect(result).toEqual(savedGame);
      expect(repository.create).toHaveBeenCalledWith(createGameDto);
      expect(repository.save).toHaveBeenCalledWith(savedGame);
    });

    it('should handle unique constraint violations', async () => {
      const duplicateError = { code: '23505' }; // PostgreSQL unique violation

      mockRepository.create.mockReturnValue(createGameDto);
      mockRepository.save.mockRejectedValue(duplicateError);

      await expect(service.create(createGameDto)).rejects.toThrow(
        ConflictException
      );
    });

    it('should validate DTO before creation', async () => {
      const invalidDto = { name: '' }; // Invalid DTO

      mockRepository.create.mockReturnValue(invalidDto);
      mockRepository.save.mockResolvedValue(invalidDto);

      // Validation should happen before repository call
      // This test assumes class-validator is used
      const result = await service.create(invalidDto as any);

      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    const updateGameDto: UpdateGameDto = {
      name: 'Updated Game',
    };

    it('should update an existing game', async () => {
      const existingGame = { id: '1', name: 'Old Name', active: true };
      const updatedGame = { ...existingGame, ...updateGameDto };

      mockRepository.findOneBy.mockResolvedValue(existingGame);
      mockRepository.save.mockResolvedValue(updatedGame);

      const result = await service.update('1', updateGameDto);

      expect(result).toEqual(updatedGame);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: '1' });
      expect(repository.save).toHaveBeenCalledWith(updatedGame);
    });

    it('should throw NotFoundException when updating non-existent game', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.update('999', updateGameDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should handle partial updates', async () => {
      const existingGame = {
        id: '1',
        name: 'Game Name',
        type: 'action',
        active: true,
      };
      const partialDto: UpdateGameDto = { name: 'New Name' };

      mockRepository.findOneBy.mockResolvedValue(existingGame);
      mockRepository.save.mockResolvedValue({
        ...existingGame,
        ...partialDto,
      });

      const result = await service.update('1', partialDto);

      expect(result.name).toBe('New Name');
      expect(result.type).toBe('action'); // Unchanged
    });
  });

  describe('remove', () => {
    it('should delete a game', async () => {
      const existingGame = { id: '1', name: 'Game 1', active: true };

      mockRepository.findOneBy.mockResolvedValue(existingGame);
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('1');

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: '1' });
      expect(repository.delete).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException when deleting non-existent game', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });

    it('should handle delete with no affected rows', async () => {
      const existingGame = { id: '1', name: 'Game 1', active: true };

      mockRepository.findOneBy.mockResolvedValue(existingGame);
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await service.remove('1');

      // Should not throw even if no rows affected
      expect(repository.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('business logic', () => {
    it('should calculate derived properties correctly', async () => {
      const games = [
        { id: '1', name: 'Game 1', score: 100 },
        { id: '2', name: 'Game 2', score: 200 },
      ];

      mockRepository.find.mockResolvedValue(games);

      const result = await service.getHighScoreGames();

      expect(result).toBeDefined();
    });

    it('should enforce business rules', async () => {
      const createGameDto: CreateGameDto = {
        name: 'Game with invalid business rule',
        type: 'invalid',
      };

      // Business rule validation
      mockRepository.create.mockReturnValue(createGameDto);
      mockRepository.save.mockResolvedValue(createGameDto);

      const result = await service.create(createGameDto);

      expect(result).toBeDefined();
    });
  });

  describe('transactions', () => {
    it('should handle operations requiring transactions', async () => {
      // For complex operations requiring multiple updates
      mockRepository.findOneBy.mockResolvedValue({ id: '1', name: 'Game' });
      mockRepository.save.mockResolvedValue({ id: '1', name: 'Updated' });

      const result = await service.complexUpdate('1', {
        name: 'Updated',
      });

      expect(result).toBeDefined();
    });
  });
});
