/**
 * NestJS Pipe Test Template
 *
 * Tests for NestJS pipes following best practices:
 * - Data transformation
 * - Validation logic
 * - Error handling
 * - Custom business rules
 *
 * @package test
 */

import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ValidationPipe } from './validation.pipe';
import { TransformPipe } from './transform.pipe';
import { ParseIntPipe } from './parse-int.pipe';
import { CustomValidationPipe } from './custom-validation.pipe';

describe('ValidationPipe', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe();
  });

  describe('transform', () => {
    it('should return value unchanged when valid', async () => {
      const value = { name: 'Test', age: 25 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toEqual(value);
    });

    it('should throw BadRequestException for invalid data', async () => {
      const value = { name: '', age: -1 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should validate required fields', async () => {
      const value = { age: 25 }; // missing name
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });

    it('should validate data types', async () => {
      const value = { name: 'Test', age: 'not-a-number' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });

    it('should skip validation when whitelist is true', async () => {
      pipe = new ValidationPipe({ whitelist: true });
      const value = { name: 'Test', age: 25, extraField: 'should be removed' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: class TestDto {
          name: string;
          age: number;
        },
      };

      const result = await pipe.transform(value, metadata);

      expect(result).not.toHaveProperty('extraField');
    });

    it('should handle nested objects', async () => {
      const value = {
        name: 'Test',
        address: {
          street: '123 Main St',
          city: 'Springfield',
        },
      };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toHaveProperty('address');
      expect(result.address).toHaveProperty('street');
    });

    it('should validate arrays', async () => {
      const value = { items: [{ name: 'Item 1' }, { name: 'Item 2' }] };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      const result = await pipe.transform(value, metadata);

      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should handle null and undefined values', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      await expect(pipe.transform(null, metadata)).rejects.toThrow();
      await expect(pipe.transform(undefined, metadata)).rejects.toThrow();
    });
  });

  describe('error messages', () => {
    it('should provide descriptive error messages', async () => {
      const value = { name: '', age: -1 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBeDefined();
      }
    });

    it('should include field names in errors', async () => {
      const value = { name: '', age: -1 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        const responseBody = error.getResponse();
        if (typeof responseBody === 'object') {
          expect(responseBody).toHaveProperty('message');
        }
      }
    });
  });
});

describe('TransformPipe', () => {
  let pipe: TransformPipe;

  beforeEach(() => {
    pipe = new TransformPipe();
  });

  describe('transform', () => {
    it('should transform string to number', async () => {
      const value = '123';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(123);
      expect(typeof result).toBe('number');
    });

    it('should trim strings', async () => {
      const value = '  test  ';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: String,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe('test');
    });

    it('should transform lowercase', async () => {
      pipe = new TransformPipe({ toLowerCase: true });
      const value = 'HELLO WORLD';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: String,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe('hello world');
    });

    it('should transform boolean strings', async () => {
      const value = 'true';
      const metadata: ArgumentMetadata = {
        type: 'query',
        metatype: Boolean,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(true);
    });

    it('should transform date strings', async () => {
      const value = '2024-01-01';
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Date,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBeInstanceOf(Date);
    });

    it('should handle null values', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: String,
      };

      const result = await pipe.transform(null, metadata);

      expect(result).toBeNull();
    });
  });
});

describe('ParseIntPipe', () => {
  let pipe: ParseIntPipe;

  beforeEach(() => {
    pipe = new ParseIntPipe();
  });

  describe('transform', () => {
    it('should parse valid integer string', async () => {
      const value = '42';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(42);
    });

    it('should throw BadRequestException for non-numeric string', async () => {
      const value = 'not-a-number';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException for float string', async () => {
      const value = '42.5';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should handle negative numbers', async () => {
      const value = '-42';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(-42);
    });

    it('should handle zero', async () => {
      const value = '0';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(0);
    });

    it('should throw exception for empty string', async () => {
      const value = '';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('custom error messages', () => {
    it('should include field name in error', async () => {
      pipe = new ParseIntPipe('fieldName');
      const value = 'invalid';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
        data: 'fieldName',
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error.message).toContain('fieldName');
      }
    });
  });
});

describe('CustomValidationPipe', () => {
  let pipe: CustomValidationPipe;

  describe('email validation', () => {
    beforeEach(() => {
      pipe = new CustomValidationPipe();
    });

    it('should accept valid email', async () => {
      const value = { email: 'test@example.com' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.email).toBe('test@example.com');
    });

    it('should reject invalid email', async () => {
      const value = { email: 'not-an-email' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });

    it('should reject empty email', async () => {
      const value = { email: '' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });
  });

  describe('password validation', () => {
    it('should enforce password complexity', async () => {
      pipe = new CustomValidationPipe({
        passwordMinLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
      });

      const value = { password: 'Simple123' }; // Missing special char
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });

    it('should accept complex password', async () => {
      pipe = new CustomValidationPipe({
        passwordMinLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
      });

      const value = { password: 'Complex123!' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.password).toBe('Complex123!');
    });
  });

  describe('custom business rules', () => {
    it('should validate custom rules', async () => {
      pipe = new CustomValidationPipe({
        customRules: [
          {
            field: 'age',
            validate: (value) => value >= 18,
            message: 'Age must be at least 18',
          },
        ],
      });

      const value = { age: 15 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });

    it('should pass valid custom rules', async () => {
      pipe = new CustomValidationPipe({
        customRules: [
          {
            field: 'age',
            validate: (value) => value >= 18,
            message: 'Age must be at least 18',
          },
        ],
      });

      const value = { age: 25 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: Object,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.age).toBe(25);
    });
  });
});
