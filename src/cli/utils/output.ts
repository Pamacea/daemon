/**
 * Output Utilities
 *
 * Formatted output helpers for CLI commands.
 *
 * @module cli/utils/output
 */

import type { ScoreBreakdown, TrendDataPoint, OutputFormat } from '../commands/command.types.js';

/**
 * ANSI color codes for terminal output
 */
const ANSI = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
} as const;

/**
 * Color options for styling
 */
export type Color = keyof typeof ANSI;

/**
 * Output formatter options
 */
export interface OutputFormatterOptions {
  /** Disable colors */
  noColor?: boolean;
  /** Output width (default: 80) */
  width?: number;
  /** Indentation string */
  indent?: string;
}

/**
 * Output formatter class
 */
export class OutputFormatter {
  private readonly noColor: boolean;
  private readonly width: number;
  private readonly indent: string;

  constructor(options: OutputFormatterOptions = {}) {
    this.noColor = options.noColor ?? false;
    this.width = options.width ?? 80;
    this.indent = options.indent ?? '  ';
  }

  /**
   * Apply color to text
   */
  color(text: string, color: Color): string {
    if (this.noColor) {
      return text;
    }
    const code = ANSI[color];
    return `${code}${text}${ANSI.reset}`;
  }

  /**
   * Make text bold
   */
  bold(text: string): string {
    if (this.noColor) return text;
    return `${ANSI.bright}${text}${ANSI.reset}`;
  }

  /**
   * Make text dim
   */
  dim(text: string): string {
    if (this.noColor) return text;
    return `${ANSI.dim}${text}${ANSI.reset}`;
  }

  /**
   * Make text green
   */
  green(text: string): string {
    return this.color(text, 'green');
  }

  /**
   * Make text red
   */
  red(text: string): string {
    return this.color(text, 'red');
  }

  /**
   * Make text yellow
   */
  yellow(text: string): string {
    return this.color(text, 'yellow');
  }

  /**
   * Make text blue
   */
  blue(text: string): string {
    return this.color(text, 'blue');
  }

  /**
   * Make text cyan
   */
  cyan(text: string): string {
    return this.color(text, 'cyan');
  }

  /**
   * Make text magenta
   */
  magenta(text: string): string {
    return this.color(text, 'magenta');
  }

  /**
   * Format a key-value label
   */
  key(text: string): string {
    return this.dim(text + ':');
  }

  /**
   * Get score color based on value
   */
  scoreColor(score: number): (text: string) => string {
    if (score >= 90) return this.green.bind(this);
    if (score >= 75) return (text: string) => this.color(text, 'cyan');
    if (score >= 60) return this.yellow.bind(this);
    if (score >= 40) return (text: string) => this.color(text, 'magenta');
    return this.red.bind(this);
  }

  /**
   * Format a score with color
   */
  formatScore(score: number): string {
    const colorFn = this.scoreColor(score);
    return colorFn(`${score}/100`);
  }

  /**
   * Get status indicator with color
   */
  statusIndicator(status: string): string {
    const indicators: Record<string, { text: string; color: Color }> = {
      excellent: { text: '✓', color: 'green' },
      good: { text: '●', color: 'cyan' },
      fair: { text: '○', color: 'yellow' },
      poor: { text: '◆', color: 'magenta' },
      critical: { text: '✖', color: 'red' },
      pass: { text: '✓', color: 'green' },
      fail: { text: '✖', color: 'red' },
      warn: { text: '⚠', color: 'yellow' },
      info: { text: 'ℹ', color: 'blue' },
    };

    const { text, color } = indicators[status.toLowerCase()] || { text: '?', color: 'white' };
    return this.color(text, color);
  }

  /**
   * Create a horizontal divider
   */
  divider(char: string = '─', length: number = this.width): string {
    return char.repeat(length);
  }

  /**
   * Create a section header
   */
  header(title: string, level: number = 1): string {
    const line = this.divider('─');
    if (level === 1) {
      return `\n${line}\n${this.bold(title)}\n${line}\n`;
    }
    return `\n${this.bold(title)}\n${this.dim('─'.repeat(title.length))}\n`;
  }

