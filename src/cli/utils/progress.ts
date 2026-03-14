/**
 * Progress Utilities
 *
 * Progress bars and spinners for CLI operations.
 *
 * @module cli/utils/progress
 */

import type { ProgressCallbacks } from '../commands/command.types.js';

/**
 * Progress bar options
 */
export interface ProgressBarOptions {
  /** Total steps (for percentage calculation) */
  total?: number;
  /** Width of the bar (default: 30) */
  width?: number;
  /** Show percentage */
  showPercent?: boolean;
  /** Show elapsed time */
  showElapsed?: boolean;
  /** Custom character for filled portion */
  fillChar?: string;
  /** Custom character for empty portion */
  emptyChar?: string;
}

/**
 * Progress bar class
 */
export class ProgressBar {
  private readonly total: number;
  private readonly width: number;
  private readonly showPercent: boolean;
  private readonly showElapsed: boolean;
  private readonly fillChar: string;
  private readonly emptyChar: string;

  private current: number = 0;
  private startTime: number = Date.now();
  private lastOutput: string = '';

  constructor(options: ProgressBarOptions = {}) {
    this.total = options.total ?? 100;
    this.width = options.width ?? 30;
    this.showPercent = options.showPercent ?? true;
    this.showElapsed = options.showElapsed ?? true;
    this.fillChar = options.fillChar ?? '█';
    this.emptyChar = options.emptyChar ?? '░';
  }

  /**
   * Update progress
   */
  update(value: number, message?: string): void {
    this.current = Math.min(value, this.total);
    this.render(message);
  }

  /**
   * Increment progress by amount
   */
  increment(amount: number = 1, message?: string): void {
    this.update(this.current + amount, message);
  }

  /**
   * Get current percentage
   */
  getPercent(): number {
    return Math.round((this.current / this.total) * 100);
  }

  /**
   * Get total value
   */
  getTotal(): number {
    return this.total;
  }

  /**
   * Get width value
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Get fill character
   */
  getFillChar(): string {
    return this.fillChar;
  }

  /**
   * Get empty character
   */
  getEmptyChar(): string {
    return this.emptyChar;
  }

  /**
   * Get elapsed time string
   */
  getElapsed(): string {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  /**
   * Render the progress bar
   */
  private render(message?: string): void {
    const percent = this.getPercent();
    const filled = Math.round((percent / 100) * this.width);
    const empty = this.width - filled;

    const bar = this.fillChar.repeat(filled) + this.emptyChar.repeat(empty);
    const percentStr = this.showPercent ? ` ${percent}%` : '';
    const elapsedStr = this.showElapsed ? ` (${this.getElapsed()})` : '';
    const messageStr = message ? ` ${message}` : '';

    const output = `\r[${bar}]${percentStr}${elapsedStr}${messageStr}`;

    // Only output if changed to reduce flicker
    if (output !== this.lastOutput) {
      process.stdout.write(output);
      this.lastOutput = output;
    }
  }

  /**
   * Complete the progress bar
   */
  complete(message?: string): void {
    this.update(this.total, message ?? 'Complete');
    process.stdout.write('\n');
  }

  /**
   * Reset the progress bar
   */
  reset(): void {
    this.current = 0;
    this.startTime = Date.now();
    this.lastOutput = '';
  }
}

/**
 * Spinner options
 */
export interface SpinnerOptions {
  /** Spinner frames */
  frames?: string[];
  /** Interval between frames (ms) */
  interval?: number;
  /** Show on start */
  autoStart?: boolean;
}

/**
 * Default spinner frames
 */
const DEFAULT_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Spinner class for loading indicators
 */
export class Spinner {
  private readonly frames: string[];
  private readonly interval: number;
  private frameIndex: number = 0;
  private timer: NodeJS.Timeout | null = null;
  private message: string = '';
  private active: boolean = false;

  constructor(options: SpinnerOptions = {}) {
    this.frames = options.frames ?? DEFAULT_FRAMES;
    this.interval = options.interval ?? 80;

    if (options.autoStart) {
      this.start();
    }
  }

