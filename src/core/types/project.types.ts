/**
 * Project types for Daemon
 *
 * Defines the core types for project detection and analysis.
 */

/**
 * Supported frameworks
 */
export type Framework =
  | 'Next.js'
  | 'Remix'
  | 'SvelteKit'
  | 'Nuxt'
  | 'Vite + React'
  | 'Vite + Vue'
  | 'Vite + Svelte'
  | 'Astro'
  | 'Gatsby'
  | 'Angular'
  | 'React'
  | 'Vue'
  | 'Svelte'
  | 'Solid'
  | 'Express'
  | 'Fastify'
  | 'Hono'
  | 'Koa'
  | 'NestJS'
  | 'Django'
  | 'Flask'
  | 'FastAPI'
  | 'Spring Boot'
  | 'Unknown';

/**
 * Supported programming languages
 */
export type Language = 'TypeScript' | 'JavaScript' | 'Python' | 'Go' | 'Java' | 'TypeScript + JavaScript';

/**
 * Supported test runners
 */
export type TestRunner = 'Vitest' | 'Jest' | 'Mocha' | 'Jasmine' | 'Pytest';

/**
 * Database information
 */
export interface DatabaseInfo {
  /** Database type/provider */
  type: string;
  /** Connection string or description */
  connection: string;
  /** Test strategy for database tests */
  testStrategy: string;
}

/**
 * Project context - full detection result
 */
export interface ProjectContext {
  /** Detected framework */
  framework: Framework;
  /** Primary language */
  language: Language;
  /** Test runner */
  testRunner: TestRunner;
  /** Database info if detected */
  database: DatabaseInfo | null;
  /** Number of existing test files */
  existingTests: number;
  /** Coverage percentage if available */
  coverage: string | null;
  /** Key dependencies by category */
  dependencies: string[];
  /** Target URL for testing */
  target: string;
}

/**
 * Package.json representation
 */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  daemon?: DaemonConfig;
}

/**
 * Daemon configuration from package.json
 */
export interface DaemonConfig {
  /** Custom test directory */
  testDir?: string;
  /** Custom source directory */
  srcDir?: string;
  /** Custom port */
  port?: number;
  /** Custom docker image */
  imageName?: string;
}
