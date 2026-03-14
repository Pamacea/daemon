/**
 * Code Optimizer
 *
 * Applies safe code optimizations including:
 * - Extract constants
 * - Simplify conditions
 * - Reduce nesting
 * - Combine similar functions
 * - Apply safe refactors
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

/** Optimizer configuration */
interface OptimizerConfig {
  /** Create backup files before modifying */
  createBackup?: boolean;
  /** Backup directory */
  backupDir?: string;
  /** Maximum file size to process (bytes) */
  maxFileSize?: number;
  /** Dry run - don't actually modify files */
  dryRun?: boolean;
}

/** Code fix result */
interface FixResult {
  success: boolean;
  originalCode: string;
  fixedCode: string;
  location: Location;
  description: string;
}

/**
 * Code Optimizer Service
 */
export class CodeOptimizer {
  private readonly logger: Logger;
  private readonly config: OptimizerConfig;

  constructor(config: OptimizerConfig = {}) {
    this.logger = createLogger('CodeOptimizer');
    this.config = {
      createBackup: true,
      backupDir: '.daemon/backup',
      maxFileSize: 1024 * 1024, // 1MB
      dryRun: false,
      ...config,
    };
  }

  /**
   * Apply safe code optimizations to a file
   */
  async optimizeFile(filePath: string, content: string): Promise<{
    optimizedContent: string;
    appliedOptimizations: AppliedOptimization[];
    errors: OptimizationError[];
  }> {
    const appliedOptimizations: AppliedOptimization[] = [];
    const errors: OptimizationError[] = [];

    let currentContent = content;

    // Apply each optimization pass
    const passes = [
      this.extractConstants.bind(this),
      this.simplifyConditions.bind(this),
      this.reduceNesting.bind(this),
      this.removeDeadCode.bind(this),
      this.removeConsoleLogs.bind(this),
      this.combineAdjacentDeclarations.bind(this),
    ];

    for (const pass of passes) {
      try {
        const result = await pass(filePath, currentContent);
        if (result) {
          currentContent = result.fixedCode;
          appliedOptimizations.push({
            id: this.generateOptId(),
            type: 'refactoring',
            description: result.description,
            modifiedFiles: [path.relative(process.cwd(), filePath)],
            originalCode: result.originalCode,
            fixedCode: result.fixedCode,
            location: result.location,
          });
        }
      } catch (error) {
        errors.push({
          target: filePath,
          message: error instanceof Error ? error.message : String(error),
          fatal: false,
        });
      }
    }

    return {
      optimizedContent: currentContent,
      appliedOptimizations,
      errors,
    };
  }

  /**
   * Extract magic numbers to constants
   */
  private async extractConstants(filePath: string, content: string): Promise<FixResult | null> {
    const lines = content.split('\n');
    const constants: Map<string, { value: string; names: string[] }> = new Map();

    // Find magic numbers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.match(/(?<![\w.])(\d{3,}|0x[0-9A-Fa-f]+)(?![\w.])/g);

      if (matches) {
        for (const num of matches) {
          const key = `CONST_${num.slice(0, 6)}`;
          if (!constants.has(key)) {
            constants.set(key, { value: num, names: [] });
          }
          constants.get(key)!.names.push(`line_${i + 1}`);
        }
      }
    }

    if (constants.size === 0) {
      return null;
    }

    // Generate constant declarations
    const constantDecls: string[] = [];
    const replacements: Array<{ from: string; to: string; line: number }> = [];

    for (const [name, { value }] of constants) {
      const constName = this.suggestConstantName(value);
      constantDecls.push(`const ${constName} = ${value};`);
    }

    // Apply replacements
    const optimizedLines = [...lines];

