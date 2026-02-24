#!/usr/bin/env node
/**
 * Daemon CLI - Main CLI Class
 *
 * @module cli/cli
 */

import { createLogger } from '../shared/utils/logger.js';
import { InitCommand } from './commands/init.command.js';
import { DetectCommand } from './commands/detect.command.js';
import { TestCommand } from './commands/test.command.js';

const logger = createLogger('DaemonCli');

export interface CliContext {
  /** Project directory */
  projectDir: string;
  /** Verbose mode */
  verbose?: boolean;
  /** Silent mode */
  silent?: boolean;
  /** Force mode */
  force?: boolean;
}

/**
 * Main CLI class for Daemon
 *
 * Handles command routing and execution.
 */
export class DaemonCli {
  private readonly commands: Map<string, { execute: (args: string[]) => Promise<void> }>;

  constructor() {
    this.commands = new Map<string, { execute: (args: string[]) => Promise<void> }>();
    this.commands.set('init', new InitCommand());
    this.commands.set('detect', new DetectCommand());
    this.commands.set('test', new TestCommand());
  }

  /**
   * Run the CLI with provided arguments
   */
  async run(argv: string[]): Promise<void> {
    const args = argv.slice(2); // Skip node and script path

    if (args.length === 0) {
      // No command provided - check if daemon is already initialized
      const fs = await import('node:fs');
      const path = await import('node:path');
      const configExists = fs.existsSync(path.join(process.cwd(), 'daemon.config.json'));

      if (!configExists) {
        // Auto-run init for first-time users
        logger.info('Welcome to Daemon! Initializing your project...');
        logger.info('');
        const initCommand = this.commands.get('init');
        if (initCommand) {
          try {
            await initCommand.execute([]);
          } catch (error) {
            logger.error('Initialization failed', error);
            process.exit(1);
          }
        }
      } else {
        // Already initialized, show help
        this.showHelp();
      }
      return;
    }

    if (args[0] === '--help' || args[0] === '-h') {
      this.showHelp();
      return;
    }

    if (args[0] === '--version') {
      console.log('v0.6.4');
      return;
    }

    const commandName = args[0] ?? '';
    const commandArgs = args.slice(1);

    const command = this.commands.get(commandName);

    if (!command) {
      logger.error(`Unknown command: ${commandName}`);
      this.showHelp();
      process.exit(1);
    }

    try {
      await command.execute(commandArgs);
    } catch (error) {
      logger.error('Command execution failed', error);
      process.exit(1);
    }
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(`
Daemon v0.6.4 - AI-powered automated testing toolkit

USAGE:
  daemon <command> [options]

COMMANDS:
  init        Initialize project with Daemon (creates EXECUTE.md + Dockerfile.daemon)
  detect      Detect project framework and tools
  test        Generate and run tests

OPTIONS:
  --help, -h  Show this help message
  --version   Show version number

EXAMPLES:
  daemon init
  daemon detect
  daemon test --coverage

GETTING STARTED:
  1. Run "daemon init" to initialize your project
  2. Check EXECUTE.md for AI testing instructions
  3. Build Docker: docker build -t daemon-tools -f Dockerfile.daemon .
  4. Start container: docker run -d --name daemon-tools -v %cd:/app daemon-tools

For more information, visit: https://github.com/Pamacea/daemon
    `);
  }

  /**
   * Get CLI context from environment and flags
   */
  createContext(options: {
    verbose?: boolean;
    silent?: boolean;
    force?: boolean;
  }): CliContext {
    return {
      projectDir: process.cwd(),
      verbose: options.verbose ?? false,
      silent: options.silent ?? false,
      force: options.force ?? false,
    };
  }
}
