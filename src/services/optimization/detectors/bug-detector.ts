/**
 * Bug Detector
 *
 * Detects various bugs in code including:
 * - Memory leaks (useState, useEffect patterns)
 * - Race conditions (async/await without proper handling)
 * - Null/undefined errors (missing guards)
 * - Infinite loops (recursive calls)
 * - Missing error handling (try/catch)
 * - SQL/NoSQL injection patterns
 * - XSS vulnerabilities (innerHTML, dangerouslySetInnerHTML)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  BugType,
  DetectedBug,
  DetectionOptions,
  Location,
  Severity,
} from '../optimization.types.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/** Regex patterns for bug detection */
const BUG_PATTERNS: Record<
  BugType,
  Array<{
    pattern: RegExp;
    severity: Severity;
    description: string;
    fix: string;
  }>
> = {
  'memory-leak': [
    {
      pattern: /useEffect\s*\(\s*\(\)\s*=>\s*{[\s\S]*?(?:addEventListener|setInterval|setTimeout|subscribe)[\s\S]*?},\s*\[\s*\]\s*\)/gs,
      severity: 'high',
      description: 'Missing cleanup function in useEffect with event listener or timer',
      fix: 'Return a cleanup function: () => {.removeEventListener(...) / clearInterval(...)}',
    },
    {
      pattern: /setInterval\s*\(\s*\(\)\s*=>\s*{[\s\S]*?useState\(|[\s\S]*?setState\(/gs,
      severity: 'high',
      description: 'Potential stale closure in setInterval - state may not update',
      fix: 'Use useRef to hold current state value',
    },
    {
      pattern: /useCallback\s*\(\s*\(\)\s*=>\s*{[\s\S]*?},\s*\[\s*\]\s*\)[\s\S]*?useEffect/gs,
      severity: 'medium',
      description: 'useCallback with empty deps used in useEffect may cause stale closure',
      fix: 'Include all dependencies in useCallback dependency array',
    },
  ],
  'race-condition': [
    {
      pattern: /\w+State\([\w\s,()]*\)\s*;\s*\w+State\([\w\s,()]*\+\s*1\)\s*;/gs,
      severity: 'high',
      description: 'Multiple state updates based on old state can cause race conditions',
      fix: 'Use functional updates: setState(prev => prev + 1)',
    },
    {
      pattern: /await\s+[^;]+;\s*await\s+[^;]+(?:\w+\s*=)\s*result/gs,
      severity: 'medium',
      description: 'Sequential async operations that could run in parallel',
      fix: 'Use Promise.all() for parallel execution',
    },
    {
      pattern: /for\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)\s*{[\s\S]*?await\s+/gs,
      severity: 'medium',
      description: 'Sequential awaits in loop - consider Promise.all for better performance',
      fix: 'Collect promises and use Promise.all()',
    },
  ],
  'null-reference': [
    {
      pattern: /(?:\w+\.\w+\s*\?\?\s*undefined|\w+\?\.\w+\s*\|\|[^|]|\w+\.\w+\s*\|\|\s*\w+\.\w+)/gs,
      severity: 'medium',
      description: 'Potential null/undefined access without proper guard',
      fix: 'Use optional chaining (?.) or nullish coalescing (??) consistently',
    },
    {
      pattern: /const\s+{\s*\w+\s*}\s*=\s*(?:req\.body|req\.query|req\.params|formData\(\)|JSON\.parse)/gs,
      severity: 'high',
      description: 'Destructuring without validation - may cause undefined errors',
      fix: 'Validate input before destructuring or use default values',
    },
    {
      pattern: /\[\d+\](?!\s*\?\?)/gs,
      severity: 'low',
      description: 'Array access without bounds checking',
      fix: 'Check array length before accessing or use .at() with safe defaults',
    },
  ],
  'infinite-loop': [
    {
      pattern: /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/gs,
      severity: 'high',
      description: 'Infinite loop detected - ensure there is a break condition',
      fix: 'Add proper termination condition or break statement',
    },
    {
      pattern: /function\s+\w+\s*\([^)]*\)\s*{[\s\S]{0,500}return\s+\w+\([^)]*\)[\s\S]*?}/gs,
      severity: 'critical',
      description: 'Possible infinite recursion - no base case detected',
      fix: 'Add base case to prevent stack overflow',
    },
    {
      pattern: /useEffect\s*\(\s*\(\)\s*=>\s*{[\s\S]*?setState\([\s\S]*?},\s*\[\s*\]\s*\)/gs,
      severity: 'critical',
      description: 'useEffect with setState and empty deps will cause infinite loop',
      fix: 'Add state to dependency array or use functional update',
    },
  ],
  'missing-error-handling': [
    {
      pattern: /await\s+(?:fetch|axios|\w+\.fetch|\w+\.get|\w+\.post|\w+\.query)(?:\([^)]*\))?(?!\s*\.\s*catch|[\s\S]*?try\s*{)/gs,
      severity: 'high',
      description: 'Async operation without error handling',
      fix: 'Wrap in try/catch or add .catch() handler',
    },
    {
      pattern: /JSON\.parse\s*\([^)]+\)(?!\s*(?:\?\s*\.|try|\.catch))/gs,
      severity: 'high',
      description: 'JSON.parse without try/catch can throw on invalid JSON',
      fix: 'Wrap in try/catch block',
    },
    {
      pattern: /\.then\s*\([^)]*\)\s*(?!\.catch)/gs,
      severity: 'medium',
      description: 'Promise chain without .catch() handler',
      fix: 'Add .catch() to handle rejections',
    },
  ],
  'sql-injection': [
    {
      pattern: /(?:SELECT|INSERT|UPDATE|DELETE)\s+(?:(?!prepare|execute|escape|\$\d|\?|\$\w+\s*=>).)*?(?:\+\s*[^;]+|`\s*\$\s*{|`[^`]*\s*\$\s*{)/gsi,
      severity: 'critical',
      description: 'Possible SQL injection via string concatenation or template literal',
      fix: 'Use parameterized queries or prepared statements',
    },
    {
      pattern: /query\s*\(\s*['"`][\s\S]*?\$\{[\s\S]*?\}['"`]\s*/gs,
      severity: 'critical',
      description: 'SQL query with template literal interpolation',
      fix: 'Use parameterized queries with placeholders',
    },
    {
      pattern: /db\.(?:exec|query|run)\s*\(\s*[^;]*?\+\s*/gs,
      severity: 'critical',
      description: 'SQL query built with string concatenation',
      fix: 'Use prepared statements with parameter binding',
    },
  ],
  'xss': [
    {
      pattern: /\.innerHTML\s*=\s*(?!.*DOMPurify|sanitize)/gs,
      severity: 'critical',
      description: 'XSS vulnerability: innerHTML assignment without sanitization',
      fix: 'Use textContent or sanitize with DOMPurify',
    },
    {
      pattern: /dangerouslySetInnerHTML\s*=\s*{\s*__html:\s*[^}]+}(?![\s\S]*?DOMPurify|sanitize)/gs,
      severity: 'high',
      description: 'React dangerouslySetInnerHTML without sanitization',
      fix: 'Sanitize HTML with DOMPurify before rendering',
    },
    {
      pattern: /document\.write\s*\(/gs,
      severity: 'critical',
      description: 'document.write() is vulnerable to XSS',
      fix: 'Use DOM manipulation methods like appendChild',
    },
    {
      pattern: /eval\s*\(|new\s+Function\s*\(/gs,
      severity: 'high',
      description: 'eval() or new Function() can lead to code injection',
      fix: 'Avoid eval - use safer alternatives',
    },
  ],
  'missing-validation': [
    {
      pattern: /(?:req\.body|req\.query|req\.params|formData\(\)|URLSearchParams)\.[a-zA-Z_][a-zA-Z0-9_]*(?!\s*(?:\.\s*(?:validate|parse|safeParse|schema)|\|\||\?\s*\.|!))/gs,
      severity: 'high',
      description: 'Direct use of user input without validation',
      fix: 'Validate with schema library (Zod, Yup, Joi)',
    },
    {
      pattern: /localStorage\.(?:getItem|setItem)\s*\([^)]+\)(?![\s\S]*?validate|parse)/gs,
      severity: 'medium',
      description: 'localStorage value used without validation',
      fix: 'Validate and parse localStorage values',
    },
  ],
  'unused-variable': [
    {
      pattern: /(?:const|let|var)\s+\w+\s*=\s*[^;]+;(?:\s*(?:const|let|var)\s+|[\s\S]{0,200}return)/gs,
      severity: 'low',
      description: 'Variable declared but potentially unused',
      fix: 'Remove unused variable or use it',
    },
    {
      pattern: /import\s+{[^}]+}\s+from\s+[^;]+;(?!.*(?:export|typeof|\w+\s*[,:]))/gs,
      severity: 'low',
      description: 'Import may be unused',
      fix: 'Remove unused import',
    },
  ],
  'dead-code': [
    {
      pattern: /return\s+[^;]+;[\s\S]{0,100}(?!return|if|switch|throw|try)/gs,
      severity: 'low',
      description: 'Unreachable code after return statement',
      fix: 'Remove dead code',
    },
    {
      pattern: /if\s*\(\s*(?:true|false|0|1|null|undefined)\s*\)/gs,
      severity: 'low',
      description: 'Conditional with constant value - dead code',
      fix: 'Remove dead branch or use actual condition',
    },
  ],
};

/**
 * Bug Detector Service
 */
export class BugDetector {
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger('BugDetector');
  }

  /**
   * Detect bugs in a single file
   */
  async detectInFile(
    filePath: string,
    content: string,
    options: DetectionOptions = {}
  ): Promise<DetectedBug[]> {
    const bugs: DetectedBug[] = [];
    const lines = content.split('\n');

    // Filter by bug types if specified
    const typesToCheck = options.bugTypes?.length
      ? options.bugTypes
      : (Object.keys(BUG_PATTERNS) as BugType[]);

    for (const bugType of typesToCheck) {
      const patterns = BUG_PATTERNS[bugType];
      if (!patterns) continue;

      for (const { pattern, severity, description, fix } of patterns) {
        const matches = this.findAllMatches(content, pattern);

        for (const match of matches) {
          const location = this.findLocation(content, match.start);

          // Check severity filter
          if (options.minSeverity && !this.isSeverityMatch(severity, options.minSeverity)) {
            continue;
          }

          const bug: DetectedBug = {
            id: this.generateBugId(filePath, bugType, location.line),
            type: bugType,
            severity,
            description,
            location: {
              filePath: path.relative(process.cwd(), filePath),
              line: location.line,
              column: location.column,
            },
            fixable: this.isFixable(bugType),
            suggestedFix: fix,
            codeSnippet: this.extractSnippet(lines, location.line, 3),
          };

          bugs.push(bug);
        }
      }
    }

    return bugs;
  }

  /**
   * Detect bugs across all files in a directory
   */
  async detectInDirectory(
    dirPath: string,
    options: DetectionOptions = {}
  ): Promise<DetectedBug[]> {
    const allBugs: DetectedBug[] = [];
    const files = await this.getRelevantFiles(dirPath, options);

    this.logger.info(`Scanning ${files.length} files for bugs...`);

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const bugs = await this.detectInFile(filePath, content, options);
        allBugs.push(...bugs);
      } catch (error) {
        this.logger.warn(`Failed to analyze ${filePath}:`, error);
      }
    }

    this.logger.info(`Found ${allBugs.length} bugs`);
    return allBugs;
  }

  /**
   * Get prioritized list of bugs
   */
  prioritizeBugs(bugs: DetectedBug[]): DetectedBug[] {
    const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };

    return bugs.sort((a, b) => {
      const severityDiff = severityWeight[b.severity] - severityWeight[a.severity];
      if (severityDiff !== 0) return severityDiff;

      // Prefer fixable bugs
      if (a.fixable && !b.fixable) return -1;
      if (!a.fixable && b.fixable) return 1;

      return 0;
    });
  }

  /**
   * Get bugs by severity
   */
  getBugsBySeverity(bugs: DetectedBug[], severity: Severity): DetectedBug[] {
    return bugs.filter(bug => bug.severity === severity);
  }

  /**
   * Get bugs by type
   */
  getBugsByType(bugs: DetectedBug[], type: BugType): DetectedBug[] {
    return bugs.filter(bug => bug.type === type);
  }

  /**
   * Get fixable bugs
   */
  getFixableBugs(bugs: DetectedBug[]): DetectedBug[] {
    return bugs.filter(bug => bug.fixable);
  }

  /**
   * Generate statistics summary
   */
  generateSummary(bugs: DetectedBug[]): {
    total: number;
    bySeverity: Record<Severity, number>;
    byType: Record<BugType, number>;
    fixable: number;
  } {
    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const byType: Record<string, number> = {};

    for (const bug of bugs) {
      bySeverity[bug.severity]++;
      byType[bug.type] = (byType[bug.type] || 0) + 1;
    }

    return {
      total: bugs.length,
      bySeverity,
      byType: byType as Record<BugType, number>,
      fixable: bugs.filter(b => b.fixable).length,
    };
  }

  /**
   * Find all regex matches in content with their positions
   */
  private findAllMatches(content: string, pattern: RegExp): Array<{ start: number; end: number; text: string }> {
    const matches: Array<{ start: number; end: number; text: string }> = [];
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(content)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      });
    }

    return matches;
  }

  /**
   * Find line and column for a position in content
   */
  private findLocation(content: string, position: number): { line: number; column: number } {
    const before = content.substring(0, position);
    const lines = before.split('\n');

    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  /**
   * Generate unique bug ID
   */
  private generateBugId(filePath: string, type: BugType, line: number): string {
    const hash = Buffer.from(`${filePath}:${type}:${line}`).toString('base64').slice(0, 8);
    return `bug-${type}-${hash}`;
  }

  /**
   * Check if bug type is auto-fixable
   */
  private isFixable(type: BugType): boolean {
    return ['dead-code', 'unused-variable', 'missing-validation'].includes(type);
  }

  /**
   * Check if severity matches minimum requirement
   */
  private isSeverityMatch(severity: Severity, minSeverity: Severity): boolean {
    const order: Severity[] = ['critical', 'high', 'medium', 'low'];
    return order.indexOf(severity) <= order.indexOf(minSeverity);
  }

  /**
   * Extract code snippet around a line
   */
  private extractSnippet(lines: string[], targetLine: number, context: number): string {
    const start = Math.max(0, targetLine - context - 1);
    const end = Math.min(lines.length, targetLine + context);

    return lines
      .slice(start, end)
      .map((line, idx) => {
        const lineNum = start + idx + 1;
        const prefix = lineNum === targetLine ? '>>> ' : '    ';
        return `${prefix}${lineNum}: ${line}`;
      })
      .join('\n');
  }

  /**
   * Get relevant files to scan
   */
  private async getRelevantFiles(
    dirPath: string,
    options: DetectionOptions
  ): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];

    async function walk(currentPath: string) {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          // Skip node_modules and common exclusions
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '.next' ||
            entry.name === 'coverage'
          ) {
            continue;
          }

          // Check exclude patterns
          if (options.excludePatterns?.some(pattern => entry.name.match(pattern))) {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              // Check include patterns
              if (
                !options.includePatterns?.length ||
                options.includePatterns.some(pattern => entry.name.match(pattern))
              ) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await walk(dirPath);
    return files;
  }
}
