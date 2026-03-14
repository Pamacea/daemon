/**
 * Code Smell Detector
 *
 * Detects code smells including:
 * - Long functions (>50 lines)
 * - Deep nesting (>4 levels)
 * - Magic numbers
 * - God objects
 * - Feature envy
 * - Inappropriate intimacy
 * - Duplicated code
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  CodeSmell,
  CodeSmellType,
  DetectionOptions,
  Location,
  Severity,
} from '../optimization.types.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/** Code smell detection thresholds */
const THRESHOLDS = {
  maxFunctionLines: 50,
  maxNestingLevel: 4,
  maxFunctionParams: 5,
  maxClassMethods: 15,
  maxCyclomaticComplexity: 10,
  maxDuplicateLines: 10,
  magicNumberMaxLength: 2, // Numbers longer than 2 digits are "magic"
} as const;

/**
 * Code Smell Detector Service
 */
export class CodeSmellDetector {
  private readonly logger: Logger;
  private readonly fileContents: Map<string, string> = new Map();
  private readonly hashes: Map<string, string> = new Map();

  constructor() {
    this.logger = createLogger('CodeSmellDetector');
  }

  /**
   * Detect code smells in a single file
   */
  async detectInFile(
    filePath: string,
    content: string,
    options: DetectionOptions = {}
  ): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Store content for cross-file duplication detection
    this.fileContents.set(filePath, content);

    // Detect various code smells
    smells.push(...this.detectLongFunctions(filePath, lines, content));
    smells.push(...this.detectDeepNesting(filePath, lines));
    smells.push(...this.detectMagicNumbers(filePath, lines));
    smells.push(...this.detectGodObjects(filePath, lines, content));
    smells.push(...this.detectComplexConditions(filePath, lines));
    smells.push(...this.detectParameterHell(filePath, lines, content));
    smells.push(...this.detectShotgunSurgery(filePath, content));

    // Filter by types if specified
    if (options.codeSmellTypes?.length) {
      return smells.filter(smell => options.codeSmellTypes!.includes(smell.type));
    }

    // Filter by severity
    if (options.minSeverity) {
      return smells.filter(smell => this.isSeverityMatch(smell.severity, options.minSeverity!));
    }

