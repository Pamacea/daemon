/**
 * CLI Commands Module
 *
 * Exports all CLI commands for the Daemon toolkit.
 *
 * @module cli/commands
 */

export { InitCommand } from './init.command.js';
export type { InitOptions } from './command.types.js';

export { DetectCommand } from './detect.command.js';
export type { DetectOptions } from './command.types.js';

export { TestCommand } from './test.command.js';
export type { TestOptions } from './command.types.js';

export { ScoreCommand } from './score.command.js';
export type { ScoreOptions } from './command.types.js';

export { ReviewCommand } from './review.command.js';
export type { ReviewOptions, ReviewResults, ReviewIssue } from './review.command.js';

export { OptimizeCommand } from './optimize.command.js';
export type { OptimizeOptions, OptimizationSuggestion, OptimizationResult } from './optimize.command.js';

export { ReportCommand } from './report.command.js';
export type { ReportOptions, ReportFormat, ReportResult } from './report.command.js';

export { HistoryCommand } from './history.command.js';
export type { HistoryOptions, HistoryEntry, HistoryResult } from './history.command.js';

// Shared types
export * from './command.types.js';
