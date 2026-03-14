/**
 * Reporting Service Barrel Export
 *
 * Central exports for the reporting and history system.
 */

// Types
export type {
  ReportFormat,
  CodeDimension,
  ReportDimensionScore,
  ReportIssue,
  ExtendedProjectScore,
  ScoreSnapshot,
  ScoreTrend,
  Regression,
  Improvement,
  TrendAnalysis,
  TrendPrediction,
  Comparison,
  Report,
  HistoryStorage,
  ChartConfig,
  GaugeOptions,
  TrendDataPoint,
  BarChartData,
  ReportOptions,
  TestResultForReport,
  DimensionStatus,
  IssueSeverity,
} from './reporting.types.js';

// Services
export { ReportService } from './report.service.js';
export { HistoryService } from './history.service.js';
export { TrendAnalyzer } from './trend-analyzer.js';

// Templates
export { HtmlTemplate } from './templates/html.template.js';
export { MarkdownTemplate } from './templates/markdown.template.js';
export { JsonTemplate } from './templates/json.template.js';

// Export
export { ChartExporter, PdfExporter, PrintPdfExporter } from './export/index.js';
export type { PdfExportOptions } from './export/index.js';