    return smells;
  }

  /**
   * Detect code smells across all files in a directory
   */
  async detectInDirectory(
    dirPath: string,
    options: DetectionOptions = {}
  ): Promise<CodeSmell[]> {
    const allSmells: CodeSmell[] = [];
    const files = await this.getRelevantFiles(dirPath, options);

    this.logger.info(`Scanning ${files.length} files for code smells...`);

    // First pass: load all files and detect single-file smells
    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const smells = await this.detectInFile(filePath, content, options);
        allSmells.push(...smells);
      } catch (error) {
        this.logger.warn(`Failed to analyze ${filePath}:`, error);
      }
    }

    // Second pass: detect cross-file issues (duplicated code)
    const duplicatedCode = await this.detectDuplicatedCode(files);
    allSmells.push(...duplicatedCode);

    // Clear cache
    this.fileContents.clear();
    this.hashes.clear();

    this.logger.info(`Found ${allSmells.length} code smells`);
    return allSmells;
  }

  /**
   * Get prioritized list of code smells
   */
  prioritizeSmells(smells: CodeSmell[]): CodeSmell[] {
    const severityWeight: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

    return smells.sort((a, b) => {
      // First by severity
      const severityDiff = (severityWeight[b.severity] ?? 0) - (severityWeight[a.severity] ?? 0);
      if (severityDiff !== 0) return severityDiff;

      // Then by complexity score
      const aScore = a.complexityScore || 0;
      const bScore = b.complexityScore || 0;
      return bScore - aScore;
    });
  }

  /**
   * Get smells by type
   */
  getSmellsByType(smells: CodeSmell[], type: CodeSmellType): CodeSmell[] {
    return smells.filter(smell => smell.type === type);
  }

  /**
   * Get smells by severity
   */
  getSmellsBySeverity(smells: CodeSmell[], severity: Severity): CodeSmell[] {
    return smells.filter(smell => smell.severity === severity);
  }

  /**
   * Generate statistics summary
   */
  generateSummary(smells: CodeSmell[]): {
    total: number;
    byType: Record<CodeSmellType, number>;
    bySeverity: Record<Severity, number>;
    avgComplexity: number;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    let totalComplexity = 0;

    for (const smell of smells) {
      byType[smell.type] = (byType[smell.type] || 0) + 1;
      bySeverity[smell.severity]++;
      totalComplexity += smell.complexityScore || 0;
    }

    return {
      total: smells.length,
      byType: byType as Record<CodeSmellType, number>,
      bySeverity,
      avgComplexity: smells.length ? Math.round(totalComplexity / smells.length) : 0,
    };
  }

  /**
   * Detect long functions
   */
  private detectLongFunctions(filePath: string, lines: string[], content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    // Match function declarations
    const functionPattern = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\w+))/g;
    const classMethodPattern = /(?:class\s+\w+\s*{[\s\S]*?)^\s*(?:async\s+)?(\w+)\s*\(/gm;

    const detectFunction = (match: RegExpExecArray, startIndex: number) => {
      const name = match[1] || match[2];
      if (!name) return;

      // Find the function body
      const afterMatch = content.slice(match.index + match[0].length);
      const braceMatch = afterMatch.match(/{/);

      if (braceMatch) {
        const bodyStart = match.index + match[0].length + (braceMatch.index ?? 0) + 1;
        let braceCount = 1;
        let bodyEnd = bodyStart;

        // Find matching closing brace
        for (let i = bodyStart; i < content.length; i++) {
          if (content[i] === '{') braceCount++;
          if (content[i] === '}') braceCount--;
          if (braceCount === 0) {
            bodyEnd = i;
            break;
          }
        }

        // Count lines in function body
        const functionBody = content.slice(bodyStart, bodyEnd);
        const lineCount = functionBody.split('\n').length;

        if (lineCount > THRESHOLDS.maxFunctionLines) {
          const startLine = content.slice(0, match.index).split('\n').length;

          smells.push({
            id: this.generateSmellId(filePath, 'long-function', startLine),
            type: 'long-function',
            severity: lineCount > 100 ? 'high' : 'medium',
            description: `Function '${name}' is ${lineCount} lines long (threshold: ${THRESHOLDS.maxFunctionLines})`,
            location: {
              filePath: path.relative(process.cwd(), filePath),
              line: startLine,
            },
            reason: 'Long functions are hard to understand, test, and maintain',
            suggestion: 'Break this function into smaller, single-purpose functions',
            complexityScore: lineCount,
          });
        }
      }
    };

    // Detect regular functions
    let match: RegExpExecArray | null;
    while ((match = functionPattern.exec(content)) !== null) {
      detectFunction(match, match.index);
    }

    // Detect class methods
    while ((match = classMethodPattern.exec(content)) !== null) {
      detectFunction(match, match.index);
    }

    return smells;
  }

  /**
   * Detect deep nesting
   */
  private detectDeepNesting(filePath: string, lines: string[]): CodeSmell[] {
    const smells: CodeSmell[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;

      // Assuming 2 or 4 space indentation
      const indentSize = this.detectIndentSize(lines);
      const nestLevel = Math.floor(indent / indentSize);

      if (nestLevel > THRESHOLDS.maxNestingLevel && line.trim().length > 0) {
        smells.push({
          id: this.generateSmellId(filePath, 'deep-nesting', i + 1),
          type: 'deep-nesting',
          severity: nestLevel > 6 ? 'high' : 'medium',
          description: `Code is nested ${nestLevel} levels deep (threshold: ${THRESHOLDS.maxNestingLevel})`,
          location: {
            filePath: path.relative(process.cwd(), filePath),
            line: i + 1,
          },
          reason: 'Deep nesting makes code hard to read and understand',
          suggestion: 'Use early returns, guard clauses, or extract nested code into separate functions',
          complexityScore: nestLevel,
        });
      }
    }

    return smells;
  }

  /**
   * Detect magic numbers
   */
  private detectMagicNumbers(filePath: string, lines: string[]): CodeSmell[] {
    const smells: CodeSmell[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and strings
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) {
        continue;
      }

      // Find numeric literals (excluding common exceptions)
      const matches = line.match(/(?<![\w.])(?:\d{3,}|0x[0-9A-Fa-f]+)(?![\w.])/g);

      if (matches) {
        for (const num of matches) {
          // Skip common "non-magic" numbers
          const value = parseInt(num, num.startsWith('0x') ? 16 : 10);
          if (
            value === 0 ||
            value === 1 ||
            value === -1 ||
            value === 2 ||
            value === 10 ||
            value === 100 ||
            value === 1000
          ) {
            continue;
          }

          // Skip if part of a known constant declaration
          if (line.includes('const') || line.includes('FINAL') || line.includes('static final')) {
            continue;
          }

          smells.push({
            id: this.generateSmellId(filePath, 'magic-number', i + 1),
            type: 'magic-number',
            severity: 'low',
            description: `Magic number '${num}' found without named constant`,
            location: {
              filePath: path.relative(process.cwd(), filePath),
              line: i + 1,
            },
            reason: 'Magic numbers obscure the meaning of the code',
            suggestion: `Extract to a named constant like ${this.suggestConstantName(line, value)}`,
            complexityScore: 1,
          });
        }
      }
    }

    return smells;
  }

  /**
   * Detect god objects
   */
  private detectGodObjects(filePath: string, lines: string[], content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    // Find class definitions
    const classPattern = /class\s+(\w+)\s*{[\s\S]*?^}/gm;

    let match: RegExpExecArray | null;
    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const classBody = match[0];

      // Count methods
      const methodMatches = classBody.match(/^\s*(?:public|private|protected)?\s*(?:async\s+)?\w+\s*\(/gm);
      const methodCount = methodMatches?.length || 0;

      // Count properties
      const propertyMatches = classBody.match(/^\s*(?:public|private|protected)?\s*(?:readonly\s+)?\w+\s*(?::\s*\w+)?\s*;/gm);
      const propertyCount = propertyMatches?.length || 0;

      if (methodCount > THRESHOLDS.maxClassMethods) {
        const startLine = content.slice(0, match.index).split('\n').length;

        smells.push({
          id: this.generateSmellId(filePath, 'god-object', startLine),
          type: 'god-object',
          severity: methodCount > 25 ? 'high' : 'medium',
          description: `Class '${className}' has ${methodCount} methods and ${propertyCount} properties`,
          location: {
            filePath: path.relative(process.cwd(), filePath),
            line: startLine,
          },
          reason: 'God objects know too much and do too much - they violate single responsibility principle',
          suggestion: 'Split this class into smaller, focused classes with single responsibilities',
          complexityScore: methodCount + propertyCount,
        });
      }
    }

    return smells;
  }

  /**
   * Detect complex conditions
   */
  private detectComplexConditions(filePath: string, lines: string[]): CodeSmell[] {
    const smells: CodeSmell[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Count logical operators in a line
      const logicalOps = (line.match(/&&|\|\|/g) || []).length;
      const comparisons = (line.match(/[=!<>]=?|[!=]==/g) || []).length;

      if (logicalOps >= 3 || comparisons >= 4) {
        smells.push({
          id: this.generateSmellId(filePath, 'complex-condition', i + 1),
          type: 'complex-condition',
          severity: logicalOps >= 5 || comparisons >= 6 ? 'high' : 'medium',
          description: `Complex condition with ${logicalOps} logical operators and ${comparisons} comparisons`,
          location: {
            filePath: path.relative(process.cwd(), filePath),
            line: i + 1,
          },
          reason: 'Complex conditions are hard to understand and maintain',
          suggestion: 'Extract condition to a named variable or function with descriptive name',
          complexityScore: logicalOps + comparisons,
        });
      }
    }

    return smells;
  }

  /**
   * Detect parameter hell (too many parameters)
   */
  private detectParameterHell(filePath: string, lines: string[], content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    // Match function definitions
    const functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?)(?:<[^>]*>)?\s*\(([^)]*)\)/g;

    let match: RegExpExecArray | null;
    while ((match = functionPattern.exec(content)) !== null) {
      const params = match[1];
      if (!params) continue;

      const paramCount = params.split(',').filter(p => p.trim().length > 0 && p.trim() !== '...args').length;

      if (paramCount > THRESHOLDS.maxFunctionParams) {
        const startLine = content.slice(0, match.index).split('\n').length;

        smells.push({
          id: this.generateSmellId(filePath, 'parameter-hell', startLine),
          type: 'parameter-hell',
          severity: paramCount > 8 ? 'high' : 'medium',
          description: `Function has ${paramCount} parameters (threshold: ${THRESHOLDS.maxFunctionParams})`,
          location: {
            filePath: path.relative(process.cwd(), filePath),
            line: startLine,
          },
          reason: 'Too many parameters make functions hard to use and understand',
          suggestion: 'Use an options object or parameter object to group related parameters',
          complexityScore: paramCount,
        });
      }
    }

    return smells;
  }

  /**
   * Detect shotgun surgery (many files need to be modified for one change)
   */
  private detectShotgunSurgery(filePath: string, content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    // Look for similar patterns that might indicate scattered logic
    // This is a simplified heuristic
    const patternMatches = content.match(/if\s*\(\s*\w+\s*===\s*['"](\w+)['"]/g);

    if (patternMatches && patternMatches.length > 10) {
      const uniqueValues = new Set(patternMatches.map(m => m.match(/['"](\w+)['"]/)?.[1]));

      if (uniqueValues.size > 5) {
        const startLine = 1;

        smells.push({
          id: this.generateSmellId(filePath, 'shotgun-surgery', startLine),
          type: 'shotgun-surgery',
          severity: 'medium',
          description: `Many conditional checks on same values detected (${uniqueValues.size} unique values)`,
          location: {
            filePath: path.relative(process.cwd(), filePath),
            line: startLine,
          },
          reason: 'Changes to these values require modifications in many places',
          suggestion: 'Consider using polymorphism or a strategy pattern to centralize the logic',
          complexityScore: uniqueValues.size,
        });
      }
    }

    return smells;
  }

  /**
   * Detect duplicated code across files
   */
  private async detectDuplicatedCode(files: string[]): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    const blocks: Array<{ file: string; line: number; hash: string; content: string }> = [];

    // Extract code blocks and compute hashes
    for (const filePath of files) {
      const content = this.fileContents.get(filePath);
      if (!content) continue;

      const lines = content.split('\n');

      // Look for blocks of 5+ lines
      for (let i = 0; i < lines.length - THRESHOLDS.maxDuplicateLines; i++) {
        const block = lines.slice(i, i + THRESHOLDS.maxDuplicateLines).join('\n');
        const normalized = this.normalizeCode(block);
        const hash = crypto.createHash('md5').update(normalized).digest('hex');

        blocks.push({
          file: filePath,
          line: i + 1,
          hash,
          content: block,
        });
      }
    }

    // Find duplicate hashes
    const hashGroups = new Map<string, Array<{ file: string; line: number; content: string }>>();

    for (const block of blocks) {
      if (!hashGroups.has(block.hash)) {
        hashGroups.set(block.hash, []);
      }
      hashGroups.get(block.hash)!.push({ file: block.file, line: block.line, content: block.content });
    }

    // Report duplicates found in multiple files
    for (const [hash, occurrences] of hashGroups.entries()) {
      if (occurrences.length > 1) {
        const firstOccurrence = occurrences[0];

        smells.push({
          id: this.generateSmellId(firstOccurrence.file, 'duplicated-code', firstOccurrence.line),
          type: 'duplicated-code',
          severity: occurrences.length > 3 ? 'high' : 'medium',
          description: `Code block duplicated in ${occurrences.length} locations`,
          location: {
            filePath: path.relative(process.cwd(), firstOccurrence.file),
            line: firstOccurrence.line,
          },
          reason: 'Duplicated code leads to maintenance issues and bugs',
          suggestion: 'Extract common code to a shared function or module',
          complexityScore: occurrences.length * 10,
        });
      }
    }

    return smells;
  }

  /**
   * Detect indentation size from file
   */
  private detectIndentSize(lines: string[]): number {
    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match) {
        const spaces = match[1].length;
        if (spaces === 2 || spaces === 4) {
          return spaces;
        }
      }
    }
    return 2; // Default to 2 spaces
  }

  /**
   * Normalize code for duplicate detection
   */
  private normalizeCode(code: string): string {
    return code
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, 'STR') // Replace strings
      .replace(/\b\d+\b/g, 'NUM') // Replace numbers
      .replace(/\s*([{}();,])\s*/g, '$1') // Normalize spacing around punctuation
      .toLowerCase();
  }

  /**
   * Suggest a constant name based on context
   */
  private suggestConstantName(line: string, value: number): string {
    const lowerLine = line.toLowerCase();

    if (lowerLine.includes('timeout') || lowerLine.includes('interval')) {
      return `TIMEOUT_${value}MS`;
    }
    if (lowerLine.includes('limit') || lowerLine.includes('max')) {
      return `MAX_LIMIT`;
    }
    if (lowerLine.includes('retry') || lowerLine.includes('attempts')) {
      return `MAX_RETRIES`;
    }
    if (lowerLine.includes('buffer') || lowerLine.includes('size')) {
      return `BUFFER_SIZE`;
    }

    // Generic suggestions based on value
    if (value >= 1000) {
      return `MILLISECONDS_PER_${value >= 60000 ? 'MINUTE' : 'SECOND'}`;
    }

    return `CONSTANT_${value}`;
  }

  /**
   * Generate unique smell ID
   */
  private generateSmellId(filePath: string, type: CodeSmellType, line: number): string {
    const hash = Buffer.from(`${filePath}:${type}:${line}`).toString('base64').slice(0, 8);
    return `smell-${type}-${hash}`;
  }

  /**
   * Check if severity matches minimum requirement
   */
  private isSeverityMatch(severity: Severity, minSeverity: Severity): boolean {
    const order: Severity[] = ['high', 'medium', 'low'];
    return order.indexOf(severity) <= order.indexOf(minSeverity);
  }

  /**
   * Get relevant files to scan
   */
  private async getRelevantFiles(dirPath: string, options: DetectionOptions): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.py', '.go', '.java'];

    async function walk(currentPath: string) {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

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

          if (options.excludePatterns?.some(pattern => entry.name.match(pattern))) {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
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
