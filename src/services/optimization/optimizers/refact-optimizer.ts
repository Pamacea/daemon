/**
 * Refactoring Optimizer
 *
 * Applies refactoring optimizations including:
 * - Extract functions/methods
 * - Rename for clarity
 * - Remove duplication
 * - Simplify complex logic
 * - Improve structure
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
 * Refactoring suggestion
 */
interface RefactoringSuggestion {
  type: string;
  description: string;
  originalCode: string;
  suggestedCode: string;
  location: Location;
  autoApplicable: boolean;
}

/**
 * Refactoring Optimizer Service
 */
export class RefactOptimizer {
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger('RefactOptimizer');
  }

  /**
   * Analyze and suggest refactorings for a file
   */
  async analyzeFile(filePath: string, content: string): Promise<{
    suggestions: RefactoringSuggestion[];
    autoApplicable: RefactoringSuggestion[];
  }> {
    const suggestions: RefactoringSuggestion[] = [];
    const autoApplicable: RefactoringSuggestion[] = [];

    // Detect various refactoring opportunities
    suggestions.push(...this.detectLongMethods(filePath, content));
    suggestions.push(...this.detectDuplicateCode(filePath, content));
    suggestions.push(...this.detectPoorNaming(filePath, content));
    suggestions.push(...this.detectLargeClasses(filePath, content));
    suggestions.push(...this.detectFeatureEnvy(filePath, content));
    suggestions.push(...this.detectInappropriateIntimacy(filePath, content));

    // Separate auto-applicable suggestions
    for (const suggestion of suggestions) {
      if (suggestion.autoApplicable) {
        autoApplicable.push(suggestion);
      }
    }

    return { suggestions, autoApplicable };
  }

  /**
   * Apply auto-applicable refactorings
   */
  async applyRefactorings(
    filePath: string,
    refactorings: RefactoringSuggestion[],
    dryRun: boolean = false,
    createBackup: boolean = true
  ): Promise<{
    success: boolean;
    appliedRefactorings: AppliedOptimization[];
    errors: OptimizationError[];
  }> {
    const appliedRefactorings: AppliedOptimization[] = [];
    const errors: OptimizationError[] = [];

    try {
      let content = await fs.readFile(filePath, 'utf-8');

      // Create backup
      if (createBackup && !dryRun) {
        await this.createBackup(filePath, content);
      }

      // Apply each auto-applicable refactoring
      for (const refactoring of refactorings.filter(r => r.autoApplicable)) {
        try {
          content = content.replace(refactoring.originalCode, refactoring.suggestedCode);

          appliedRefactorings.push({
            id: this.generateRefactorId(),
            type: 'refactoring',
            description: refactoring.description,
            modifiedFiles: [path.relative(process.cwd(), filePath)],
            originalCode: refactoring.originalCode,
            fixedCode: refactoring.suggestedCode,
            location: refactoring.location,
          });
        } catch (error) {
          errors.push({
            target: filePath,
            message: `Failed to apply refactoring: ${refactoring.description} - ${error}`,
            fatal: false,
          });
        }
      }

      // Write modified content
      if (!dryRun && appliedRefactorings.length > 0) {
        await fs.writeFile(filePath, content, 'utf-8');
        this.logger.info(`Applied ${appliedRefactorings.length} refactorings to ${filePath}`);
      }

      return { success: true, appliedRefactorings, errors };
    } catch (error) {
      errors.push({
        target: filePath,
        message: error instanceof Error ? error.message : String(error),
        fatal: true,
      });
      return { success: false, appliedRefactorings, errors };
    }
  }

  /**
   * Detect long methods that should be broken down
   */
  private detectLongMethods(filePath: string, content: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    const lines = content.split('\n');

    // Find function/method definitions
    const functionPattern = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(?:async\s+)?(\w+)\s*\([^)]*\)\s*{)/g;
    const classMethodPattern = /(?:class\s+\w+\s*{[\s\S]*?)^\s*(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/gm;

    const detectFunction = (match: RegExpExecArray, startIndex: number, isClassMethod = false) => {
      const name = match[1] || match[2] || match[3] || match[4];
      if (!name) return;

      // Find function body extent
      const afterMatch = content.slice(match.index + match[0].length);
      const braceMatch = afterMatch.match(/{/);

      if (braceMatch) {
        const bodyStart = match.index + match[0].length + (braceMatch.index ?? 0) + 1;
        let braceCount = 1;
        let bodyEnd = bodyStart;

        for (let i = bodyStart; i < content.length; i++) {
          if (content[i] === '{') braceCount++;
          if (content[i] === '}') braceCount--;
          if (braceCount === 0) {
            bodyEnd = i;
            break;
          }
        }

        const functionBody = content.slice(bodyStart, bodyEnd);
        const lineCount = functionBody.split('\n').length;

        if (lineCount > 50) {
          const startLine = content.slice(0, match.index).split('\n').length;

          suggestions.push({
            type: 'extract-method',
            description: `Method '${name}' is ${lineCount} lines long. Consider extracting smaller methods.`,
            originalCode: functionBody.slice(0, 200) + '...',
            suggestedCode: `// Extract smaller methods from '${name}'
// Example: const result1 = extractSubLogic1(input);
//          const result2 = extractSubLogic2(result1);`,
            location: {
              filePath: path.relative(process.cwd(), filePath),
              line: startLine,
            },
            autoApplicable: false,
          });
        }
      }
    };

    // Check regular functions
    let match: RegExpExecArray | null;
    const globalFunctionPattern = new RegExp(functionPattern.source, functionPattern.flags + 'g');
    while ((match = globalFunctionPattern.exec(content)) !== null) {
      detectFunction(match, match.index);
    }

    // Check class methods
    const globalClassPattern = new RegExp(classMethodPattern.source, classMethodPattern.flags + 'g');
    while ((match = globalClassPattern.exec(content)) !== null) {
      detectFunction(match, match.index, true);
    }

    return suggestions;
  }

  /**
   * Detect duplicate code blocks
   */
  private detectDuplicateCode(filePath: string, content: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    const lines = content.split('\n');

    // Look for repeated patterns
    const seenBlocks = new Map<string, number>();

    for (let i = 0; i < lines.length - 10; i++) {
      const block = lines.slice(i, i + 5).join('\n').trim();

      if (block.length < 50) continue; // Skip small blocks

      const hash = this.simpleHash(block);

      if (seenBlocks.has(hash)) {
        const firstLine = seenBlocks.get(hash)!;

        suggestions.push({
          type: 'extract-method',
          description: `Duplicate code detected at lines ${firstLine + 1} and ${i + 1}. Extract to shared function.`,
          originalCode: block,
          suggestedCode: `const extractedFunction = () => {
  ${block.split('\n').map(l => '  ' + l).join('\n')}
};`,
          location: {
            filePath: path.relative(process.cwd(), filePath),
            line: i + 1,
          },
          autoApplicable: false,
        });
      } else {
        seenBlocks.set(hash, i);
      }
    }

    return suggestions;
  }

  /**
   * Detect poorly named variables/functions
   */
  private detectPoorNaming(filePath: string, content: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    // Single letter variables (except loop counters)
    const singleLetterPattern = /(?:const|let|var)\s+([a-z])(?!\s*,|\s*;|\s*=)/g;
    const matches = Array.from(content.matchAll(singleLetterPattern));

    for (const match of matches) {
      const varName = match[1];

      // Skip common exceptions
      if (['i', 'j', 'k', 'x', 'y', '_', '$'].includes(varName)) {
        continue;
      }

      const startLine = content.slice(0, match.index).split('\n').length;

      suggestions.push({
        type: 'rename',
        description: `Single-letter variable '${varName}' has unclear meaning. Use descriptive name.`,
        originalCode: match[0],
        suggestedCode: `const descriptive${varName.toUpperCase()}Name`,
        location: {
          filePath: path.relative(process.cwd(), filePath),
          line: startLine,
        },
        autoApplicable: false,
      });
    }

    // Abbreviated names
    const abbrevPattern = /(?:const|let|var)\s+(?:\w{1,2})(?=[A-Z])/g;
    // This would catch things like "usrData" suggesting "userData"
    // Simplified for safety

    return suggestions;
  }

  /**
   * Detect large classes (God Objects)
   */
  private detectLargeClasses(filePath: string, content: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    // Find class definitions
    const classPattern = /class\s+(\w+)\s*{[\s\S]*?^}/gm;

    let match: RegExpExecArray | null;
    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const classBody = match[0];

      // Count methods and properties
      const methodCount = (classBody.match(/^\s*(?:public|private|protected)?\s*(?:async\s+)?\w+\s*\(/gm) || []).length;
      const propertyCount = (classBody.match(/^\s*(?:public|private|protected)?\s*(?:readonly\s+)?\w+\s*(?::\s*\w+)?\s*;/gm) || []).length;

      if (methodCount > 15 || (methodCount + propertyCount) > 20) {
        const startLine = content.slice(0, match.index).split('\n').length;

        suggestions.push({
          type: 'extract-class',
          description: `Class '${className}' has ${methodCount} methods. Consider splitting into smaller classes.`,
          originalCode: `class ${className} { ... }`,
          suggestedCode: `// Split ${className} into:
// - ${className}Core: core functionality
// - ${className}Helpers: helper methods
// - ${className}Validators: validation logic`,
          location: {
            filePath: path.relative(process.cwd(), filePath),
            line: startLine,
          },
          autoApplicable: false,
        });
      }
    }

    return suggestions;
  }

  /**
   * Detect feature envy - methods that use another class's data more than their own
   */
  private detectFeatureEnvy(filePath: string, content: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    // Look for methods that heavily use other objects' properties
    const methodPattern = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>))/g;

    let match: RegExpExecArray | null;
    while ((match = methodPattern.exec(content)) !== null) {
      const methodName = match[1] || match[2];
      if (!methodName) continue;

      // Get method body (simplified)
      const afterMatch = content.slice(match.index);
      const bodyMatch = afterMatch.match(/{[^}]{50,500}/);

      if (bodyMatch) {
        const body = bodyMatch[0];

        // Count references to other objects vs this/self
        const otherObjectRefs = (body.match(/\w+\.\w+/g) || []).length;
        const thisRefs = (body.match(/this\.\w+/g) || []).length;

        if (otherObjectRefs > 3 && otherObjectRefs > thisRefs * 2) {
          const startLine = content.slice(0, match.index).split('\n').length;

          suggestions.push({
            type: 'move-method',
            description: `Method '${methodName}' uses other objects' data heavily. Consider moving it to those classes.`,
            originalCode: body.slice(0, 100) + '...',
            suggestedCode: `// Move '${methodName}' to the class it operates on`,
            location: {
              filePath: path.relative(process.cwd(), filePath),
              line: startLine,
            },
            autoApplicable: false,
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Detect inappropriate intimacy - classes too familiar with each other's internals
   */
  private detectInappropriateIntimacy(filePath: string, content: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    // Look for deep access to other classes' internals
    const deepAccessPattern = /\w+\.\w+\.\w+\.\w+/g;

    const matches = Array.from(content.matchAll(deepAccessPattern));

    if (matches.length > 3) {
      const firstMatch = matches[0];
      const startLine = content.slice(0, firstMatch.index).split('\n').length;

      suggestions.push({
        type: 'hide-delegate',
        description: `Deep object access detected. Consider using Law of Demeter - hide delegation.`,
        originalCode: firstMatch[0],
        suggestedCode: `// Add delegate method instead of deep access:
// class Container {
//   getFinalValue() { return this.obj.property.value; }
// }`,
        location: {
          filePath: path.relative(process.cwd(), filePath),
          line: startLine,
        },
        autoApplicable: false,
      });
    }

    return suggestions;
  }

  /**
   * Create backup of a file
   */
  private async createBackup(filePath: string, content: string): Promise<void> {
    const backupDir = path.resolve('.daemon/backup');
    const backupPath = path.join(
      backupDir,
      `${path.basename(filePath)}.${Date.now()}.backup`
    );

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupPath, content, 'utf-8');

    this.logger.debug(`Created backup: ${backupPath}`);
  }

  /**
   * Simple hash function for duplicate detection
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Generate unique refactoring ID
   */
  private generateRefactorId(): string {
    return `refactor-${crypto.randomBytes(4).toString('hex')}`;
  }
}
