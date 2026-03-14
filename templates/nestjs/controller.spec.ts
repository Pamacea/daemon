/**
 * NestJS Controller Test Template
 *
 * Tests for NestJS controllers following best practices:
 * - Isolated unit tests (no actual HTTP)
 * - Mocked services and providers
 * - Proper DTO validation
 * - Error handling coverage
 *
 * @package test
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { CreateGameDto, UpdateGameDto } from './dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('GameController', () => {
  let controller: GameController;
  let service: GameService;

  // Mock service
  const mockGameService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        {
          provide: GameService,
          useValue: mockGameService,
        },
      ],
    }).compile();

    controller = module.get<GameController>(GameController);
    service = module.get<GameService>(GameService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of games', async () => {
      const expectedGames = [
        { id: '1', name: 'Game 1' },
        { id: '2', name: 'Game 2' },
      ];

      mockGameService.findAll.mockResolvedValue(expectedGames);

      const result = await controller.findAll();

      expect(result).toEqual(expectedGames);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('should handle empty results', async () => {
      mockGameService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a single game by id', async () => {
      const expectedGame = { id: '1', name: 'Game 1' };

      mockGameService.findOne.mockResolvedValue(expectedGame);

      const result = await controller.findOne('1');

      expect(result).toEqual(expectedGame);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException when game not found', async () => {
      mockGameService.findOne.mockRejectedValue(
        new NotFoundException('Game not found')
      );

      await expect(controller.findOne('999')).rejects.toThrow(
        NotFoundException
      );
      expect(service.findOne).toHaveBeenCalledWith('999');
    });
  });

  describe('create', () => {
    it('should create a new game', async () => {
      const createGameDto: CreateGameDto = {
        name: 'New Game',
        type: 'action',
      };

      const createdGame = { id: '1', ...createGameDto };

      mockGameService.create.mockResolvedValue(createdGame);

      const result = await controller.create(createGameDto);

      expect(result).toEqual(createdGame);
      expect(service.create).toHaveBeenCalledWith(createGameDto);
    });

    it('should throw BadRequestException for invalid DTO', async () => {
      const invalidDto = { name: '' };

      mockGameService.create.mockRejectedValue(
        new BadRequestException('Invalid data')
      );

      await expect(controller.create(invalidDto as any)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('update', () => {
    it('should update an existing game', async () => {
      const updateGameDto: UpdateGameDto = {
        name: 'Updated Game',
      };

      const updatedGame = { id: '1', ...updateGameDto };

      mockGameService.update.mockResolvedValue(updatedGame);

      const result = await controller.update('1', updateGameDto);

      expect(result).toEqual(updatedGame);
      expect(service.update).toHaveBeenCalledWith('1', updateGameDto);
    });

    it('should throw NotFoundException when updating non-existent game', async () => {
      const updateGameDto: UpdateGameDto = { name: 'Updated' };

      mockGameService.update.mockRejectedValue(
        new NotFoundException('Game not found')
      );

      await expect(controller.update('999', updateGameDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('should delete a game', async () => {
      mockGameService.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException when deleting non-existent game', async () => {
      mockGameService.remove.mockRejectedValue(
        new NotFoundException('Game not found')
      );

      await expect(controller.remove('999')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('query parameters', () => {
    it('should handle query parameters correctly', async () => {
      const expectedGames = [{ id: '1', name: 'Filtered Game' }];

      mockGameService.findAll.mockResolvedValue(expectedGames);

      const result = await controller.findAll({
        page: '1',
        limit: '10',
        search: 'test',
      } as any);

      expect(result).toEqual(expectedGames);
      expect(service.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'test',
      });
    });
  });
});