  /**
   * Format a key-value pair
   */
  kv(key: string, value: string, indent: number = 0): string {
    const prefix = this.indent.repeat(indent);
    const coloredKey = this.cyan(key + ':');
    return `${prefix}${coloredKey} ${value}`;
  }

  /**
   * Format a list item
   */
  bullet(text: string, indent: number = 0, bullet: string = '•'): string {
    const prefix = this.indent.repeat(indent);
    return `${prefix}${bullet} ${text}`;
  }

  /**
   * Format numbered list item
   */
  number(text: string, num: number, indent: number = 0): string {
    const prefix = this.indent.repeat(indent);
    return `${prefix}${num}. ${text}`;
  }

  /**
   * Create a simple table
   */
  table(headers: string[], rows: string[][]): string {
    // Calculate column widths
    const colWidths = headers.map((h, i) => {
      const maxRowWidth = Math.max(...rows.map((r) => (r[i] || '').length));
      return Math.max(h.length, maxRowWidth);
    });

    // Helper to format a row
    const formatRow = (cells: string[], isHeader: boolean = false): string => {
      return cells
        .map((cell, i) => {
          const padding = ' '.repeat(colWidths[i] - cell.length);
          const content = isHeader ? this.bold(cell) : cell;
          return content + padding;
        })
        .join('   ');
    };

    // Build table
    const lines: string[] = [];

    // Header separator
    lines.push(formatRow(headers, true));
    lines.push(colWidths.map((w) => this.dim('─'.repeat(w))).join('   '));

    // Data rows
    for (const row of rows) {
      lines.push(formatRow(row));
    }

    return lines.join('\n');
  }