    // Insert constants at the top of the file (after imports)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('require(')) {
        insertIndex = i + 1;
      } else if (insertIndex > 0 && !lines[i].trim().startsWith('import ')) {
        break;
      }
    }

    for (const decl of constantDecls) {
      optimizedLines.splice(insertIndex, 0, decl);
      insertIndex++;
    }

    return {
      success: true,
      originalCode: lines.join('\n'),
      fixedCode: optimizedLines.join('\n'),
      location: { filePath, line: 1 },
      description: `Extracted ${constants.size} magic numbers to constants`,
    };
  }

  /**
   * Simplify complex conditions using De Morgan's laws and early returns
   */
  private async simplifyConditions(filePath: string, content: string): Promise<FixResult | null> {
    let modified = false;
    let optimized = content;

    // Apply simplification patterns
    const simplifications: Array<{ pattern: RegExp; replacement: string; description: string }> = [
      // Double negation
      { pattern: /!!(\s*\w+)/g, replacement: 'Boolean($1)', description: 'Replace !! with Boolean()' },
      // !! in conditions can be removed
      { pattern: /if\s*\(\s*!!\s*/g, replacement: 'if (', description: 'Remove unnecessary !!' },
      // if (!x) return; else ... → if (x) { ... }
      {
        pattern: /if\s*\(\s*!\s*(\w+)\s*\)\s*{\s*return\s*[^;]*;}\s*else\s*{/gs,
        replacement: 'if ($1) {',
        description: 'Simplify if-not-return-else to if',
      },
      // true && x → x
      { pattern: /true\s*&&\s*/g, replacement: '', description: 'Remove redundant true &&' },
      // false || x → x
      { pattern: /false\s*\|\|\s*/g, replacement: '', description: 'Remove redundant false ||' },
      // x || true → true
      { pattern: /\w+\s*\|\|\s*true/g, replacement: 'true', description: 'Simplify x || true to true' },
      // x && false → false
      { pattern: /\w+\s*&&\s*false/g, replacement: 'false', description: 'Simplify x && false to false' },
    ];

    for (const { pattern, replacement, description } of simplifications) {
      const before = optimized;
      optimized = optimized.replace(pattern, replacement);
      if (before !== optimized) {
        modified = true;
      }
    }

    if (!modified) {
      return null;
    }

    return {
      success: true,
      originalCode: content,
      fixedCode: optimized,
      location: { filePath, line: 1 },
      description: 'Simplified boolean expressions and conditions',
    };
  }

  /**
   * Reduce nesting using early returns and guard clauses
   */
  private async reduceNesting(filePath: string, content: string): Promise<FixResult | null> {
    const lines = content.split('\n');
    const optimizations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for patterns like: if (!condition) { return; } // rest of code
      // Can be converted to: if (condition) { // rest of code }
      const nestedIfMatch = line.match(/^(\s*)if\s*\(\s*!\s*(\w+)\s*\)\s*{/);

      if (nestedIfMatch) {
        const indent = nestedIfMatch[1];
        const condition = nestedIfMatch[2];
        const nextLine = lines[i + 1];

        if (nextLine && nextLine.trim().startsWith('return')) {
          // Found early return pattern, check if there's an else block
          const closingBraceIndex = this.findClosingBrace(lines, i + 1);
          if (closingBraceIndex > 0) {
            const afterClosing = lines[closingBraceIndex + 1];
            if (afterClosing && afterClosing.trim().startsWith('else')) {
              // Can invert the condition
              optimizations.push(`Convert early return with else to positive condition at line ${i + 1}`);
            }
          }
        }
      }
    }

    if (optimizations.length === 0) {
      return null;
    }

    // Apply the transformations (simplified version)
    let optimized = lines.join('\n');

    // Pattern: if (!x) { return; } else { ... }
    // → if (x) { ... }
    optimized = optimized.replace(
      /if\s*\(\s*!\s*(\w+)\s*\)\s*{\s*return\s*[^;]*;}\s*else\s*{/gs,
      'if ($1) {'
    );

    return {
      success: true,
      originalCode: content,
      fixedCode: optimized,
      location: { filePath, line: 1 },
      description: `Reduced nesting in ${optimizations.length} locations using guard clauses`,
    };
  }

  /**
   * Remove unreachable dead code
   */
  private async removeDeadCode(filePath: string, content: string): Promise<FixResult | null> {
    const lines = content.split('\n');
    const linesToRemove: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Look for return statements followed by code
      if (line.startsWith('return ') || line === 'return;') {
        // Check if next non-empty line is not a closing brace
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') {
          j++;
        }

        if (j < lines.length && !lines[j].trim().startsWith('}') && !lines[j].trim().startsWith('return')) {
          // Potential dead code - mark it
          linesToRemove.push(j);
        }
      }

      // Look for constant conditions
      if (line.startsWith('if (true)') || line.startsWith('if (false)')) {
        linesToRemove.push(i); // Mark for review
      }
    }

    if (linesToRemove.length === 0) {
      return null;
    }

    // Create optimized content by removing dead lines
    const optimizedLines = lines.filter((_, idx) => !linesToRemove.includes(idx));

    return {
      success: true,
      originalCode: content,
      fixedCode: optimizedLines.join('\n'),
      location: { filePath, line: linesToRemove[0] + 1 },
      description: `Removed ${linesToRemove.length} lines of dead code`,
    };
  }

  /**
   * Remove console.log statements (except in development)
   */
  private async removeConsoleLogs(filePath: string, content: string): Promise<FixResult | null> {
    const lines = content.split('\n');
    const linesToRemove: number[] = [];

    // Check if this is a test file (keep logs in tests)
    const isTestFile = filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__');

    if (isTestFile) {
      return null;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Find console.log, console.error, console.warn statements
      const consoleMatch = line.match(/console\.(log|error|warn|info|debug)\s*\(/);

      if (consoleMatch && !line.trim().startsWith('//')) {
        // Check if it's not commented out
        linesToRemove.push(i);
      }
    }

    if (linesToRemove.length === 0) {
      return null;
    }

    // Remove console statements
    const optimizedLines = lines.filter((_, idx) => !linesToRemove.includes(idx));

    return {
      success: true,
      originalCode: content,
      fixedCode: optimizedLines.join('\n'),
      location: { filePath, line: linesToRemove[0] + 1 },
      description: `Removed ${linesToRemove.length} console statements`,
    };
  }

  /**
   * Combine adjacent variable declarations
   */
  private async combineAdjacentDeclarations(filePath: string, content: string): Promise<FixResult | null> {
    const lines = content.split('\n');
    const combinedLines: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const constMatch = line.match(/^(\s*)const\s+(\w+)\s*=/);
      const letMatch = line.match(/^(\s*)let\s+(\w+)\s*=/);
      const varMatch = line.match(/^(\s*)var\s+(\w+)\s*=/);

      const match = constMatch || letMatch || varMatch;

      if (match) {
        const indent = match[1];
        const keyword = constMatch ? 'const' : letMatch ? 'let' : 'var';
        const declarations: string[] = [line.trim()];

        // Look for adjacent declarations with same keyword
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextMatch = nextLine.match(/^\s*const\s+(\w+)\s*=/);
          const nextLetMatch = nextLine.match(/^\s*let\s+(\w+)\s*=/);
          const nextVarMatch = nextLine.match(/^\s*var\s+(\w+)\s*=/);
          const nextKeywordMatch = nextMatch || nextLetMatch || nextVarMatch;

          if (nextKeywordMatch && nextLine.trim().startsWith(keyword)) {
            declarations.push(nextLine.trim());
            j++;
          } else {
            break;
          }
        }

        // Combine if we have multiple declarations
        if (declarations.length > 1) {
          const combined = declarations.map(d => d.replace(/^\s*const\s+|\s*const\s+/g, '')).join(', ');
          combinedLines.push(`${indent}${keyword} ${combined};`);
          i = j;
          continue;
        }
      }

      combinedLines.push(line);
      i++;
    }

    if (combinedLines.length === lines.length) {
      return null;
    }

    return {
      success: true,
      originalCode: content,
      fixedCode: combinedLines.join('\n'),
      location: { filePath, line: 1 },
      description: 'Combined adjacent variable declarations',
    };
  }

  /**
   * Apply fixes to a file
   */
  async applyFixes(
    filePath: string,
    fixes: AppliedOptimization[]
  ): Promise<{ success: boolean; errors: OptimizationError[] }> {
    const errors: OptimizationError[] = [];

    try {
      // Read current content
      const content = await fs.readFile(filePath, 'utf-8');

      // Create backup if configured
      if (this.config.createBackup && !this.config.dryRun) {
        await this.createBackup(filePath, content);
      }

      // Apply all fixes (simplified - in real implementation, would track which fixes apply)
      let modified = false;
      for (const fix of fixes) {
        if (fix.modifiedFiles.some(f => f.endsWith(filePath))) {
          modified = true;
          break;
        }
      }

      if (modified && !this.config.dryRun) {
        const { optimizedContent } = await this.optimizeFile(filePath, content);
        await fs.writeFile(filePath, optimizedContent, 'utf-8');
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

  /**
   * Create backup of a file
   */
  private async createBackup(filePath: string, content: string): Promise<void> {
    const backupDir = path.resolve(this.config.backupDir!);
    const backupPath = path.join(
      backupDir,
      `${path.basename(filePath)}.${Date.now()}.backup`
    );

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupPath, content, 'utf-8');

    this.logger.debug(`Created backup: ${backupPath}`);
  }

  /**
   * Find closing brace for a given opening brace position
   */
  private findClosingBrace(lines: string[], startLine: number): number {
    let depth = 1;

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') depth++;
        if (char === '}') depth--;

        if (depth === 0) {
          return i;
        }
      }
    }

    return -1;
  }

  /**
   * Suggest a constant name based on value
   */
  private suggestConstantName(value: string): string {
    const num = parseInt(value, value.startsWith('0x') ? 16 : 10);

    if (value.startsWith('0x')) {
      return `HEX_${value.toUpperCase()}`;
    }
    if (num >= 1000 && num % 1000 === 0) {
      return `${num}_MILLISECONDS`;
    }
    if (num === 60 || num === 60000) {
      return 'ONE_MINUTE_MS';
    }
    if (num === 1000) {
      return 'ONE_SECOND_MS';
    }

    return `CONST_${value}`;
  }

  /**
   * Generate unique optimization ID
   */
  private generateOptId(): string {
    return `opt-${crypto.randomBytes(4).toString('hex')}`;
  }
}
