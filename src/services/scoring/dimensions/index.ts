/**
 * Dimension Analyzers
 *
 * Exports all dimension analyzers for the scoring system.
 * Each analyzer evaluates a specific aspect of code quality.
 *
 * @module services/scoring/dimensions
 */

// Test Coverage Dimension
export { TestCoverageAnalyzer, testCoverageAnalyzer } from './test-coverage.analyzer.js';

// Code Quality Dimension
export { CodeQualityAnalyzer, codeQualityAnalyzer } from './code-quality.analyzer.js';

// Performance Dimension
export { PerformanceAnalyzer, performanceAnalyzer } from './performance.analyzer.js';

// Security Dimension
export { SecurityAnalyzer, securityAnalyzer } from './security.analyzer.js';

// Accessibility Dimension
export { AccessibilityAnalyzer, accessibilityAnalyzer } from './accessibility.analyzer.js';

// UI/UX Dimension
export { UiUxAnalyzer, uiUxAnalyzer } from './ui-ux.analyzer.js';

// Backend Logic Dimension
export { BackendLogicAnalyzer, backendLogicAnalyzer } from './backend-logic.analyzer.js';

// Business Logic Dimension
export { BusinessLogicAnalyzer, businessLogicAnalyzer } from './business-logic.analyzer.js';

// SEO Dimension
export { SeoAnalyzer, seoAnalyzer } from './seo.analyzer.js';
