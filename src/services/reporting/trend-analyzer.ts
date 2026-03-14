/**
 * Trend Analyzer
 *
 * Analyzes score trends over time, detects regressions,
 * and predicts future trends.
 */

import type {
  ScoreSnapshot,
  TrendAnalysis,
  TrendPrediction,
  Regression,
  Improvement,
  ScoreTrend,
  CodeDimension,
} from './reporting.types.js';

/**
 * Trend analyzer service
 */
export class TrendAnalyzer {
  /**
   * Minimum number of snapshots required for trend analysis
   */
  private static readonly MIN_SNAPSHOTS = 2;

  /**
   * Threshold for considering a change significant
   */
  private static readonly SIGNIFICANT_CHANGE = 5;

  /**
   * Threshold for regression detection
   */
  private static readonly REGRESSION_THRESHOLD = 10;

  /**
   * Analyze trends from score snapshots
   *
   * @param snapshots - Historical score snapshots
   * @returns Complete trend analysis
   */
  analyze(scores: ScoreSnapshot[]): TrendAnalysis {
    if (scores.length < TrendAnalyzer.MIN_SNAPSHOTS) {
      return this.createEmptyAnalysis(scores);
    }

    const sortedScores = [...scores].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    const overallTrend = this.calculateTrend('overall', sortedScores.map(s => s.overall), sortedScores);
    const dimensionTrends: Record<string, ScoreTrend> = {};

    // Analyze each dimension
    const allDimensions = new Set<CodeDimension>();
    for (const score of sortedScores) {
      Object.keys(score.dimensions).forEach(dim => allDimensions.add(dim as CodeDimension));
    }

    for (const dimension of Array.from(allDimensions)) {
      const values = sortedScores
        .map(s => s.dimensions[dimension]?.score ?? 0)
        .filter(v => v > 0);

      if (values.length >= TrendAnalyzer.MIN_SNAPSHOTS) {
        dimensionTrends[dimension] = this.calculateTrend(
          dimension,
          values,
          sortedScores
        );
      }
    }

    const regressions = this.detectRegressions(sortedScores);
    const improvements = this.detectImprovements(sortedScores);
    const velocity = this.calculateVelocity(sortedScores);

    return {
      overallTrend,
      dimensionTrends,
      regressions,
      improvements,
      velocity,
      period: {
        start: sortedScores[0]?.timestamp ?? new Date(),
        end: sortedScores[sortedScores.length - 1]?.timestamp ?? new Date(),
        snapshotCount: sortedScores.length,
      },
    };
  }

  /**
   * Detect regressions in score history
   *
   * @param scores - Historical scores
   * @returns Array of detected regressions
   */
  detectRegressions(scores: ScoreSnapshot[]): Regression[] {
    const regressions: Regression[] = [];
    const sortedScores = [...scores].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Check overall regression
    for (let i = 1; i < sortedScores.length; i++) {
      const prev = sortedScores[i - 1];
      const curr = sortedScores[i];
      const drop = prev.overall - curr.overall;

      if (drop >= TrendAnalyzer.REGRESSION_THRESHOLD) {
        regressions.push({
          dimension: 'overall',
          previousScore: prev.overall,
          currentScore: curr.overall,
          drop,
          severity: this.getRegressionSeverity(drop),
        });
      }
    }

    // Check dimension regressions
    const allDimensions = new Set<string>();
    for (const score of sortedScores) {
      Object.keys(score.dimensions).forEach(dim => allDimensions.add(dim));
    }

    for (const dimension of Array.from(allDimensions)) {
      for (let i = 1; i < sortedScores.length; i++) {
        const prevScore = sortedScores[i - 1].dimensions[dimension]?.score ?? 0;
        const currScore = sortedScores[i].dimensions[dimension]?.score ?? 0;
        const drop = prevScore - currScore;

        if (drop >= TrendAnalyzer.REGRESSION_THRESHOLD && prevScore > 0) {
          regressions.push({
            dimension: dimension as CodeDimension,
            previousScore: prevScore,
            currentScore: currScore,
            drop,
            severity: this.getRegressionSeverity(drop),
          });
        }
      }
    }

    return regressions;
  }

