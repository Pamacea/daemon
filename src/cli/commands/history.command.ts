/**
 * History Command
 *
 * Manages and displays historical score tracking.
 *
 * @module cli/commands/history
 */

import { createLogger } from '../../shared/utils/logger.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { HistoryOptions } from './command.types.js';
import { formatter } from '../utils/output.js';
import { withProgress, type ProgressManager } from '../utils/progress.js';

const logger = createLogger('HistoryCommand');

/**
 * History entry
 */
interface HistoryEntry {
  timestamp: Date;
  commit: string;
  branch: string;
  overall: number;
  dimensions: Record<string, number>;
  issueCount: number;
  criticalCount: number;
}

/**
 * History command result
 */
interface HistoryResult {
  entries: HistoryEntry[];
  summary: {
    totalEntries: number;
    latestScore: number;
    averageScore: number;
    bestScore: number;
    worstScore: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  period: {
    start: Date;
    end: Date;
    days: number;
  };
}

/**
 * History command for Daemon
 *
 * Manages score history:
 * - View historical scores
 * - Show trends over time
 * - Compare snapshots
 * - Clear history
 * - Prune old entries
 */
export class HistoryCommand {
  private readonly HISTORY_DIR = '.daemon/history';
  private readonly HISTORY_FILE = 'scores.json';