  /**
   * Format score breakdown display
   */
  scoreBreakdown(breakdowns: ScoreBreakdown[], verbose: boolean = false): string {
    const lines: string[] = [];

    lines.push(this.header('Quality Score Breakdown', 2));

    // Table header
    lines.push(
      this.table(
        ['Dimension', 'Score', 'Status', 'Issues', 'Recommendations'],
        breakdowns.map((b) => [
          this.bold(b.dimension),
          this.formatScore(b.score),
          `${this.statusIndicator(b.status)} ${b.status}`,
          b.issues > 0 ? (b.issues > 5 ? this.red(String(b.issues)) : this.yellow(String(b.issues))) : '—',
          b.recommendations > 0 ? this.cyan(String(b.recommendations)) : '—',
        ])
      )
    );

    // Overall score
    const overall = Math.round(breakdowns.reduce((sum, b) => sum + b.score * b.weight, 0) / breakdowns.length);
    lines.push('');
    lines.push(`${this.bold('Overall Score:')} ${this.formatScore(overall)}`);

    if (verbose) {
      lines.push('');
      lines.push(this.header('Detailed Analysis', 2));

      for (const b of breakdowns) {
        lines.push(`\n${this.bold(b.dimension)} (${this.formatScore(b.score)})`);
        lines.push(`  Status: ${this.statusIndicator(b.status)} ${b.status}`);
        lines.push(`  Weight: ${Math.round(b.weight * 100)}%`);

        if (b.issues > 0) {
          lines.push(`  Issues Found: ${this.yellow(String(b.issues))}`);
        }

        if (b.recommendations > 0) {
          lines.push(`  Recommendations: ${this.cyan(String(b.recommendations))}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Format trend data display
   */
  trendData(points: TrendDataPoint[]): string {
    if (points.length === 0) {
      return this.dim('\nNo historical data available.\n');
    }

    const lines: string[] = [];

    lines.push(this.header('Score Trends', 2));

    // Summary
    const latest = points[points.length - 1];
    const previous = points.length > 1 ? points[points.length - 2] : null;
    const change = previous ? latest.score - previous.score : 0;

    lines.push(`${this.bold('Latest Score:')} ${this.formatScore(latest.score)}`);

    if (previous) {
      const changeText = change > 0 ? `+${change}` : String(change);
      let changeColorFn: (t: string) => string;
      if (change > 0) {
        changeColorFn = this.green.bind(this);
      } else if (change < 0) {
        changeColorFn = this.red.bind(this);
      } else {
        changeColorFn = this.dim.bind(this);
      }
      lines.push(`${this.bold('Change:')} ${changeColorFn(changeText)}`);
    }

    // Trend table
    if (points.length > 1) {
      lines.push('');
      lines.push(
        this.table(
          ['Date', 'Score', 'Change'],
          points.map((p, i) => {
            const prevScore = i > 0 ? points[i - 1].score : p.score;
            const delta = p.score - prevScore;
            const deltaText = delta > 0 ? `+${delta}` : delta === 0 ? '—' : String(delta);
            let deltaColor: string;
            if (delta > 0) {
              deltaColor = this.green(deltaText);
            } else if (delta < 0) {
              deltaColor = this.red(deltaText);
            } else {
              deltaColor = this.dim(deltaText);
            }

            return [
              new Date(p.timestamp).toLocaleDateString(),
              this.formatScore(p.score),
              deltaColor,
            ];
          })
        )
      );
    }

    return lines.join('\n');
  }

  /**
   * Format review results
   */
  reviewResults(results: {
    totalIssues: number;
    bySeverity: Record<string, number>;
    byDimension: Record<string, number>;
    fixed: number;
  }): string {
    const lines: string[] = [];

    lines.push(this.header('Review Results', 2));

    // Summary
    lines.push(
      this.table(
        ['Metric', 'Count'],
        [
          ['Total Issues', String(results.totalIssues)],
          ['Critical', this.red(String(results.bySeverity.critical || 0))],
          ['High', this.yellow(String(results.bySeverity.high || 0))],
          ['Medium', String(results.bySeverity.medium || 0)],
          ['Low', this.dim(String(results.bySeverity.low || 0))],
          ['Fixed', this.green(String(results.fixed))],
        ]
      )
    );

    // By dimension
    if (Object.keys(results.byDimension).length > 0) {
      lines.push('');
      lines.push(this.bold('Issues by Dimension:'));
      for (const [dim, count] of Object.entries(results.byDimension)) {
        lines.push(`  ${this.bullet(`${dim}: ${count}`, 1)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format optimization suggestions
   */
  optimizationSuggestions(suggestions: Array<{
    type: string;
    priority: string;
    description: string;
    impact: string;
  }>, dryRun: boolean = false): string {
    const lines: string[] = [];

    const title = dryRun ? 'Suggested Optimizations (Dry Run)' : 'Optimization Suggestions';
    lines.push(this.header(title, 2));

    if (suggestions.length === 0) {
      lines.push(this.dim('\nNo optimizations needed. Great job!\n'));
      return lines.join('\n');
    }

    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      const priorityColor =
        s.priority === 'high' ? this.red : s.priority === 'medium' ? this.yellow : this.dim;

      lines.push(`\n${this.number(`${this.bold(s.type)} (${priorityColor(s.priority)})`, i + 1, 0)}`);
      lines.push(`  ${s.description}`);
      lines.push(`  ${this.dim('Impact:')} ${this.cyan(s.impact)}`);
    }

    return lines.join('\n');
  }

  /**
   * Create a progress bar
   */
  progressBar(percent: number, width: number = 30): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return this.color(`[${bar}] ${percent}%`, 'cyan');
  }

  /**
   * Format error message
   */
  error(message: string, error?: Error): string {
    const lines: string[] = [];

    lines.push(this.red(`✖ Error: ${message}`));

    if (error && this.noColor === false) {
      if (error.stack) {
        lines.push('');
        lines.push(this.dim(error.stack));
      }
    }

    return lines.join('\n');
  }

  /**
   * Format success message
   */
  success(message: string): string {
    return this.green(`✓ ${message}`);
  }

  /**
   * Format warning message
   */
  warning(message: string): string {
    return this.yellow(`⚠ ${message}`);
  }

  /**
   * Format info message
   */
  info(message: string): string {
    return this.blue(`ℹ ${message}`);
  }

  /**
   * Output JSON
   */
  json(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }
}

/**
 * Default formatter instance
 */
export const formatter = new OutputFormatter();
