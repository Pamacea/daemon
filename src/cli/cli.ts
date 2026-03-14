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
import { ScoreCommand } from './commands/score.command.js';
import { ReviewCommand } from './commands/review.command.js';
import { OptimizeCommand } from './commands/optimize.command.js';
import { ReportCommand } from './commands/report.command.js';
import { HistoryCommand } from './commands/history.command.js';

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
    this.commands.set('score', new ScoreCommand());
    this.commands.set('review', new ReviewCommand());
    this.commands.set('optimize', new OptimizeCommand());
    this.commands.set('report', new ReportCommand());
    this.commands.set('history', new HistoryCommand());
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
      console.log('v0.7.0');
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
Daemon v0.7.0 - AI-powered code quality toolkit

USAGE:
  daemon <command> [options]

COMMANDS:
  init        Initialize project with Daemon (creates EXECUTE.md + Dockerfile.daemon)
  detect      Detect project framework and tools
  test        Generate and run tests
  score       Show quality scores across dimensions (test, security, performance, etc.)
  review      Perform comprehensive code review
  optimize    Analyze and apply code optimizations
  report      Generate quality reports (HTML, Markdown, JSON, JUnit)
  history     View score history and trends

OPTIONS:
  --help, -h  Show this help message
  --version   Show version number

EXAMPLES:
  daemon init
  daemon detect
  daemon test --coverage
  daemon score --dim all
  daemon review --fix --auto
  daemon optimize --perf --apply
  daemon report --format=html --output=report.html
  daemon history --limit=20 --compare

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
