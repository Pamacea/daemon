/**
 * Init Command
 *
 * Initializes a project with Daemon testing toolkit.
 *
 * @module cli/commands/init
 */

import * as path from 'node:path';
import * as url from 'node:url';
import { createLogger } from '../../shared/utils/logger.js';
import { fileHelper } from '../../shared/utils/file-helper.js';
import { FrameworkDetector } from '../../services/detection/framework-detector.js';

const logger = createLogger('InitCommand');

// Get __dirname equivalent for ES modules
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

      // Copy EXECUTE.md prompt
      await this.createExecutePrompt();

      // Setup Docker
      await this.setupDocker();

      logger.success('Daemon initialized successfully!');
      logger.info('');
      logger.info('Next steps:');
      logger.info('  1. Build Docker container: docker build -t daemon-tools -f Dockerfile.daemon .');
      logger.info('  2. Start container: docker run -d --name daemon-tools -v "$(pwd)":/app daemon-tools');
      logger.info('  3. Run "daemon detect" to see project details');
      logger.info('  4. Check EXECUTE.md for AI testing instructions');
      logger.info('');
      logger.info('For more information, visit: https://github.com/Pamacea/daemon');
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
      version: '0.6.3',
      testRunner: 'vitest',
      e2eRunner: 'playwright',
      performanceTool: 'k6',
      generatedAt: new Date().toISOString(),
    };

    await fileHelper.writeJson(configPath, config);
    logger.debug(`Created config: ${configPath}`);
  }

  /**
   * Copy EXECUTE.md prompt to project
   */
  private async createExecutePrompt(): Promise<void> {
    const executePath = path.join(process.cwd(), 'EXECUTE.md');

    // Get the path to the packaged EXECUTE.md
    // When published, it's in the package root
    const packageRoot = path.resolve(__dirname, '../../../..');
    const sourceExecutePath = path.join(packageRoot, 'prompts', 'EXECUTE.md');

    try {
      // Try to read from the package
      const fs = await import('node:fs');
      if (fs.existsSync(sourceExecutePath)) {
        const content = fs.readFileSync(sourceExecutePath, 'utf-8');
        await fileHelper.writeFile(executePath, content);
        logger.success('Created EXECUTE.md - Testing guide for AI agents');
        logger.info('Use this file with Claude Code or other AI agents for automated testing');
      } else {
        // Fallback: Create a minimal EXECUTE.md
        const minimalContent = `# Daemon - Testing Instructions

This project has been initialized with Daemon testing toolkit.

## Quick Start

1. Start the Docker container:
\`\`\`bash
docker build -t daemon-tools -f Dockerfile.daemon .
docker run -d --name daemon-tools -v \$(pwd):/app -p 3000:3000 daemon-tools
\`\`\`

2. Run tests:
\`\`\`bash
# Unit tests
docker exec daemon-tools npm test

# E2E tests
docker exec daemon-tools npx playwright test

# Performance tests
docker exec daemon-tools k6 run tests/performance/load.js
\`\`\`

## Full Documentation

For complete testing instructions, see:
https://github.com/Pamacea/daemon

Generated by Daemon v${await this.getVersion()}
`;
        await fileHelper.writeFile(executePath, minimalContent);
        logger.success('Created EXECUTE.md');
      }
    } catch (error) {
      logger.warn('Could not create EXECUTE.md:', error);
    }
  }

  /**
   * Setup Docker container
   */
  private async setupDocker(): Promise<void> {
    const dockerfileSourcePath = path.resolve(__dirname, '../../../bin/Dockerfile');
    const dockerfileDestPath = path.join(process.cwd(), 'Dockerfile.daemon');

    try {
      const fs = await import('node:fs');
      if (fs.existsSync(dockerfileSourcePath)) {
        fs.copyFileSync(dockerfileSourcePath, dockerfileDestPath);
        logger.success('Created Dockerfile.daemon - Docker configuration for testing tools');
        logger.info('To build: docker build -t daemon-tools -f Dockerfile.daemon .');
      }
    } catch (error) {
      logger.warn('Could not copy Dockerfile:', error);
    }
  }

  /**
   * Get package version
   */
  private async getVersion(): Promise<string> {
    try {
      const packagePath = path.resolve(__dirname, '../../../package.json');
      const fs = await import('node:fs');
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      return pkg.version || '0.6.3';
    } catch {
      return '0.6.3';
    }
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
