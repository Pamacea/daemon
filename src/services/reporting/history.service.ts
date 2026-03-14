/**
 * History Service
 *
 * Manages historical score tracking, storage, and retrieval.
 * Stores data in local JSON files in the .daemon directory.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type {
  ScoreSnapshot,
  ScoreTrend,
  Comparison,
  HistoryStorage,
  ExtendedProjectScore,
  CodeDimension,
} from './reporting.types.js';
import { TrendAnalyzer } from './trend-analyzer.js';

/**
 * Maximum number of snapshots to keep by default
 */
const DEFAULT_HISTORY_LIMIT = 100;

/**
 * History storage file name
 */
const HISTORY_FILE = 'scores.json';

/**
 * History service for managing score snapshots
 */
export class HistoryService {
  private analyzer: TrendAnalyzer;
  private storageCache: Map<string, HistoryStorage> = new Map();

  constructor() {
    this.analyzer = new TrendAnalyzer();
  }

  /**
   * Save a score snapshot to history
   *
   * @param projectPath - Path to the project
   * @param score - Score to save
   * @returns Promise resolving when saved
   */
  async saveScore(projectPath: string, score: ExtendedProjectScore): Promise<void> {
    const historyDir = this.getHistoryDir(projectPath);
    const historyFile = join(historyDir, HISTORY_FILE);

    // Ensure directory exists
    await fs.mkdir(historyDir, { recursive: true });

    // Load existing history or create new
    let storage: HistoryStorage;
    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      storage = JSON.parse(content) as HistoryStorage;
    } catch {
      storage = this.createEmptyStorage(projectPath);
    }

    // Create snapshot
    const snapshot: ScoreSnapshot = {
      timestamp: score.timestamp,
      commit: score.commit ?? 'unknown',
      branch: score.branch ?? 'unknown',
      overall: score.overall,
      dimensions: score.dimensions,
      issueCount: score.issues.length,
      criticalCount: score.issues.filter((i: { severity: string }) => i.severity === 'critical').length,
    };

    // Add snapshot (avoid duplicates for same commit)
    const existingIndex = storage.scores.findIndex(s => s.commit === snapshot.commit);
    if (existingIndex >= 0) {
      storage.scores[existingIndex] = snapshot;
    } else {
      storage.scores.push(snapshot);
    }

    // Update metadata
    storage.lastUpdated = new Date();
    storage.version = 1;

    // Save to file
    await fs.writeFile(historyFile, JSON.stringify(storage, null, 2), 'utf-8');