  /**
   * Detect improvements in score history
   *
   * @param scores - Historical scores
   * @returns Array of detected improvements
   */
  detectImprovements(scores: ScoreSnapshot[]): Improvement[] {
    const improvements: Improvement[] = [];
    const sortedScores = [...scores].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Check overall improvements
    for (let i = 1; i < sortedScores.length; i++) {
      const prev = sortedScores[i - 1];
      const curr = sortedScores[i];
      const increase = curr.overall - prev.overall;

      if (increase >= TrendAnalyzer.SIGNIFICANT_CHANGE) {
        improvements.push({
          dimension: 'overall',
          previousScore: prev.overall,
          currentScore: curr.overall,
          increase,
        });
      }
    }

    // Check dimension improvements
    const allDimensions = new Set<string>();
    for (const score of sortedScores) {
      Object.keys(score.dimensions).forEach(dim => allDimensions.add(dim));
    }

    for (const dimension of Array.from(allDimensions)) {
      for (let i = 1; i < sortedScores.length; i++) {
        const prevScore = sortedScores[i - 1].dimensions[dimension]?.score ?? 0;
        const currScore = sortedScores[i].dimensions[dimension]?.score ?? 0;
        const increase = currScore - prevScore;

        if (increase >= TrendAnalyzer.SIGNIFICANT_CHANGE && prevScore > 0) {
          improvements.push({
            dimension: dimension as CodeDimension,
            previousScore: prevScore,
            currentScore: currScore,
            increase,
          });
        }
      }
    }

    return improvements;
  }

  /**
   * Predict future trend based on historical data
   *
   * @param scores - Historical scores
   * @param horizon - Number of snapshots to predict ahead
   * @returns Trend prediction
   */
  predictTrend(scores: ScoreSnapshot[], horizon: number = 3): TrendPrediction {
    if (scores.length < 3) {
      return {
        dimension: 'overall',
        current: scores[scores.length - 1]?.overall ?? 0,
        predicted: scores[scores.length - 1]?.overall ?? 0,
        confidence: 0,
        horizon,
        trend: 'stable',
      };
    }

    const sortedScores = [...scores].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    const values = sortedScores.map(s => s.overall);
    const current = values[values.length - 1];

    // Simple linear regression for prediction
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const predicted = Math.max(0, Math.min(100, current + slope * horizon));

    // Calculate confidence based on variance
    const mean = sumY / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const confidence = Math.max(0, Math.min(1, 1 - variance / 1000));

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (slope > 1) trend = 'improving';
    else if (slope < -1) trend = 'declining';

    return {
      dimension: 'overall',
      current,
      predicted: Math.round(predicted),
      confidence: Math.round(confidence * 100) / 100,
      horizon,
      trend,
    };
  }

  /**
   * Calculate development velocity
   *
   * @param scores - Historical scores
   * @returns Velocity score (points per snapshot)
   */
  calculateVelocity(scores: ScoreSnapshot[]): number {
    if (scores.length < 2) return 0;

    const sortedScores = [...scores].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    let totalChange = 0;
    for (let i = 1; i < sortedScores.length; i++) {
      const change = sortedScores[i].overall - sortedScores[i - 1].overall;
      totalChange += Math.max(change, 0); // Only count improvements
    }

    return Math.round((totalChange / (sortedScores.length - 1)) * 10) / 10;
  }

  /**
   * Calculate trend for a specific dimension
   */
  private calculateTrend(
    dimension: CodeDimension | 'overall',
    values: number[],
    snapshots: ScoreSnapshot[]
  ): ScoreTrend {
    if (values.length < 2) {
      return {
        dimension,
        current: values[0] ?? 0,
        previous: 0,
        delta: 0,
        trend: 'stable',
        history: values,
        timestamps: snapshots.map(s => s.timestamp),
      };
    }

    const current = values[values.length - 1];
    const previous = values[values.length - 2] ?? current;
    const delta = current - previous;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (delta > TrendAnalyzer.SIGNIFICANT_CHANGE) trend = 'improving';
    else if (delta < -TrendAnalyzer.SIGNIFICANT_CHANGE) trend = 'declining';

    return {
      dimension,
      current,
      previous,
      delta,
      trend,
      history: values,
      timestamps: snapshots.map(s => s.timestamp),
    };
  }

  /**
   * Get regression severity based on score drop
   */
  private getRegressionSeverity(drop: number): 'minor' | 'moderate' | 'severe' {
    if (drop < 15) return 'minor';
    if (drop < 25) return 'moderate';
    return 'severe';
  }

  /**
   * Create empty analysis for insufficient data
   */
  private createEmptyAnalysis(scores: ScoreSnapshot[]): TrendAnalysis {
    const latest = scores[0];

    return {
      overallTrend: {
        dimension: 'overall',
        current: latest?.overall ?? 0,
        previous: latest?.overall ?? 0,
        delta: 0,
        trend: 'stable',
        history: latest ? [latest.overall] : [],
        timestamps: latest ? [latest.timestamp] : [],
      },
      dimensionTrends: {},
      regressions: [],
      improvements: [],
      velocity: 0,
      period: {
        start: latest?.timestamp ?? new Date(),
        end: latest?.timestamp ?? new Date(),
        snapshotCount: scores.length,
      },
    };
  }
}
