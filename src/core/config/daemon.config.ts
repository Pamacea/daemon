/**
 * Daemon configuration
 *
 * Central configuration management for the Daemon toolkit.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DockerConfig } from '../types/index.js';
import type { DaemonConfig as PackageDaemonConfig } from '../types/project.types.js';

import {
  DEFAULT_IMAGE_NAME,
  DEFAULT_CONTAINER_NAME,
  DEFAULT_TEST_DIR,
  DEFAULT_SRC_DIR,
  DEFAULT_TEST_PORT,
} from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get Daemon configuration from package.json
 */
export function getDaemonConfig(projectDir: string = process.cwd()): PackageDaemonConfig {
  const packagePath = join(projectDir, 'package.json');

  if (!existsSync(packagePath)) {
    return {};
  }

  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return pkg.daemon || {};
  } catch {
    return {};
  }
}

/**
 * Get Docker configuration
 */
export function getDockerConfig(projectDir: string = process.cwd()): DockerConfig {
  const daemonConfig = getDaemonConfig(projectDir);
  const containerName = daemonConfig.imageName?.replace('/', '-') || DEFAULT_CONTAINER_NAME;

  return {
    imageName: daemonConfig.imageName || DEFAULT_IMAGE_NAME,
    containerName,
    dockerfilePath: join(projectDir, 'bin', 'Dockerfile'),
  };
}

/**
 * Get test directory
 */
export function getTestDir(projectDir: string = process.cwd()): string {
  const daemonConfig = getDaemonConfig(projectDir);
  return daemonConfig.testDir || DEFAULT_TEST_DIR;
}

/**
 * Get source directory
 */
export function getSrcDir(projectDir: string = process.cwd()): string {
  const daemonConfig = getDaemonConfig(projectDir);

  if (daemonConfig.srcDir) {
    return daemonConfig.srcDir;
  }

  // Auto-detect source directory
  const appDir = join(projectDir, 'app');

  if (existsSync(appDir)) {
    return 'app';
  }

  return 'src';
}

/**
 * Get test port
 */
export function getTestPort(projectDir: string = process.cwd()): number {
  const daemonConfig = getDaemonConfig(projectDir);
  return daemonConfig.port || DEFAULT_TEST_PORT;
}

/**
 * Get project root directory
 */
export function getProjectRoot(startDir: string = process.cwd()): string {
  const currentDir = startDir;

  while (currentDir !== dirname(currentDir)) {
    const pkgPath = join(currentDir, 'package.json');

    if (existsSync(pkgPath)) {
      return currentDir;
    }

    return getProjectRoot(dirname(currentDir));
  }

  return startDir;
}
