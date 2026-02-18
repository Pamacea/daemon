/**
 * Init Command
 *
 * Initializes a project with Daemon testing toolkit.
 *
 * @module cli/commands/init
 */

import * as path from 'node:path';
import { createLogger } from '../../shared/utils/logger.js';
import { fileHelper } from '../../shared/utils/file-helper.js';
import { FrameworkDetector } from '../../services/detection/framework-detector.js';

const logger = createLogger('InitCommand');

export interface InitOptions {
  /** Force overwrite existing files */
  force?: boolean;
  /** Skip framework detection */
  skipDetection?: boolean;
  /** Custom output directory */
  output?: string;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Initialize command for Daemon
 */
export class InitCommand {
  private readonly detector: FrameworkDetector;

  constructor() {
    this.detector = new FrameworkDetector();
  }

  /**
   * Execute the init command
   */
  async execute(args: string[]): Promise<void> {
    logger.info('Initializing Daemon...');

    const options = this.parseArgs(args);

    try {
      // Detect framework
      let framework = 'Unknown';
      if (!options.skipDetection) {
        const result = await this.detector.detect(process.cwd());
        framework = result.value ?? 'Unknown';
        logger.info(`Detected framework: ${framework}`);
      }

      // Create daemon config
      await this.createConfig(options);

      // Create test directories
      await this.createDirectories(options);

      logger.success('Daemon initialized successfully!');
      logger.info('Run "daemon detect" to see project details');
      logger.info('Run "daemon test" to generate tests');
    } catch (error) {
      logger.error('Failed to initialize Daemon', error);
      throw error;
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): InitOptions {
    const options: InitOptions = {
      force: false,
      skipDetection: false,
      verbose: false,
    };

    for (const arg of args) {
      switch (arg) {
        case '--force':
        case '-f':
          options.force = true;
          break;
        case '--skip-detection':
          options.skipDetection = true;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        default:
          if (arg.startsWith('--output=')) {
            const value = arg.split('=')[1];
            if (value) options.output = value;
          }
      }
    }

    return options;
  }

  /**
   * Create Daemon configuration
   */
  private async createConfig(options: InitOptions): Promise<void> {
    const configPath = path.join(process.cwd(), 'daemon.config.json');

    if (await fileHelper.exists(configPath) && !options.force) {
      logger.warn('Daemon config already exists. Use --force to overwrite.');
      return;
    }

    const config = {
      version: '0.6.0',
      testRunner: 'vitest',
      e2eRunner: 'playwright',
      performanceTool: 'k6',
      generatedAt: new Date().toISOString(),
    };

    await fileHelper.writeJson(configPath, config);
    logger.debug(`Created config: ${configPath}`);
  }

  /**
   * Create test directories
   */
  private async createDirectories(options: InitOptions): Promise<void> {
    const baseDir = options.output ?? path.join(process.cwd(), 'tests');

    await fileHelper.ensureDir(baseDir);
    await fileHelper.ensureDir(path.join(baseDir, 'unit'));
    await fileHelper.ensureDir(path.join(baseDir, 'integration'));
    await fileHelper.ensureDir(path.join(baseDir, 'e2e'));

    logger.debug(`Created test directories in: ${baseDir}`);
  }
}