  /**
   * Start the spinner
   */
  start(message?: string): void {
    if (this.active) {
      return;
    }

    this.active = true;
    this.message = message ?? '';
    this.frameIndex = 0;

    this.timer = setInterval(() => {
      this.render();
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, this.interval);
  }

  /**
   * Update the spinner message
   */
  update(message: string): void {
    this.message = message;
    if (!this.active) {
      this.start(message);
    }
  }

  /**
   * Stop the spinner
   */
  stop(finalMessage?: string, success: boolean = true): void {
    if (!this.active) {
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.active = false;

    // Clear the spinner line
    process.stdout.write('\r' + ' '.repeat(this.message.length + 3) + '\r');

    // Show final message if provided
    if (finalMessage) {
      const symbol = success ? '✓' : '✖';
      const color = success ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      console.log(`${color}${symbol}${reset} ${finalMessage}`);
    }
  }

  /**
   * Succeed - stop with success message
   */
  succeed(message?: string): void {
    this.stop(message, true);
  }

  /**
   * Fail - stop with error message
   */
  fail(message?: string): void {
    this.stop(message, false);
  }

  /**
   * Render current frame
   */
  private render(): void {
    const frame = this.frames[this.frameIndex];
    const output = `\r${frame} ${this.message}`;
    process.stdout.write(output);
  }

  /**
   * Check if spinner is active
   */
  isActive(): boolean {
    return this.active;
  }
}

/**
 * Multi-progress for tracking multiple tasks
 */
export class MultiProgress {
  private readonly bars: Map<string, ProgressBar> = new Map();

  /**
   * Add or get a progress bar for a task
   */
  task(name: string, total?: number): ProgressBar {
    let bar = this.bars.get(name);
    if (!bar) {
      bar = new ProgressBar({ total, width: 20, showPercent: false });
      this.bars.set(name, bar);
    }
    return bar;
  }

  /**
   * Update a specific task
   */
  update(name: string, value: number, message?: string): void {
    const bar = this.bars.get(name);
    if (bar) {
      bar.update(value, message);
      this.render();
    }
  }

  /**
   * Complete a specific task
   */
  complete(name: string, message?: string): void {
    const bar = this.bars.get(name);
    if (bar) {
      bar.update(bar.getTotal(), message ?? 'Done');
      this.bars.delete(name);
      this.render();
    }
  }

  /**
   * Render all progress bars
   */
  private render(): void {
    const lines: string[] = [];

    const entries = Array.from(this.bars.entries());
    for (const [name, bar] of entries) {
      const percent = bar.getPercent();
      const width = bar.getWidth();
      const filled = Math.round((percent / 100) * width);
      const empty = width - filled;
      const barStr = bar.getFillChar().repeat(filled) + bar.getEmptyChar().repeat(empty);
      lines.push(`${name}: [${barStr}] ${percent}%`);
    }

    if (lines.length > 0) {
      // Move cursor up to overwrite previous output
      const lineCount = this.bars.size;
      process.stdout.write(`\x1b[${lineCount}F`);
      for (const line of lines) {
        process.stdout.write(`${line}\n`);
      }
    }
  }
}

/**
 * Progress manager with callbacks
 */
export class ProgressManager {
  private callbacks: ProgressCallbacks;
  private spinner?: Spinner;
  private progressBar?: ProgressBar;
  private multiProgress?: MultiProgress;

  constructor(callbacks: ProgressCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Create a spinner for the operation
   */
  createSpinner(initialMessage?: string): Spinner {
    this.spinner = new Spinner({
      autoStart: true,
    });

    if (initialMessage) {
      this.spinner.update(initialMessage);
    }

    this.callbacks.onStart?.(initialMessage ?? 'Starting...');

    return this.spinner;
  }

  /**
   * Create a progress bar
   */
  createProgressBar(total: number, initialMessage?: string): ProgressBar {
    this.progressBar = new ProgressBar({
      total,
      showPercent: true,
      showElapsed: true,
    });

    this.callbacks.onStart?.(initialMessage ?? 'Starting...');

    return this.progressBar;
  }

  /**
   * Create a multi-progress tracker
   */
  createMultiProgress(): MultiProgress {
    this.multiProgress = new MultiProgress();
    return this.multiProgress;
  }

  /**
   * Report progress update
   */
  report(percent: number, message?: string): void {
    this.callbacks.onProgress?.(percent, message);

    if (this.progressBar) {
      this.progressBar.update(percent, message);
    }

    if (this.spinner && message) {
      this.spinner.update(message);
    }
  }

  /**
   * Complete the operation
   */
  complete(message?: string): void {
    this.callbacks.onComplete?.(message ?? 'Complete');

    if (this.spinner) {
      this.spinner.succeed(message);
    }

    if (this.progressBar) {
      this.progressBar.complete(message);
    }
  }

  /**
   * Report an error
   */
  error(error: Error): void {
    this.callbacks.onError?.(error);

    if (this.spinner) {
      this.spinner.fail(error.message);
    }

    if (this.progressBar) {
      console.error(`\n✖ Error: ${error.message}`);
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.spinner?.isActive()) {
      this.spinner.stop();
    }
  }
}

/**
 * Helper function to run async operation with progress
 */
export async function withProgress<T>(
  operation: (progress: ProgressManager) => Promise<T>,
  callbacks: ProgressCallbacks = {}
): Promise<T> {
  const progress = new ProgressManager(callbacks);

  try {
    const result = await operation(progress);
    progress.complete();
    return result;
  } catch (error) {
    progress.error(error as Error);
    throw error;
  } finally {
    progress.cleanup();
  }
}

/**
 * Create a simple loading spinner for a promise
 */
export async function withSpinner<T>(
  message: string,
  operation: () => Promise<T>,
  successMessage?: string
): Promise<T> {
  const spinner = new Spinner({ autoStart: true });
  spinner.update(message);

  try {
    const result = await operation();
    spinner.succeed(successMessage ?? message);
    return result;
  } catch (error) {
    spinner.fail((error as Error).message);
    throw error;
  }
}
