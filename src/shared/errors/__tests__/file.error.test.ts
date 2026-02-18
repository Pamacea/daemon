/**
 * Tests for File system errors
 */

import { describe, it, expect } from 'vitest';
import {
  FileSystemError,
  FileNotFoundError,
  FilePermissionError,
  InvalidJsonError,
  DirectoryCreationError,
  FileWriteError,
  FileReadError,
  FileCopyError,
  FileSearchError,
} from '../file.error.js';

describe('FileSystemError', () => {
  it('should create base file system error', () => {
    const error = new FileSystemError('File system error', 'FILE_000');

    expect(error.message).toBe('File system error');
    expect(error.code).toBe('FILE_000');
  });
});

describe('FileNotFoundError', () => {
  it('should create error for missing file', () => {
    const error = new FileNotFoundError('/path/to/file.txt');

    expect(error.message).toContain('/path/to/file.txt');
    expect(error.code).toBe('FILE_001');
    expect(error.context.filePath).toBe('/path/to/file.txt');
  });
});

describe('FilePermissionError', () => {
  it('should create error for permission denied', () => {
    const error = new FilePermissionError('/protected/file.txt', 'write');

    expect(error.message).toContain('write');
    expect(error.message).toContain('/protected/file.txt');
    expect(error.code).toBe('FILE_002');
    expect(error.context.operation).toBe('write');
  });
});

describe('InvalidJsonError', () => {
  it('should create error for JSON parse failure', () => {
    const error = new InvalidJsonError('/config.json', 'Unexpected token');

    expect(error.message).toContain('/config.json');
    expect(error.message).toContain('Unexpected token');
    expect(error.code).toBe('FILE_003');
  });
});

describe('DirectoryCreationError', () => {
  it('should create error for directory creation failure', () => {
    const error = new DirectoryCreationError('/new/dir');

    expect(error.message).toContain('/new/dir');
    expect(error.code).toBe('FILE_004');
  });
});

describe('FileWriteError', () => {
  it('should create error for write failure', () => {
    const error = new FileWriteError('/output.txt');

    expect(error.message).toContain('/output.txt');
    expect(error.code).toBe('FILE_005');
  });
});

describe('FileReadError', () => {
  it('should create error for read failure', () => {
    const error = new FileReadError('/input.txt');

    expect(error.message).toContain('/input.txt');
    expect(error.code).toBe('FILE_006');
  });
});

describe('FileCopyError', () => {
  it('should create error for copy failure', () => {
    const error = new FileCopyError('/source.txt', '/dest.txt');

    expect(error.message).toContain('/source.txt');
    expect(error.message).toContain('/dest.txt');
    expect(error.code).toBe('FILE_007');
  });
});

describe('FileSearchError', () => {
  it('should create error for search failure', () => {
    const error = new FileSearchError('/project', '*.ts');

    expect(error.message).toContain('*.ts');
    expect(error.message).toContain('/project');
    expect(error.code).toBe('FILE_008');
  });
});
