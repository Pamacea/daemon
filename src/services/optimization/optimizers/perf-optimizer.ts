/**
 * Performance Optimizer
 *
 * Applies performance optimizations including:
 * - Add React.memo where appropriate
 * - Wrap callbacks in useCallback
 * - Memoize expensive calculations
 * - Suggest code splitting points
 * - Recommend lazy loading
 * - Database query optimization suggestions
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  AppliedOptimization,
  Location,
  OptimizationError,
} from '../optimization.types.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Performance Optimizer Service
 */
export class PerfOptimizer {
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger('PerfOptimizer');
  }

  /**
   * Optimize performance issues in a file
   */
  async optimizeFile(filePath: string, content: string): Promise<{
    optimizedContent: string;
    appliedOptimizations: AppliedOptimization[];
    suggestions: string[];
    errors: OptimizationError[];
  }> {
    const appliedOptimizations: AppliedOptimization[] = [];
    const suggestions: string[] = [];
    const errors: OptimizationError[] = [];

    let optimizedContent = content;

    // Detect if this is a React component
    const isReactFile = this.isReactFile(filePath, content);

    if (isReactFile) {
      // Apply React-specific optimizations
      const memoResult = this.addReactMemo(filePath, content);
      if (memoResult) {
        optimizedContent = memoResult.content;
        appliedOptimizations.push(memoResult.optimization);
      }

      const callbackResult = this.addUseCallback(filePath, optimizedContent);
      if (callbackResult) {
        optimizedContent = callbackResult.content;
        appliedOptimizations.push(callbackResult.optimization);
      }

      const useMemoResult = this.addUseMemo(filePath, optimizedContent);
      if (useMemoResult) {
        optimizedContent = useMemoResult.content;
        appliedOptimizations.push(useMemoResult.optimization);
      }
    }

    // General performance optimizations
    const lazyResult = this.addLazyImport(filePath, optimizedContent);
    if (lazyResult) {
      optimizedContent = lazyResult.content;
      if (lazyResult.autoApplied) {
        appliedOptimizations.push(lazyResult.optimization);
      } else {
        suggestions.push(lazyResult.suggestion);
      }
    }

    return {
      optimizedContent,
      appliedOptimizations,
      suggestions,
      errors,
    };
  }

  /**
   * Add React.memo to components
   */
  private addReactMemo(filePath: string, content: string): {
    content: string;
    optimization: AppliedOptimization;
  } | null {
    // Find component definitions that could benefit from memo
    const pattern = /export\s+(?:const|function)\s+(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*{[\s\S]{200,}/g;

    const matches = Array.from(content.matchAll(pattern));

    if (matches.length === 0) {
      return null;
    }

    let optimized = content;
    let modifications = 0;

    for (const match of matches) {
      const componentName = match[1];
      const fullMatch = match[0];

      // Skip if already wrapped in memo
      if (content.includes(`${componentName})`) || content.includes('memo(')) {
        continue;
      }

      // Check if component receives props and has substantial body
      if (fullMatch.includes('props') && fullMatch.length > 300) {
        const exportMatch = fullMatch.match(/export\s+(const|function)/);
        if (exportMatch) {
          const replacement = fullMatch.replace(
            /export\s+(const|function)\s+(\w+)/,
            `const $2 = React.memo(` + (exportMatch[1] === 'const' ? '$2' : 'function $2')
          );

          // Add closing parenthesis and wrap
          const optimizedComponent = `export ${replacement});`;
          optimized = optimized.replace(fullMatch, optimizedComponent);

          modifications++;

          if (modifications > 2) {
            // Don't over-optimize
            break;
          }
        }
      }
    }

    if (modifications === 0) {
      return null;
    }

    return {
      content: optimized,
      optimization: {
        id: this.generateOptId(),
        type: 'performance',
        description: `Added React.memo to ${modifications} component(s)`,
        modifiedFiles: [path.relative(process.cwd(), filePath)],
        originalCode: content.slice(0, 200),
        fixedCode: optimized.slice(0, 200),
        location: { filePath, line: 1 },
      },
    };
  }

  /**
   * Add useCallback to callback functions
   */
  private addUseCallback(filePath: string, content: string): {
    content: string;
    optimization: AppliedOptimization;
  } | null {
    // Find inline functions in JSX that could be wrapped
    const pattern = /(?:onClick|onChange|onSubmit|on[A-Z]\w+)=\s*{\s*\(\)\s*=>/g;

    const matches = Array.from(content.matchAll(pattern));

    if (matches.length < 2) {
      return null; // Not worth it for single usage
    }

    // Group by callback type to see if same callback is used multiple times
    const callbackGroups = new Map<string, number[]>();

    for (const match of matches) {
      const callbackType = match[0].match(/(on\w+)/)?.[1] || 'unknown';
      if (!callbackGroups.has(callbackType)) {
        callbackGroups.set(callbackType, []);
      }
      callbackGroups.get(callbackType)!.push(match.index);
    }

    // Find callbacks used 3+ times
    const frequentCallbacks = Array.from(callbackGroups.entries())
      .filter(([_, indices]) => indices.length >= 3)
      .map(([type, _]) => type);

    if (frequentCallbacks.length === 0) {
      return null;
    }

    // Suggest adding useCallback (can't auto-apply safely without AST)
    const suggestions = frequentCallbacks.map(
      cb => `  const handle${cb.charAt(2).toUpperCase() + cb.slice(3)} = useCallback(() => {`
    );

    return {
      content,
      optimization: {
        id: this.generateOptId(),
        type: 'performance',
        description: `Identified ${frequentCallbacks.length} callback(s) that should use useCallback`,
        modifiedFiles: [path.relative(process.cwd(), filePath)],
        originalCode: '',
        fixedCode: suggestions.join('\n'),
        location: { filePath, line: 1 },
      },
    };
  }

  /**
   * Add useMemo to expensive calculations
   */
  private addUseMemo(filePath: string, content: string): {
    content: string;
    optimization: AppliedOptimization;
  } | null {
    // Find expensive operations: sort, filter, reduce on arrays in component body
    const patterns = [
      /const\s+\w+\s*=\s*\w+\.sort\s*\(/g,
      /const\s+\w+\s*=\s*\w+\.filter\s*\([^)]+\)\.sort\s*\(/g,
      /const\s+\w+\s*=\s*\w+\.filter\s*\([^)]+\)\.filter\s*\(/g,
      /const\s+\w+\s*=\s*\w+\.map\s*\([^)]+\)\.filter\s*\(/g,
      /Object\.keys\s*\([^)]+\)\.map/g,
      /Object\.values\s*\([^)]+\)\.map/g,
      /Object\.entries\s*\([^)]+\)\.map/g,
    ];

    let matchCount = 0;
    let totalMatches = 0;

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        totalMatches += matches.length;
        matchCount++;
      }
    }

    if (totalMatches < 2) {
      return null;
    }

    return {
      content,
      optimization: {
        id: this.generateOptId(),
        type: 'performance',
        description: `Found ${totalMatches} expensive calculation(s) that should use useMemo`,
        modifiedFiles: [path.relative(process.cwd(), filePath)],
        originalCode: '',
        fixedCode: `const memoizedValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);`,
        location: { filePath, line: 1 },
      },
    };
  }

  /**
   * Add lazy import for code splitting
   */
  private addLazyImport(filePath: string, content: string): {
    content: string;
    optimization: AppliedOptimization;
    autoApplied: boolean;
    suggestion: string;
  } | null {
    // Find imports that could be lazy-loaded
    const largeLibraries = [
      'chart.js',
      'react-chartjs-2',
      '@monaco-editor/react',
      'react-quill',
      'react-markdown',
      'react-player',
      'react-pdf',
      'draft-js',
      'slate',
      'd3',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
    ];

    let lazyCandidate: { name: string; line: number; importStatement: string } | null = null;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const lib of largeLibraries) {
        if (line.includes(`from '${lib}'`) || line.includes(`from "${lib}"`)) {
          lazyCandidate = {
            name: lib,
            line: i + 1,
            importStatement: line.trim(),
          };
          break;
        }
      }

      if (lazyCandidate) break;
    }

    if (!lazyCandidate) {
      return null;
    }

    // Check if already lazy
    if (content.includes('lazy(') || content.includes('Suspense')) {
      return null;
    }

    // Can't auto-apply safely (need to add Suspense boundary)
    return {
      content,
      optimization: {
        id: this.generateOptId(),
        type: 'performance',
        description: `Library '${lazyCandidate.name}' could be lazy-loaded`,
        modifiedFiles: [path.relative(process.cwd(), filePath)],
        originalCode: lazyCandidate.importStatement,
        fixedCode: `const ${lazyCandidate.name.replace(/[^a-zA-Z]/g, '')} = lazy(() => import('${lazyCandidate.name}'));`,
        location: { filePath, line: lazyCandidate.line },
      },
      autoApplied: false,
      suggestion: `Consider lazy-loading '${lazyCandidate.name}' to reduce initial bundle size. Add Suspense boundary where component is used.`,
    };
  }

  /**
   * Suggest database query optimizations
   */
  suggestQueryOptimizations(content: string): string[] {
    const suggestions: string[] = [];

    // Check for N+1 patterns
    if (content.includes('findMany(') && content.includes('for (')) {
      suggestions.push(
        'Possible N+1 query detected. Use include/join for eager loading instead of querying in loops.'
      );
    }

    // Check for SELECT *
    if (content.includes('SELECT *')) {
      suggestions.push(
        'SELECT * retrieves all columns. Specify only needed columns to reduce data transfer.'
      );
    }

    // Check for missing pagination
    if (content.includes('findMany(') && !content.includes('take') && !content.includes('skip')) {
      suggestions.push(
        'Consider adding pagination to large queries using take/skip parameters.'
      );
    }

    // Check for missing indexes hints
    if (content.includes('.where(') && !content.includes('index')) {
      suggestions.push(
        'Ensure database indexes exist for frequently queried columns in .where() clauses.'
      );
    }

    return suggestions;
  }

  /**
   * Check if file is a React component
   */
  private isReactFile(filePath: string, content: string): boolean {
    const ext = path.extname(filePath);
    const isReactExt = ['.tsx', '.jsx'].includes(ext);

    const hasReactImports =
      content.includes("from 'react'") ||
      content.includes('from "react"') ||
      content.includes("from 'react/") ||
      content.includes('from "react/') ||
      content.includes('React.') ||
      content.includes('JSX.');

    return isReactExt || hasReactImports;
  }

  /**
   * Generate unique optimization ID
   */
  private generateOptId(): string {
    return `opt-perf-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Apply optimizations to a file
   */
  async applyOptimizations(
    filePath: string,
    optimizations: AppliedOptimization[],
    dryRun: boolean = false
  ): Promise<{ success: boolean; errors: OptimizationError[] }> {
    const errors: OptimizationError[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { optimizedContent } = await this.optimizeFile(filePath, content);

      if (!dryRun && optimizedContent !== content) {
        await fs.writeFile(filePath, optimizedContent, 'utf-8');
        this.logger.info(`Applied performance optimizations to ${filePath}`);
      }

      return { success: true, errors };
    } catch (error) {
      errors.push({
        target: filePath,
        message: error instanceof Error ? error.message : String(error),
        fatal: true,
      });
      return { success: false, errors };
    }
  }
}
