/**
 * Detect Command
 *
 * Detects and displays project framework and tools.
 *
 * @module cli/commands/detect
 */

import { createLogger } from '../../shared/utils/logger.js';
import { FrameworkDetector } from '../../services/detection/framework-detector.js';
import type { DetectionResults } from '../../core/types/detection.types.js';

const logger = createLogger('DetectCommand');

export interface DetectOptions {
  /** Output format (text, json) */
  format?: 'text' | 'json';
  /** Verbose output */
  verbose?: boolean;
  /** Include alternatives */
  includeAlternatives?: boolean;
}

/**
 * Detect command for Daemon
 */
export class DetectCommand {
  private readonly detector: FrameworkDetector;

  constructor() {
    this.detector = new FrameworkDetector();
  }

  /**
   * Execute the detect command
   */
  async execute(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    try {
      const results = await this.detector.detectAll(process.cwd(), options);

      if (options.format === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else {
        this.displayResults(results, options);
      }
    } catch (error) {
      logger.error('Detection failed', error);
      throw error;
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): DetectOptions {
    const options: DetectOptions = {
      format: 'text',
      verbose: false,
      includeAlternatives: false,
    };

    for (const arg of args) {
      switch (arg) {
        case '--json':
          options.format = 'json';
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--alternatives':
          options.includeAlternatives = true;
          break;
      }
    }

    return options;
  }

  /**
   * Display detection results in text format
   */
  private displayResults(results: DetectionResults, options: DetectOptions): void {
    console.log('\n🔍 Project Detection Results\n');

    // Framework
    console.log(`Framework: ${this.formatResult(results.framework.value, results.framework.confidence)}`);
    if (results.framework.alternatives && options.includeAlternatives) {
      for (const alt of results.framework.alternatives) {
        console.log(`  └─ Alternative: ${alt.value} (${Math.round(alt.confidence * 100)}%)`);
      }
    }

    // Language
    console.log(`Language: ${this.formatResult(results.language.value, results.language.confidence)}`);

    // Test Runner
    console.log(`Test Runner: ${this.formatResult(results.testRunner.value, results.testRunner.confidence)}`);

    // Database
    if (results.database.value) {
      console.log(`Database: ${this.formatResult(results.database.value, results.database.confidence)}`);
    }

    // Test counts
    console.log(`\nExisting Tests: ${results.testCounts.total}`);
    if (options.verbose && results.testCounts.total > 0) {
      console.log(`  - In src/: ${results.testCounts.inSrc}`);
      console.log(`  - Outside src/: ${results.testCounts.outsideSrc}`);
    }

    // Coverage
    if (results.coverage) {
      console.log(`\nCoverage: ${results.coverage.total.toFixed(1)}%`);
      if (options.verbose) {
        console.log(`  - Lines: ${results.coverage.lines.toFixed(1)}%`);
        console.log(`  - Branches: ${results.coverage.branches.toFixed(1)}%`);
        console.log(`  - Functions: ${results.coverage.functions.toFixed(1)}%`);
      }
    }

    console.log(`\nAnalysis completed in ${results.duration}ms`);
  }

  /**
   * Format a detection result with confidence indicator
   */
  private formatResult(value: string | null, confidence: number): string {
    if (!value) return 'Not detected';

    const percentage = Math.round(confidence * 100);
    const indicator = percentage >= 90 ? '✓' : percentage >= 70 ? '~' : '?';

    return `${value} ${indicator} (${percentage}%)`;
  }
}