    // Update cache
    this.storageCache.set(projectPath, storage);
  }

  /**
   * Get historical scores for a project
   *
   * @param projectPath - Path to the project
   * @param limit - Maximum number of snapshots to return
   * @returns Array of score snapshots
   */
  async getHistory(projectPath: string, limit?: number): Promise<ScoreSnapshot[]> {
    const storage = await this.loadStorage(projectPath);
    let snapshots = storage.scores
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      snapshots = snapshots.slice(0, limit);
    }

    return snapshots;
  }

  /**
   * Get trend data for a project
   *
   * @param projectPath - Path to the project
   * @param dimension - Optional dimension to analyze
   * @returns Score trend information
   */
  async getTrend(projectPath: string, dimension?: CodeDimension): Promise<ScoreTrend> {
    const snapshots = await this.getHistory(projectPath);
    const sortedSnapshots = snapshots.sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    if (sortedSnapshots.length < 2) {
      return {
        dimension: dimension ?? 'overall',
        current: sortedSnapshots[0]?.overall ?? 0,
        previous: 0,
        delta: 0,
        trend: 'stable',
        history: sortedSnapshots.map(s => s.overall),
        timestamps: sortedSnapshots.map(s => s.timestamp),
      };
    }

    const analysis = this.analyzer.analyze(sortedSnapshots);

    if (dimension) {
      return analysis.dimensionTrends[dimension] ?? analysis.overallTrend;
    }

    return analysis.overallTrend;
  }

  /**
   * Compare two snapshots
   *
   * @param before - Earlier snapshot
   * @param after - Later snapshot
   * @returns Comparison result
   */
  async compareSnapshots(before: ScoreSnapshot, after: ScoreSnapshot): Promise<Comparison> {
    const overallChange = after.overall - before.overall;

    // Calculate dimension changes
    const dimensionChanges: Record<string, {
      before: number;
      after: number;
      delta: number;
      trend: 'improving' | 'stable' | 'declining';
    }> = {};

    const allDimensions = new Set([
      ...Object.keys(before.dimensions),
      ...Object.keys(after.dimensions),
    ]);

    for (const dim of Array.from(allDimensions)) {
      const beforeScore = before.dimensions[dim]?.score ?? 0;
      const afterScore = after.dimensions[dim]?.score ?? 0;
      const delta = afterScore - beforeScore;

      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (delta > 5) trend = 'improving';
      else if (delta < -5) trend = 'declining';

      dimensionChanges[dim] = {
        before: beforeScore,
        after: afterScore,
        delta,
        trend,
      };
    }

    // Note: We can't track individual issues between snapshots without storing them
    // This is a simplified implementation
    const addedIssues: never[] = [];
    const resolvedIssues: never[] = [];

    // Generate summary
    const summary = this.generateComparisonSummary(overallChange, before, after);

    return {
      before,
      after,
      overallChange,
      dimensionChanges,
      addedIssues,
      resolvedIssues,
      summary,
    };
  }

  /**
   * Prune old history entries
   *
   * @param projectPath - Path to the project
   * @param keepLast - Number of recent snapshots to keep
   * @returns Promise resolving when pruned
   */
  async pruneHistory(projectPath: string, keepLast: number = DEFAULT_HISTORY_LIMIT): Promise<void> {
    const historyFile = join(this.getHistoryDir(projectPath), HISTORY_FILE);

    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      const storage: HistoryStorage = JSON.parse(content);

      if (storage.scores.length > keepLast) {
        // Sort by timestamp and keep the most recent
        const sortedScores = storage.scores.sort((a, b) =>
          b.timestamp.getTime() - a.timestamp.getTime()
        );

        // Keep last N and any significant milestones (high scores)
        const recent = sortedScores.slice(0, keepLast);
        const milestones = sortedScores.slice(keepLast)
          .filter(s => s.overall >= 90 || s.criticalCount === 0);

        storage.scores = [...recent, ...milestones];
        storage.lastUpdated = new Date();

        await fs.writeFile(historyFile, JSON.stringify(storage, null, 2), 'utf-8');

        // Update cache
        this.storageCache.set(projectPath, storage);
      }
    } catch {
      // File doesn't exist or is invalid, nothing to prune
    }
  }

  /**
   * Get the full trend analysis
   *
   * @param projectPath - Path to the project
   * @returns Complete trend analysis
   */
  async getFullAnalysis(projectPath: string) {
    const snapshots = await this.getHistory(projectPath);
    return this.analyzer.analyze(snapshots);
  }

  /**
   * Get latest snapshot for a project
   *
   * @param projectPath - Path to the project
   * @returns Latest snapshot or null
   */
  async getLatest(projectPath: string): Promise<ScoreSnapshot | null> {
    const snapshots = await this.getHistory(projectPath, 1);
    return snapshots[0] ?? null;
  }

  /**
   * Clear all history for a project
   *
   * @param projectPath - Path to the project
   * @returns Promise resolving when cleared
   */
  async clearHistory(projectPath: string): Promise<void> {
    const historyFile = join(this.getHistoryDir(projectPath), HISTORY_FILE);

    try {
      await fs.unlink(historyFile);
      this.storageCache.delete(projectPath);
    } catch {
      // File doesn't exist, ignore
    }
  }

  /**
   * Get history directory path for a project
   */
  private getHistoryDir(projectPath: string): string {
    return join(projectPath, '.daemon', 'history');
  }

  /**
   * Load storage from file or cache
   */
  private async loadStorage(projectPath: string): Promise<HistoryStorage> {
    // Check cache first
    const cached = this.storageCache.get(projectPath);
    if (cached) {
      return cached;
    }

    const historyFile = join(this.getHistoryDir(projectPath), HISTORY_FILE);

    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      const storage: HistoryStorage = JSON.parse(content);

      // Parse date strings back to Date objects
      for (const score of storage.scores) {
        score.timestamp = new Date(score.timestamp);
      }

      this.storageCache.set(projectPath, storage);
      return storage;
    } catch {
      const empty = this.createEmptyStorage(projectPath);
      this.storageCache.set(projectPath, empty);
      return empty;
    }
  }

  /**
   * Create empty storage structure
   */
  private createEmptyStorage(projectPath: string): HistoryStorage {
    return {
      projectPath,
      scores: [],
      version: 1,
      lastUpdated: new Date(),
    };
  }

  /**
   * Generate comparison summary text
   */
  private generateComparisonSummary(
    overallChange: number,
    before: ScoreSnapshot,
    after: ScoreSnapshot
  ): string {
    const direction = overallChange > 0 ? 'improved' : overallChange < 0 ? 'declined' : 'remained stable';
    const change = Math.abs(overallChange);

    if (change === 0) {
      return `Overall score ${direction} at ${after.overall}.`;
    }

    return `Overall score ${direction} by ${change} points, from ${before.overall} to ${after.overall}.`;
  }
}
