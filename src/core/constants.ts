/**
 * Daemon constants
 *
 * Central constants used across the application.
 */

/** Default Docker image name */
export const DEFAULT_IMAGE_NAME = 'daemon-tools';

/** Default container name */
export const DEFAULT_CONTAINER_NAME = 'daemon-tools';

/** Default Dockerfile path */
export const DEFAULT_DOCKERFILE_PATH = '/bin/Dockerfile';

/** Default test directory */
export const DEFAULT_TEST_DIR = 'tests';

/** Default source directory */
export const DEFAULT_SRC_DIR = 'src';

/** Default port for testing */
export const DEFAULT_TEST_PORT = 3000;

/** Default command timeout in milliseconds */
export const DEFAULT_COMMAND_TIMEOUT = 60000;

/** Default Docker build timeout in milliseconds */
export const DEFAULT_DOCKER_BUILD_TIMEOUT = 600000;

/** Default log level */
export const DEFAULT_LOG_LEVEL = 'info';

/** Supported test file patterns */
export const TEST_FILE_PATTERNS = [
  '.test.ts',
  '.test.tsx',
  '.test.js',
  '.test.jsx',
  '.spec.ts',
  '.spec.tsx',
  '.spec.js',
  '.spec.jsx',
] as const;

/** Directories to skip during traversal */
export const SKIP_DIRECTORIES = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  'coverage',
  '.nyc_output',
  '.cache',
  'tmp',
  'temp',
] as const;

/** Environment variable names */
export const ENV_VARS = {
  DAEMON_PORT: 'DAEMON_PORT',
  DAEMON_IMAGE: 'DAEMON_IMAGE',
  DAEMON_CONTAINER: 'DAEMON_CONTAINER',
  DAEMON_LOG_LEVEL: 'DAEMON_LOG_LEVEL',
  DAEMON_SILENT: 'DAEMON_SILENT',
} as const;
