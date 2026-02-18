/**
 * FileSystemHelper - Opérations fichiers sécurisées et async
 *
 * @module shared/utils/file-helper
 */

import * as fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import * as path from 'node:path';
import { createLogger } from './logger.js';
import {
  FileNotFoundError,
  FilePermissionError,
  InvalidJsonError,
  DirectoryCreationError,
  FileWriteError,
  FileReadError,
  FileCopyError,
  FileSearchError,
} from '../errors/file.error.js';

const logger = createLogger('FileSystemHelper');

/**
 * Options pour les opérations fichiers
 */
export interface FileHelperOptions {
  /** Creer les repertoires parents si necessaire */
  ensureDir?: boolean;
  /** Encodage pour les operations texte */
  encoding?: BufferEncoding;
}

/**
 * Resultat de recherche de fichiers
 */
export interface FileSearchResult {
  /** Fichiers trouves */
  files: string[];
  /** Nombre total de fichiers */
  total: number;
  /** Duree de la recherche en ms */
  duration: number;
}

/**
 * Helper pour les operations systeme de fichiers
 *
 * Toutes les operations sont asynchrones et utilisent fs/promises.
 * Les erreurs sont loguees et propagees avec contexte via DaemonError.
 */
export class FileSystemHelper {
  /**
   * Lit un fichier JSON et le parse
   */
  async readJson<T = unknown>(filePath: string): Promise<T> {
    const start = Date.now();
    const resolvedPath = path.resolve(filePath);

    try {
      logger.debug(`Reading JSON file: ${resolvedPath}`);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const parsed = JSON.parse(content) as T;
      logger.debug(`JSON file read in ${Date.now() - start}ms`);
      return parsed;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        logger.error(`File not found: ${resolvedPath}`);
        throw new FileNotFoundError(resolvedPath, { cause: error });
      }

      if (error instanceof SyntaxError) {
        logger.error(`Invalid JSON in file: ${resolvedPath}`, error);
        throw new InvalidJsonError(resolvedPath, error.message, { cause: error });
      }

      if (nodeError.code === 'EPERM' || nodeError.code === 'EACCES') {
        logger.error(`Permission denied reading file: ${resolvedPath}`);
        throw new FilePermissionError(resolvedPath, 'read', { cause: error });
      }

      logger.error(`Failed to read JSON file: ${resolvedPath}`, error);
      throw new FileReadError(resolvedPath, { cause: error });
    }
  }

  /**
   * Ecrit des donnees JSON dans un fichier
   */
  async writeJson<T = unknown>(
    filePath: string,
    data: T,
    options?: FileHelperOptions
  ): Promise<void> {
    const start = Date.now();
    const resolvedPath = path.resolve(filePath);

    try {
      logger.debug(`Writing JSON file: ${resolvedPath}`);
      const dir = path.dirname(resolvedPath);

      if (options?.ensureDir !== false) {
        await this.ensureDir(dir);
      }

      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(resolvedPath, content, 'utf-8');
      logger.debug(`JSON file written in ${Date.now() - start}ms`);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'EPERM' || nodeError.code === 'EACCES') {
        logger.error(`Permission denied writing file: ${resolvedPath}`);
        throw new FilePermissionError(resolvedPath, 'write', { cause: error });
      }

      logger.error(`Failed to write JSON file: ${resolvedPath}`, error);
      throw new FileWriteError(resolvedPath, { cause: error });
    }
  }

  /**
   * Sassure quun repertoire existe (cree recursivement si necessaire)
   */
  async ensureDir(dirPath: string): Promise<void> {
    const resolvedPath = path.resolve(dirPath);

    try {
      await fs.mkdir(resolvedPath, { recursive: true });
      logger.debug(`Directory ensured: ${resolvedPath}`);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'EEXIST') {
        return;
      }

      if (nodeError.code === 'EPERM' || nodeError.code === 'EACCES') {
        logger.error(`Permission denied creating directory: ${resolvedPath}`);
        throw new FilePermissionError(resolvedPath, 'create directory', { cause: error });
      }

      logger.error(`Failed to create directory: ${resolvedPath}`, error);
      throw new DirectoryCreationError(resolvedPath, { cause: error });
    }
  }

  /**
   * Trouve des fichiers correspondant a un pattern
   */
  async findFiles(
    pattern: string,
    cwd: string,
    options?: {
      maxDepth?: number;
      ignoreDirs?: string[];
    }
  ): Promise<FileSearchResult> {
    const start = Date.now();
    const results: string[] = [];
    const maxDepth = options?.maxDepth ?? 10;
    const ignoreDirs = new Set([
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      'coverage',
      ...(options?.ignoreDirs ?? []),
    ]);

    const searchDir = async (dir: string, depth = 0): Promise<void> => {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (ignoreDirs.has(entry.name)) {
              continue;
            }
            await searchDir(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const regex = new RegExp(
              '^' +
                pattern
                  .replace(/\./g, '\\.')
                  .replace(/\*/g, '.*')
                  .replace(/\?/g, '.') +
                '$'
            );
            if (regex.test(entry.name)) {
              results.push(fullPath);
            }
          }
        }
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'EPERM' && nodeError.code !== 'EACCES') {
          throw error;
        }
      }
    };

    try {
      await searchDir(cwd);
      const duration = Date.now() - start;
      logger.debug(`Found ${results.length} files matching '${pattern}' in ${duration}ms`);

      return {
        files: results,
        total: results.length,
        duration,
      };
    } catch (error) {
      logger.error(`Failed to search files: ${cwd}`, error);
      throw new FileSearchError(cwd, pattern, { cause: error });
    }
  }

  /**
   * Verifie si un fichier ou repertoire existe
   */
  async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lit le contenu dun fichier texte
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    const resolvedPath = path.resolve(filePath);

    try {
      return await fs.readFile(resolvedPath, encoding);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        logger.error(`File not found: ${resolvedPath}`);
        throw new FileNotFoundError(resolvedPath, { cause: error });
      }

      if (nodeError.code === 'EPERM' || nodeError.code === 'EACCES') {
        logger.error(`Permission denied reading file: ${resolvedPath}`);
        throw new FilePermissionError(resolvedPath, 'read', { cause: error });
      }

      logger.error(`Failed to read file: ${resolvedPath}`, error);
      throw new FileReadError(resolvedPath, { cause: error });
    }
  }

  /**
   * Ecrit du contenu dans un fichier texte
   */
  async writeFile(
    filePath: string,
    content: string,
    options?: FileHelperOptions
  ): Promise<void> {
    const resolvedPath = path.resolve(filePath);
    const dir = path.dirname(resolvedPath);

    if (options?.ensureDir !== false) {
      await this.ensureDir(dir);
    }

    try {
      await fs.writeFile(resolvedPath, content, options?.encoding ?? 'utf-8');
      logger.debug(`File written: ${resolvedPath}`);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'EPERM' || nodeError.code === 'EACCES') {
        logger.error(`Permission denied writing file: ${resolvedPath}`);
        throw new FilePermissionError(resolvedPath, 'write', { cause: error });
      }

      logger.error(`Failed to write file: ${resolvedPath}`, error);
      throw new FileWriteError(resolvedPath, { cause: error });
    }
  }

  /**
   * Copie un fichier vers une destination
   */
  async copyFile(src: string, dest: string, options?: FileHelperOptions): Promise<void> {
    const resolvedSrc = path.resolve(src);
    const resolvedDest = path.resolve(dest);
    const destDir = path.dirname(resolvedDest);

    if (options?.ensureDir !== false) {
      await this.ensureDir(destDir);
    }

    try {
      const sourceExists = await this.exists(resolvedSrc);
      if (!sourceExists) {
        throw new FileNotFoundError(resolvedSrc);
      }

      await fs.copyFile(resolvedSrc, resolvedDest);
      logger.debug(`File copied: ${resolvedSrc} -> ${resolvedDest}`);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        throw error;
      }

      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'EPERM' || nodeError.code === 'EACCES') {
        logger.error(`Permission denied copying file: ${resolvedSrc} -> ${resolvedDest}`);
        throw new FilePermissionError(resolvedDest, 'copy', { cause: error });
      }

      logger.error(`Failed to copy file: ${resolvedSrc} -> ${resolvedDest}`, error);
      throw new FileCopyError(resolvedSrc, resolvedDest, { cause: error });
    }
  }

  /**
   * Supprime un fichier ou un repertoire
   */
  async remove(targetPath: string): Promise<void> {
    const resolvedPath = path.resolve(targetPath);

    try {
      const stat = await fs.stat(resolvedPath);

      if (stat.isDirectory()) {
        await fs.rm(resolvedPath, { recursive: true, force: true });
      } else {
        await fs.unlink(resolvedPath);
      }
      logger.debug(`Removed: ${resolvedPath}`);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        logger.debug(`Path already removed: ${resolvedPath}`);
        return;
      }

      if (nodeError.code === 'EPERM' || nodeError.code === 'EACCES') {
        logger.error(`Permission denied removing: ${resolvedPath}`);
        throw new FilePermissionError(resolvedPath, 'delete', { cause: error });
      }

      logger.error(`Failed to remove: ${resolvedPath}`, error);
      throw new FileReadError(resolvedPath, { cause: error });
    }
  }

  /**
   * Lit les metadonnees dun fichier
   */
  async stat(filePath: string): Promise<Stats> {
    const resolvedPath = path.resolve(filePath);

    try {
      return await fs.stat(resolvedPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        logger.error(`File not found: ${resolvedPath}`);
        throw new FileNotFoundError(resolvedPath, { cause: error });
      }

      logger.error(`Failed to stat file: ${resolvedPath}`, error);
      throw new FileReadError(resolvedPath, { cause: error });
    }
  }

  /**
   * Liste le contenu dun repertoire
   */
  async readdir(dirPath: string): Promise<string[]> {
    const resolvedPath = path.resolve(dirPath);

    try {
      return await fs.readdir(resolvedPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        logger.error(`Directory not found: ${resolvedPath}`);
        throw new FileNotFoundError(resolvedPath, { cause: error });
      }

      if (nodeError.code === 'EPERM' || nodeError.code === 'EACCES') {
        logger.error(`Permission denied reading directory: ${resolvedPath}`);
        throw new FilePermissionError(resolvedPath, 'read directory', { cause: error });
      }

      logger.error(`Failed to read directory: ${resolvedPath}`, error);
      throw new FileReadError(resolvedPath, { cause: error });
    }
  }
}

/**
 * Instance singleton
 */
export const fileHelper = new FileSystemHelper();