  /**
   * Execute the history command
   */
  async execute(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    try {
      if (options.verbose) {
        logger.debug('Processing history command...', { options });
      }

      const result = await withProgress(
        async (progress) => {
          progress.report(10, 'Loading history...');
          return await this.processHistory(options, progress);
        },
        {
          onStart: (msg) => logger.info(msg),
          onComplete: (msg) => logger.success(msg),
          onError: (err) => logger.error('History command failed', err),
        }
      );

      if (options.clear) {
        console.log(formatter.dim('History cleared'));
        return;
      }

      this.displayResults(result, options);
    } catch (error) {
      logger.error('History command failed', error);
      throw error;
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): HistoryOptions {
    const options: HistoryOptions = {
      verbose: false,
      json: false,
      limit: 10,
      clear: false,
      prune: false,
      compare: false,
      dimension: undefined,
    };

    for (const arg of args) {
      switch (arg) {
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--json':
          options.json = true;
          break;
        case '--clear':
          options.clear = true;
          break;
        case '--prune':
          options.prune = true;
          break;
        case '--compare':
        case '-c':
          options.compare = true;
          break;
        default:
          if (arg.startsWith('--limit=')) {
            const value = arg.split('=')[1];
            if (value) {
              options.limit = parseInt(value, 10) || 10;
            }
          } else if (arg.startsWith('--dim=')) {
            const value = arg.split('=')[1];
            if (value) {
              options.dimension = value;
            }
          } else if (arg.startsWith('-l')) {
            const value = arg.slice(2);
            if (value) {
              options.limit = parseInt(value, 10) || 10;
            }
          }
      }
    }

    return options;
  }

  /**
   * Process history command
   */
  private async processHistory(options: HistoryOptions, progress: ProgressManager): Promise<HistoryResult | null> {
    const projectDir = process.cwd();
    const historyPath = join(projectDir, this.HISTORY_DIR, this.HISTORY_FILE);

    progress.report(30, 'Reading history file...');

    // Clear history if requested
    if (options.clear) {
      await this.clearHistory(projectDir);
      progress.report(100, 'History cleared');
      return null;
    }

    // Read history
    let historyData;
    try {
      const content = await fs.readFile(historyPath, 'utf-8');
      historyData = JSON.parse(content);
    } catch {
      // No history file found
      return this.createEmptyResult();
    }

    progress.report(60, 'Processing entries...');

    const entries: HistoryEntry[] = (historyData.scores || [])
      .map((s: any) => ({
        timestamp: new Date(s.timestamp),
        commit: s.commit,
        branch: s.branch,
        overall: s.overall,
        dimensions: s.dimensions,
        issueCount: s.issueCount || 0,
        criticalCount: s.criticalCount || 0,
      }))
      .sort((a: HistoryEntry, b: HistoryEntry) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, options.limit);

    // Prune if requested
    if (options.prune) {
      await this.pruneHistory(projectDir, options.limit || 100);
    }

    progress.report(100, 'History loaded');

    return this.buildResult(entries);
  }

  /**
   * Build history result
   */
  private buildResult(entries: HistoryEntry[]): HistoryResult {
    if (entries.length === 0) {
      return this.createEmptyResult();
    }

    const scores = entries.map(e => e.overall);
    const latestScore = entries[0].overall;
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (entries.length >= 2) {
      const latest = entries[0].overall;
      const previous = entries[1].overall;
      if (latest > previous + 5) trend = 'improving';
      else if (latest < previous - 5) trend = 'declining';
    }

    const timestamps = entries.map(e => e.timestamp.getTime());
    const start = new Date(Math.min(...timestamps));
    const end = new Date(Math.max(...timestamps));
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    return {
      entries,
      summary: {
        totalEntries: entries.length,
        latestScore,
        averageScore,
        bestScore,
        worstScore,
        trend,
      },
      period: {
        start,
        end,
        days: days || 1,
      },
    };
  }

  /**
   * Create empty result
   */
  private createEmptyResult(): HistoryResult {
    const now = new Date();
    return {
      entries: [],
      summary: {
        totalEntries: 0,
        latestScore: 0,
        averageScore: 0,
        bestScore: 0,
        worstScore: 0,
        trend: 'stable',
      },
      period: {
        start: now,
        end: now,
        days: 0,
      },
    };
  }

  /**
   * Clear history
   */
  private async clearHistory(projectDir: string): Promise<void> {
    const historyPath = join(projectDir, this.HISTORY_DIR, this.HISTORY_FILE);
    try {
      await fs.unlink(historyPath);
    } catch {
      // File doesn't exist, ignore
    }
  }

  /**
   * Prune history keeping only recent entries
   */
  private async pruneHistory(projectDir: string, keepLast: number): Promise<void> {
    const historyPath = join(projectDir, this.HISTORY_DIR, this.HISTORY_FILE);

    try {
      const content = await fs.readFile(historyPath, 'utf-8');
      const data = JSON.parse(content);

      if (data.scores && data.scores.length > keepLast) {
        // Sort by timestamp and keep most recent
        const sortedScores = data.scores
          .sort((a: { timestamp: string }, b: { timestamp: string }) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, keepLast);

        data.scores = sortedScores;
        data.lastUpdated = new Date().toISOString();

        await fs.writeFile(historyPath, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch {
      // File doesn't exist or is invalid
    }
  }

  /**
   * Display formatted results
   */
  private displayResults(result: HistoryResult | null, options: HistoryOptions): void {
    if (!result) {
      return;
    }

    console.log('');
    console.log(formatter.header('Score History', 1));

    if (result.entries.length === 0) {
      console.log(formatter.dim('\nNo history available yet.'));
      console.log(formatter.dim('Run "daemon score" to create the first entry.\n'));
      return;
    }

    // Summary
    const trendIcon = result.summary.trend === 'improving' ? '📈' : result.summary.trend === 'declining' ? '📉' : '➡️';
    console.log(`\n${formatter.bold('Summary:')} ${trendIcon} ${result.summary.trend}`);
    console.log(`  ${formatter.key('Entries:')} ${result.summary.totalEntries}`);
    console.log(`  ${formatter.key('Latest:')} ${this.colorScore(result.summary.latestScore)}`);
    console.log(`  ${formatter.key('Average:')} ${result.summary.averageScore}`);
    console.log(`  ${formatter.key('Best:')} ${formatter.green(String(result.summary.bestScore))}`);
    console.log(`  ${formatter.key('Worst:')} ${formatter.red(String(result.summary.worstScore))}`);
    console.log(`  ${formatter.key('Period:')} ${result.period.days} days`);

    // Dimension focus
    if (options.dimension) {
      console.log(`\n${formatter.bold(`Dimension: ${options.dimension}`)}`);
      for (const entry of result.entries) {
        const dimScore = entry.dimensions[options.dimension] ?? 0;
        const date = entry.timestamp.toLocaleDateString();
        console.log(`  ${date}: ${this.colorScore(dimScore)} ${formatter.dim(`(${entry.commit.substring(0, 7)})`)}`);
      }
    }

    // Compare with previous if requested
    if (options.compare && result.entries.length >= 2) {
      console.log(formatter.bold('\nComparison (latest vs previous):'));
      const latest = result.entries[0];
      const previous = result.entries[1];
      const delta = latest.overall - previous.overall;

      if (delta > 0) {
        console.log(`  ${formatter.green('▲')} Score improved by ${delta} points`);
      } else if (delta < 0) {
        console.log(`  ${formatter.red('▼')} Score decreased by ${Math.abs(delta)} points`);
      } else {
        console.log(`  ${formatter.dim('→')} Score unchanged`);
      }

      console.log(`    Latest: ${this.colorScore(latest.overall)} (${latest.timestamp.toLocaleDateString()})`);
      console.log(`    Previous: ${this.colorScore(previous.overall)} (${previous.timestamp.toLocaleDateString()})`);
    }

    // Entry list
    if (options.verbose && result.entries.length > 0) {
      console.log(formatter.bold('\nEntries:'));

      for (let i = 0; i < result.entries.length; i++) {
        const entry = result.entries[i];
        const date = entry.timestamp.toLocaleDateString();
        const time = entry.timestamp.toLocaleTimeString();
        const delta = i > 0 ? entry.overall - result.entries[i - 1].overall : 0;

        console.log(`\n  ${formatter.bold(`${i + 1}. ${date} ${time}`)} ${formatter.dim(entry.commit.substring(0, 7))} ${formatter.dim(`(${entry.branch})`)}`);
        console.log(`    Score: ${this.colorScore(entry.overall)} ${delta !== 0 ? (delta > 0 ? formatter.green(`+${delta}`) : formatter.red(String(delta))) : ''}`);
        console.log(`    Issues: ${entry.issueCount} (${formatter.red(`${entry.criticalCount} critical`)})`);

        if (Object.keys(entry.dimensions).length > 0) {
          const dims = Object.entries(entry.dimensions)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          console.log(`    ${formatter.dim(dims)}`);
        }
      }
    }

    console.log('');
  }

  /**
   * Color score output
   */
  private colorScore(score: number): string {
    if (score >= 90) return formatter.green(String(score));
    if (score >= 75) return formatter.cyan(String(score));
    if (score >= 60) return formatter.yellow(String(score));
    return formatter.red(String(score));
  }
}

export type { HistoryOptions, HistoryEntry, HistoryResult };
