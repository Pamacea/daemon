/**
 * Init Command
 *
 * Initializes a project with Daemon testing toolkit.
 *
 * @module cli/commands/init
 */

import * as path from 'node:path';
import * as url from 'node:url';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createLogger } from '../../shared/utils/logger.js';
import { FrameworkDetector } from '../../services/detection/framework-detector.js';

const logger = createLogger('InitCommand');

// Get __dirname equivalent for ES modules
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  IMAGE: 'daemon-tools',
  CONTAINER: 'daemon-tools',
  PROMPT_DEST: path.join(process.cwd(), '.daemon', 'EXECUTE.md'),
  DOCKERFILE: path.resolve(__dirname, '../../../bin/Dockerfile'),
};

/**
 * Run shell command with timeout
 */
function run(cmd: string, options: { silent?: boolean; timeout?: number } = {}): string | null {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: options.timeout ?? 60000
    }).trim();
  } catch (error) {
    if (!options.silent && (error as any).status !== null) {
      logger.debug(`Command exited with code ${(error as any).status}`);
    }
    return null;
  }
}

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
    const options = this.parseArgs(args);

    try {
      logger.info('');
      logger.info('═══════════════════════════════════════════════════');
      logger.info('  Daemon - AI-Powered Test Generation');
      logger.info('═══════════════════════════════════════════════════');
      logger.info('');
      logger.info('  Automated testing toolkit for web applications');
      logger.info('');

      // --- Step 1: Check Docker ---
      logger.info('  → Checking Docker...');
      if (run('docker info', { silent: true }) === null) {
        logger.error('');
        logger.error('  Docker is not running.');
        logger.error('');
        logger.error('  Start Docker Desktop (or the Docker daemon) and try again.');
        logger.error('');
        logger.error('  Install Docker: https://docs.docker.com/get-docker/');
        throw new Error('Docker not running');
      }
      logger.success('  Docker is running');

      // --- Step 2: Build image if missing ---
      const imageExists = run(`docker images -q ${CONFIG.IMAGE}`);

      if (!imageExists) {
        logger.info('');
        logger.warn('  ◆ The testing toolkit needs to be installed (~500 MB Docker image).');
        logger.info('  This only happens once.');
        logger.info('');
        logger.info('  → Building testing toolkit...');
        logger.info('  This may take 2-3 minutes on first run...');
        logger.info('');

        const buildCmd = `docker build -t ${CONFIG.IMAGE} -f "${CONFIG.DOCKERFILE}" "${path.dirname(CONFIG.DOCKERFILE)}"`;
        try {
          execSync(buildCmd, { stdio: 'inherit', timeout: 600000 });
        } catch {
          throw new Error(`Failed to build toolkit. Try: ${buildCmd}`);
        }

        logger.success('  Testing toolkit installed');
      } else {
        logger.success('  Testing toolkit ready');
      }

      // --- Step 3: Start container if not running ---
      const containerRunning = run(
        `docker ps --filter "name=^${CONFIG.CONTAINER}$" --format "{{.Names}}"`
      );

      if (containerRunning === CONFIG.CONTAINER) {
        logger.success(`  Toolkit container running (${CONFIG.CONTAINER})`);
      } else {
        const containerExists = run(
          `docker ps -a --filter "name=^${CONFIG.CONTAINER}$" --format "{{.Names}}"`
        );

        if (containerExists === CONFIG.CONTAINER) {
          process.stdout.write('  → Starting toolkit container...');
          if (run(`docker start ${CONFIG.CONTAINER}`, { timeout: 30000 }) === null) {
            logger.error('');
            throw new Error('Failed to start container');
          }
          logger.info(' done');
        } else {
          const isLinux = process.platform === 'linux';
          const networkFlag = isLinux ? '--network=host' : '';

          process.stdout.write(`  → Creating toolkit container (${CONFIG.CONTAINER})...`);
          const runCmd = `docker run -d --name ${CONFIG.CONTAINER} ${networkFlag} ${CONFIG.IMAGE}`.replace(/\s+/g, ' ');
          if (run(runCmd, { timeout: 30000 }) === null) {
            logger.error('');
            throw new Error(`Failed to create container. Try: ${runCmd}`);
          }
          logger.info(' done');
        }
        logger.success(`  Toolkit container running (${CONFIG.CONTAINER})`);
      }

      // --- Step 4: Run detection ---
      logger.info('  → Analyzing project...');
      const context = await this.runDetection(options);

      // --- Step 5: Create daemon directory and prompt ---
      const daemonDir = path.dirname(CONFIG.PROMPT_DEST);
      if (!fs.existsSync(daemonDir)) {
        fs.mkdirSync(daemonDir, { recursive: true });
      }

      const prompt = this.generatePrompt(context);
      fs.writeFileSync(CONFIG.PROMPT_DEST, prompt, 'utf-8');
      logger.success(`  Prompt installed to ${this.bold('./.daemon/EXECUTE.md')}`);

      // --- Step 6: Print summary ---
      logger.info('');
      logger.info('  Detected Configuration:');
      logger.info(`    Framework:    ${this.cyan(context.framework ?? 'Unknown')}`);
      logger.info(`    Language:     ${this.cyan(context.language ?? 'JavaScript/TypeScript')}`);
      logger.info(`    Test Runner:  ${this.cyan(context.testRunner ?? 'Vitest')}`);
      if (context.database) {
        logger.info(`    Database:     ${this.cyan(context.database.type)}`);
        logger.info(`    Connection:   ${this.cyan(context.database.connection)}`);
      }
      logger.info(`    Existing:     ${this.cyan((context.existingTests ?? 0) + ' tests')}`);
      logger.info(`    Target:       ${this.cyan(context.target ?? 'http://localhost:3000')}`);
      logger.info('');

      // --- Step 7: Print instructions ---
      logger.success('  Ready! Open your AI agent from your project directory and paste:');
      logger.info('');
      logger.info(`    ${this.cyan('Read ./.daemon/EXECUTE.md and start the testing process')}`);
      logger.info('');
      logger.info('  Works with Claude Code, Cursor, Windsurf, Aider, Codex...');
      logger.info('');
    } catch (error) {
      logger.error('Failed to initialize Daemon', error);
      throw error;
    }
  }

  /**
   * Run detection and return context
   */
  private async runDetection(options: InitOptions): Promise<any> {
    if (!options.skipDetection) {
      const result = await this.detector.detect(process.cwd());
      return {
        framework: result.value ?? 'Unknown',
        language: 'JavaScript/TypeScript',
        testRunner: 'Vitest',
        database: null,
        existingTests: 0,
        coverage: null,
        dependencies: [],
        target: 'http://localhost:3000'
      };
    }

    // Default context
    return {
      framework: 'Unknown',
      language: 'JavaScript/TypeScript',
      testRunner: 'Vitest',
      database: null,
      existingTests: 0,
      coverage: null,
      dependencies: [],
      target: 'http://localhost:3000'
    };
  }

  /**
   * Generate prompt with context
   */
  private generatePrompt(context: any): string {
    const promptSrc = path.resolve(__dirname, '../../../prompts/EXECUTE.md');

    if (!fs.existsSync(promptSrc)) {
      return this.generateFallbackPrompt(context);
    }

    const basePrompt = fs.readFileSync(promptSrc, 'utf-8');
    const contextBlock = this.buildContextBlock(context);

    return contextBlock + '\n' + basePrompt;
  }

  /**
   * Build context block for prompt
   */
  private buildContextBlock(context: any): string {
    const lines: string[] = [
      '> **DETECTED CONTEXT**'
    ];

    if (context.framework) {
      lines.push(`> Framework: ${context.framework}`);
    }
    if (context.language) {
      lines.push(`> Language: ${context.language}`);
    }
    if (context.testRunner) {
      lines.push(`> Test Runner: ${context.testRunner}`);
    }
    if (context.database) {
      lines.push(`> Database: ${context.database.type ?? 'detected'}`);
      lines.push(`> DB Connection: ${context.database.connection ?? 'DATABASE_URL'}`);
      lines.push(`> Test Strategy: Transaction rollback (do not modify real data)`);
    } else {
      lines.push(`> Database: none detected`);
    }
    lines.push(`> Existing Tests: ${context.existingTests ?? 0} found`);
    if (context.coverage) {
      lines.push(`> Current Coverage: ${context.coverage}`);
    }
    if (context.dependencies && context.dependencies.length > 0) {
      lines.push(`> Key Dependencies: ${context.dependencies.join(', ')}`);
    }
    lines.push(`> Target: ${context.target ?? 'http://localhost:3000'}`);
    lines.push('');
    lines.push('> **IMPORTANT**:');
    lines.push('> - Use this detected context. Do not re-detect.');
    lines.push('> - Always read source code before generating tests.');
    lines.push('> - Run tests to verify they work before declaring success.');
    if (context.database) {
      lines.push('> - Use transaction rollback for DB tests - never modify real data.');
    }
    lines.push('');
    lines.push('> **WORKFLOW**:');
    lines.push('> 1. Read ./.daemon/EXECUTE.md for full instructions');
    lines.push('> 2. Generate tests following the detected patterns');
    lines.push('> 3. Run tests via Docker container');
    lines.push('> 4. Fix failures iteratively until all pass');
    lines.push('> 5. Generate final report');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate fallback prompt
   */
  private generateFallbackPrompt(context: any): string {
    return `# Daemon — Automated Testing Process

> **DETECTED CONTEXT**
> Framework: ${context.framework ?? 'Unknown'}
> Language: ${context.language ?? 'JavaScript/TypeScript'}
> Test Runner: ${context.testRunner ?? 'Vitest'}
> Database: ${context.database?.type ?? 'none'}
> Target: ${context.target ?? 'http://localhost:3000'}

## Instructions

This is the automated testing agent. Follow these steps:

1. **Read the project structure** - Understand the framework and patterns
2. **Generate unit tests** - For components, hooks, utilities
3. **Generate integration tests** - For API routes and database operations
4. **Generate E2E tests** - For critical user flows
5. **Run and fix** - Iteratively fix failing tests

## Testing Templates

### Unit Tests
\`\`\`typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Component', () => {
  it('should render', () => {
    render(<Component />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
\`\`\`

## Fix Loop

When tests fail:
1. Analyze the error
2. Determine if it's a test issue or code bug
3. Apply fix
4. Re-test

## Completion

Report:
\`\`\`
✓ Unit Tests: X created, Y passing
✓ Integration: X created, Y passing
✓ E2E: X created, Y passing
\`\`\`
`;
  }

  // Helper functions for styling
  private cyan(text: string): string {
    return `\x1b[36m${text}\x1b[0m`;
  }

  private bold(text: string): string {
    return `\x1b[1m${text}\x1b[0m`;
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
}
