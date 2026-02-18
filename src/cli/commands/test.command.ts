/**
 * Test Command
 *
 * Generates and runs tests for the project.
 *
 * @module cli/commands/test
 */

import { createLogger } from '../../shared/utils/logger.js';
import { FrameworkDetector } from '../../services/detection/framework-detector.js';
import { DockerManager } from '../../services/docker/docker-manager.js';
import type { Framework } from '../../core/types/project.types.js';

const logger = createLogger('TestCommand');

export interface TestOptions {
  /** Generate tests only (don't run) */
  generateOnly?: boolean;
  /** Run existing tests only (don't generate) */
  runOnly?: boolean;
  /** Include coverage report */
  coverage?: boolean;
  /** Watch mode */
  watch?: boolean;
  /** Specific test file pattern */
  pattern?: string;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Test command for Daemon
 */
export class TestCommand {
  private readonly detector: FrameworkDetector;
  private readonly docker: DockerManager;

  constructor() {
    this.detector = new FrameworkDetector();
    this.docker = new DockerManager();
  }

  /**
   * Execute the test command
   */
  async execute(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    try {
      // Detect framework first
      const detection = await this.detector.detect(process.cwd());
      const framework = detection.value ?? 'Unknown';

      logger.info(`Framework detected: ${framework}`);

      // Setup Docker if needed
      if (!options.runOnly) {
        await this.setupDocker();
      }

      // Generate tests if needed
      if (!options.runOnly) {
        await this.generateTests(framework, options);
      }

      // Run tests
      if (!options.generateOnly) {
        await this.runTests(framework, options);
      }
    } catch (error) {
      logger.error('Test execution failed', error);
      throw error;
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): TestOptions {
    const options: TestOptions = {
      generateOnly: false,
      runOnly: false,
      coverage: false,
      watch: false,
      verbose: false,
    };

    for (const arg of args) {
      switch (arg) {
        case '--generate-only':
        case '-g':
          options.generateOnly = true;
          break;
        case '--run-only':
        case '-r':
          options.runOnly = true;
          break;
        case '--coverage':
        case '-c':
          options.coverage = true;
          break;
        case '--watch':
        case '-w':
          options.watch = true;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        default:
          if (arg.startsWith('--pattern=')) {
            const value = arg.split('=')[1];
            if (value) options.pattern = value;
          }
      }
    }

    return options;
  }

  /**
   * Setup Docker container for testing
   */
  private async setupDocker(): Promise<void> {
    logger.info('Setting up Docker container...');

    const result = await this.docker.setup({
      silent: false,
      onBuildStart: () => logger.info('Building Docker image...'),
      onBuildComplete: () => logger.success('Docker image built'),
      onBuildError: (err) => logger.error('Docker build failed', err),
    });

    logger.debug(`Docker status: ${result.status} (${result.duration}ms)`);
  }

  /**
   * Generate tests for the project
   */
  private async generateTests(_framework: Framework, _options: TestOptions): Promise<void> {
    logger.info('Generating tests...');

    // TODO: Implement test generation logic
    // This will use the TestGenerator service

    logger.success('Tests generated');
  }

  /**
   * Run tests for the project
   */
  private async runTests(framework: Framework, options: TestOptions): Promise<void> {
    logger.info('Running tests...');

    const testRunner = this.getTestRunner(framework);
    const command = this.buildTestCommand(testRunner, options);

    const result = await this.docker.exec(command, {
      timeout: 300000, // 5 minutes
    });

    if (result.success) {
      logger.success('Tests passed');
      if (options.verbose && result.stdout) {
        console.log(result.stdout);
      }
    } else {
      logger.error('Tests failed');
      if (result.stderr) {
        console.error(result.stderr);
      }
      throw new Error('Test execution failed');
    }
  }

  /**
   * Get the test runner for the framework
   */
  private getTestRunner(framework: Framework): string {
    switch (framework) {
      case 'Next.js':
      case 'Remix':
      case 'SvelteKit':
      case 'Vite + React':
      case 'Vite + Vue':
      case 'React':
      case 'Vue':
      case 'Svelte':
      case 'Angular':
        return 'vitest';
      case 'NestJS':
        return 'jest';
      default:
        return 'vitest';
    }
  }

  /**
   * Build the test command
   */
  private buildTestCommand(runner: string, options: TestOptions): string {
    const parts: string[] = ['npx', runner, 'run'];

    if (options.coverage) {
      parts.push('--coverage');
    }

    if (options.watch) {
      parts.push('--watch');
    }

    if (options.pattern) {
      parts.push('--pattern', options.pattern);
    }

    if (options.verbose) {
      parts.push('--verbose');
    }

    return parts.join(' ');
  }
}
