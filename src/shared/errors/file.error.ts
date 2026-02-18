/**
 * FileSystemError - Errors related to file system operations.
 *
 * Provides specific error types for common file operations:
 * - File not found
 * - Permission denied
 * - Invalid JSON
 * - Directory creation failures
 * - File operation failures
 */

import { DaemonError, type DaemonErrorOptions } from './base.error.js';

/**
 * Base class for all file system related errors
 */
export class FileSystemError extends DaemonError {
  constructor(message: string, code: string, options?: DaemonErrorOptions) {
    super(message, code, options);
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * Thrown when a file or directory is not found
 */
export class FileNotFoundError extends FileSystemError {
  constructor(filePath: string, options?: DaemonErrorOptions) {
    super(
      `File or directory not found: ${filePath}`,
      'FILE_001',
      { ...options, context: { ...options?.context, filePath } }
    );
    Object.setPrototypeOf(this, FileNotFoundError.prototype);
  }
}

/**
 * Thrown when lacking permission to access a file/directory
 */
export class FilePermissionError extends FileSystemError {
  constructor(filePath: string, operation: string, options?: DaemonErrorOptions) {
    super(
      `Permission denied for '${operation}' on: ${filePath}`,
      'FILE_002',
      { ...options, context: { ...options?.context, filePath, operation } }
    );
    Object.setPrototypeOf(this, FilePermissionError.prototype);
  }
}

/**
 * Thrown when JSON parsing fails
 */
export class InvalidJsonError extends FileSystemError {
  constructor(filePath: string, parseError: string, options?: DaemonErrorOptions) {
    super(
      `Invalid JSON in file ${filePath}: ${parseError}`,
      'FILE_003',
      { ...options, context: { ...options?.context, filePath, parseError } }
    );
    Object.setPrototypeOf(this, InvalidJsonError.prototype);
  }
}

/**
 * Thrown when directory creation fails
 */
export class DirectoryCreationError extends FileSystemError {
  constructor(dirPath: string, options?: DaemonErrorOptions) {
    super(
      `Failed to create directory: ${dirPath}`,
      'FILE_004',
      { ...options, context: { ...options?.context, dirPath } }
    );
    Object.setPrototypeOf(this, DirectoryCreationError.prototype);
  }
}

/**
 * Thrown when file write operation fails
 */
export class FileWriteError extends FileSystemError {
  constructor(filePath: string, options?: DaemonErrorOptions) {
    super(
      `Failed to write to file: ${filePath}`,
      'FILE_005',
      { ...options, context: { ...options?.context, filePath } }
    );
    Object.setPrototypeOf(this, FileWriteError.prototype);
  }
}

/**
 * Thrown when file read operation fails
 */
export class FileReadError extends FileSystemError {
  constructor(filePath: string, options?: DaemonErrorOptions) {
    super(
      `Failed to read file: ${filePath}`,
      'FILE_006',
      { ...options, context: { ...options?.context, filePath } }
    );
    Object.setPrototypeOf(this, FileReadError.prototype);
  }
}

/**
 * Thrown when file copy operation fails
 */
export class FileCopyError extends FileSystemError {
  constructor(sourcePath: string, destPath: string, options?: DaemonErrorOptions) {
    super(
      `Failed to copy file from ${sourcePath} to ${destPath}`,
      'FILE_007',
      { ...options, context: { ...options?.context, sourcePath, destPath } }
    );
    Object.setPrototypeOf(this, FileCopyError.prototype);
  }
}

/**
 * Thrown when file search operation fails
 */
export class FileSearchError extends FileSystemError {
  constructor(dirPath: string, pattern: string, options?: DaemonErrorOptions) {
    super(
      `Failed to search for files matching '${pattern}' in: ${dirPath}`,
      'FILE_008',
      { ...options, context: { ...options?.context, dirPath, pattern } }
    );
    Object.setPrototypeOf(this, FileSearchError.prototype);
  }
}

