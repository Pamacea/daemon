/**
 * Refactor Suggester
 *
 * Suggestions de refactoring pour améliorer la qualité du code:
 * - Fractionnement des fonctions longues
 * - Simplification des conditions complexes
 * - Extraction de code dupliqué
 * - Amélioration du nommage
 * - Suggestions priorisées
 *
 * @module services/review/fixers/refactor-suggester
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { access, constants } from 'node:fs/promises';

import type { Issue, Suggestion } from '../review.types.js';
import { DockerManager } from '../../docker/docker-manager.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Configuration pour les seuils de détection
 */
const THRESHOLDS = {
  maxFunctionLength: 50, // lignes
  maxComplexity: 10, // cyclomatic complexity
  maxNestingDepth: 4,
  maxParameterCount: 5,
  minVariableNameLength: 3,
};

/**
 * Extensions de fichiers source
 */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Dossiers à exclure
 */
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__', '.next'];

/**
 * Pattern de détection de code dupliqué (simple)
 */
const DUPLICATE_PATTERNS = [
  // Même logique de map/filter
  /\.map\s*\(\s*\w+\s*=>\s*\w+\.\w+\s*\)\s*\.filter\s*\(/g,
  // fetch répétitif
  /fetch\s*\([^)]+\)\s*\.then\s*\([^)]+\)\s*\.then\s*\(/g,
];

/**
 * Suggéreur de refactoring
 */
export class RefactorSuggester {
  private readonly docker: DockerManager;
  private readonly logger: Logger;
  private suggestionCounter = 0;

  constructor(docker?: DockerManager) {
    this.docker = docker ?? new DockerManager();
    this.logger = createLogger('RefactorSuggester');
  }

  /**
   * Analyse un projet et génère des suggestions de refactoring
   *
   * @param projectPath - Chemin du projet
   * @param exclude - Patterns à exclure
   * @returns Suggestions de refactoring
   */
  async analyze(projectPath: string, exclude: string[] = []): Promise<Suggestion[]> {
    this.suggestionCounter = 0;
    const startTime = performance.now();

    this.logger.info(`Starting refactor analysis for: ${projectPath}`);

    const suggestions: Suggestion[] = [];
    const files = await this.findSourceFiles(projectPath, exclude);

    for (const filePath of files) {
      const fileSuggestions = await this.analyzeFile(filePath, projectPath);
      suggestions.push(...fileSuggestions);
    }

    // Trier par priorité
    suggestions.sort((a, b) => b.priority - a.priority);

    const duration = Math.round(performance.now() - startTime);
    this.logger.info(`Refactor analysis completed in ${duration}ms (${suggestions.length} suggestions)`);

    return suggestions;
  }

  /**
   * Analyse un fichier spécifique
   */
  private async analyzeFile(filePath: string, projectPath: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = relative(projectPath, filePath);

      // Détecter les fonctions longues
      const longFunctions = this.detectLongFunctions(lines);
      for (const func of longFunctions) {
        suggestions.push(this.createLongFunctionSuggestion(filePath, func, lines, relativePath));
      }

      // Détecter les conditions complexes
      const complexConditions = this.detectComplexConditions(lines);
      for (const cond of complexConditions) {
        suggestions.push(this.createComplexConditionSuggestion(filePath, cond, lines, relativePath));
      }

      // Détecter la duplication
      const duplicates = this.detectDuplicates(content, lines);
      for (const dup of duplicates) {
        suggestions.push(this.createDuplicateSuggestion(filePath, dup, lines, relativePath));
      }

      // Détecter les problèmes de nommage
      const namingIssues = this.detectNamingIssues(lines);
      for (const issue of namingIssues) {
        suggestions.push(this.createNamingSuggestion(filePath, issue, lines, relativePath));
      }

      // Détecter les paramètres trop nombreux
      const paramIssues = this.detectTooManyParameters(lines);
      for (const issue of paramIssues) {
        suggestions.push(this.createParameterSuggestion(filePath, issue, lines, relativePath));
      }

      // Détecter le manque de commentaires pour code complexe
      const uncommentedComplex = this.detectUncommentedComplex(lines);
      for (const issue of uncommentedComplex) {
        suggestions.push(this.createCommentSuggestion(filePath, issue, lines, relativePath));
      }
    } catch (error) {
      this.logger.debug(`Failed to analyze file: ${filePath}`, error);
    }

    return suggestions;
  }

  /**
   * Détecte les fonctions longues
   */
  private detectLongFunctions(lines: string[]): Array<{ name: string; startLine: number; endLine: number; length: number }> {
    const longFunctions: Array<{ name: string; startLine: number; endLine: number; length: number }> = [];
    const functionStack: Array<{ name: string; startLine: number }> = [];
    let currentIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      // Détecter le début d'une fonction
      const funcMatch = trimmed.match(/(?:function\s+(\w+)|(\w+)\s*\([^)]*\)\s*[{=>]|const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|async\s+function))/);
      if (funcMatch) {
        const name = funcMatch[1] || funcMatch[2] || funcMatch[3];
        const indent = line.search(/\S/);

        // Nouvelle fonction au même niveau ou moins profond
        if (functionStack.length === 0 || indent <= currentIndent) {
          // Vérifier si la fonction précédente était longue
          if (functionStack.length > 0) {
            const prev = functionStack[functionStack.length - 1];
            if (prev && i - prev.startLine > THRESHOLDS.maxFunctionLength) {
              longFunctions.push({
                name: prev.name,
                startLine: prev.startLine + 1,
                endLine: i + 1,
                length: i - prev.startLine,
              });
            }
          }

          functionStack.push({ name: name ?? 'anonymous', startLine: i });
          currentIndent = indent;
        }
      }

      // Détecter la fin d'une fonction
      if (trimmed === '}' && functionStack.length > 0) {
        const indent = line.search(/\S/);
        if (indent <= currentIndent) {
          const func = functionStack.pop();
          if (func && i - func.startLine > THRESHOLDS.maxFunctionLength) {
            longFunctions.push({
              name: func.name,
              startLine: func.startLine + 1,
              endLine: i + 1,
              length: i - func.startLine,
            });
          }
          currentIndent = indent - 2; // Approximation
        }
      }
    }

    return longFunctions;
  }

  /**
   * Détecte les conditions complexes
   */
  private detectComplexConditions(lines: string[]): Array<{ line: number; content: string; complexity: number }> {
    const complexConditions: Array<{ line: number; content: string; complexity: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      // Compter les opérateurs logiques
      const operators = (trimmed.match(/(&&|\|\|)/g) ?? []).length;
      const ternary = (trimmed.match(/\?[^:]+:/g) ?? []).length;

      if (operators + ternary >= 3) {
        complexConditions.push({
          line: i + 1,
          content: trimmed,
          complexity: operators + ternary,
        });
      }
    }

    return complexConditions;
  }

  /**
   * Détecte le code dupliqué
   */
  private detectDuplicates(content: string, lines: string[]): Array<{ line: number; pattern: string; occurrences: number }> {
    const duplicates: Array<{ line: number; pattern: string; occurrences: number }> = [];

    // Chercher les patterns répétitifs
    for (const pattern of DUPLICATE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 2) {
        // Trouver les lignes
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        const seenLines = new Set<number>();

        while ((match = pattern.exec(content)) !== null) {
          const position = this.findPosition(content, match.index);
          if (position && !seenLines.has(position.line)) {
            seenLines.add(position.line);
          }
        }

        if (seenLines.size > 1) {
          const firstLine = Math.min(...Array.from(seenLines));
          duplicates.push({
            line: firstLine,
            pattern: pattern.source,
            occurrences: seenLines.size,
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Détecte les problèmes de nommage
   */
  private detectNamingIssues(lines: string[]): Array<{ line: number; issue: string; suggestion: string }> {
    const issues: Array<{ line: number; issue: string; suggestion: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      // Noms de variables trop courts
      const shortVarMatch = trimmed.match(/(?:let|const|var)\s+([a-z]{1,2})\s*[=;]/);
      if (shortVarMatch && !['i', 'j', 'x', 'y', '_'].includes(shortVarMatch[1])) {
        issues.push({
          line: i + 1,
          issue: `Variable name "${shortVarMatch[1]}" is too short`,
          suggestion: `Use a more descriptive name instead of "${shortVarMatch[1]}"`,
        });
      }

      // Fonctions avec nom verbeux
      const longFuncMatch = trimmed.match(/function\s+([a-zA-Z_]\w{20,})\s*\(/);
      if (longFuncMatch) {
        issues.push({
          line: i + 1,
          issue: `Function name "${longFuncMatch[1]}" is too long`,
          suggestion: 'Consider using a shorter, more concise name',
        });
      }

      // Noms non descriptifs
      const genericMatch = trimmed.match(/(?:let|const|var)\s+(data|temp|item|value|info|result)\s*=/);
      if (genericMatch) {
        issues.push({
          line: i + 1,
          issue: `Generic variable name "${genericMatch[1]}"`,
          suggestion: `Use a more specific name describing what "${genericMatch[1]}" contains`,
        });
      }
    }

    return issues;
  }

  /**
   * Détecte les fonctions avec trop de paramètres
   */
  private detectTooManyParameters(lines: string[]): Array<{ line: number; name: string; count: number }> {
    const paramIssues: Array<{ line: number; name: string; count: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // Détecter les déclarations de fonction
      const funcMatch = line.match(/(?:function\s+(\w+)|(\w+)\s*=\s*(?:\([^)]*\)|async\s+\([^)]*\)))/);
      if (funcMatch) {
        const name = funcMatch[1] || funcMatch[2];
        const paramsMatch = line.match(/\(([^)]*)\)/);

        if (paramsMatch) {
          const params = paramsMatch[1].split(',').filter((p) => p.trim().length > 0);
          if (params.length > THRESHOLDS.maxParameterCount) {
            paramIssues.push({
              line: i + 1,
              name: name ?? 'anonymous',
              count: params.length,
            });
          }
        }
      }
    }

    return paramIssues;
  }

  /**
   * Détecte le code complexe sans commentaires
   */
  private detectUncommentedComplex(lines: string[]): Array<{ line: number; reason: string }> {
    const issues: Array<{ line: number; reason: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      // Chercher des patterns complexes sans commentaire avant
      const complexPatterns = [
        /\/\/.*TODO|FIXME|HACK/,
        /for\s*\(\s*\w+\s+in\s+.*?\)\s*{/,
        /while\s*\(\s*.*?\)\s*{/,
        /switch\s*\(\s*.*?\)\s*{/,
      ];

      const isComplex = complexPatterns.some((p) => p.test(trimmed));
      const hasCommentBefore = i > 0 && (lines[i - 1] ?? '').trim().startsWith('//');

      if (isComplex && !hasCommentBefore && !trimmed.startsWith('//')) {
        // Vérifier si le bloc contient du code complexe
        const hasComplexLogic =
          (trimmed.match(/&&|\|\|/g) ?? []).length >= 2 || trimmed.includes('?') || trimmed.includes('...');

        if (hasComplexLogic) {
          issues.push({
            line: i + 1,
            reason: 'Complex logic without explanatory comment',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Crée une suggestion pour fonction longue
   */
  private createLongFunctionSuggestion(
    filePath: string,
    func: { name: string; startLine: number; endLine: number; length: number },
    lines: string[],
    relativePath: string
  ): Suggestion {
    const snippet = this.extractCodeSnippet(lines, func.startLine, 3);

    return {
      id: this.generateId('long-function', relativePath, func.startLine),
      type: 'refactor',
      priority: Math.min(10, Math.ceil(func.length / THRESHOLDS.maxFunctionLength) + 5),
      title: `Long function: ${func.name}`,
      description: `Function "${func.name}" is ${func.length} lines long. Consider splitting it into smaller, more focused functions.`,
      location: {
        file: filePath,
        line: func.startLine,
      },
      before: snippet,
      after: `// Split ${func.name} into smaller functions
function ${func.name}() {
  const step1 = handleStep1();
  const step2 = handleStep2(step1);
  return handleStep3(step2);
}`,
      benefits: [
        'Improved readability',
        'Easier to test individual parts',
        'Better reusability',
        'Simpler debugging',
      ],
      effort: Math.ceil(func.length / 20) + 2,
    };
  }

  /**
   * Crée une suggestion pour condition complexe
   */
  private createComplexConditionSuggestion(
    filePath: string,
    cond: { line: number; content: string; complexity: number },
    lines: string[],
    relativePath: string
  ): Suggestion {
    return {
      id: this.generateId('complex-condition', relativePath, cond.line),
      type: 'refactor',
      priority: cond.complexity + 3,
      title: 'Complex condition detected',
      description: `Complex logical condition (complexity: ${cond.complexity}). Consider extracting to a named function or variable.`,
      location: {
        file: filePath,
        line: cond.line,
      },
      before: cond.content,
      after: `// Extract to a named function
const isValid = isValidUser && hasPermission && isActive;
if (isValid) { ... }`,
      benefits: [
        'Self-documenting code',
        'Easier to test condition',
        'Reusability',
        'Reduced cognitive load',
      ],
      effort: 3,
    };
  }

  /**
   * Crée une suggestion pour code dupliqué
   */
  private createDuplicateSuggestion(
    filePath: string,
    dup: { line: number; pattern: string; occurrences: number },
    lines: string[],
    relativePath: string
  ): Suggestion {
    const snippet = this.extractCodeSnippet(lines, dup.line, 2);

    return {
      id: this.generateId('duplicate', relativePath, dup.line),
      type: 'extraction',
      priority: dup.occurrences + 4,
      title: 'Duplicated code detected',
      description: `Code pattern appears ${dup.occurrences} times. Consider extracting to a reusable function.`,
      location: {
        file: filePath,
        line: dup.line,
      },
      before: snippet,
      after: `// Extract to a reusable function
function extractCommonLogic(input) {
  // Common implementation here
  return result;
}`,
      benefits: [
        'DRY principle',
        'Single source of truth',
        'Easier maintenance',
        'Consistent behavior',
      ],
      effort: 4,
    };
  }

  /**
   * Crée une suggestion pour problème de nommage
   */
  private createNamingSuggestion(
    filePath: string,
    issue: { line: number; issue: string; suggestion: string },
    lines: string[],
    relativePath: string
  ): Suggestion {
    return {
      id: this.generateId('naming', relativePath, issue.line),
      type: 'naming',
      priority: 3,
      title: 'Naming issue detected',
      description: issue.issue,
      location: {
        file: filePath,
        line: issue.line,
      },
      before: lines[issue.line - 1] ?? '',
      after: `// Use descriptive name instead`,
      benefits: [
        'Self-documenting code',
        'Reduced need for comments',
        'Better IDE autocomplete',
      ],
      effort: 2,
    };
  }

  /**
   * Crée une suggestion pour trop de paramètres
   */
  private createParameterSuggestion(
    filePath: string,
    issue: { line: number; name: string; count: number },
    lines: string[],
    relativePath: string
  ): Suggestion {
    const snippet = this.extractCodeSnippet(lines, issue.line, 1);

    return {
      id: this.generateId('parameters', relativePath, issue.line),
      type: 'refactor',
      priority: issue.count - 2,
      title: 'Too many parameters',
      description: `Function "${issue.name}" has ${issue.count} parameters. Consider using an options object.`,
      location: {
        file: filePath,
        line: issue.line,
      },
      before: snippet,
      after: `// Use options object pattern
interface Options {
  param1: string;
  param2: number;
  param3: boolean;
  // ... other params
}

function ${issue.name}(options: Options) {
  // ...
}`,
      benefits: [
        'Easier to extend',
        'Named parameters',
        'Optional parameters',
        'Better self-documentation',
      ],
      effort: 5,
    };
  }

  /**
   * Crée une suggestion pour manque de commentaires
   */
  private createCommentSuggestion(
    filePath: string,
    issue: { line: number; reason: string },
    lines: string[],
    relativePath: string
  ): Suggestion {
    const snippet = this.extractCodeSnippet(lines, issue.line, 2);

    return {
      id: this.generateId('comment', relativePath, issue.line),
      type: 'refactor',
      priority: 2,
      title: 'Complex code needs documentation',
      description: issue.reason,
      location: {
        file: filePath,
        line: issue.line,
      },
      before: snippet,
      after: `// Add comment explaining the logic
// Why this approach is used:
// - reason 1
// - reason 2
${snippet}`,
      benefits: [
        'Better maintainability',
        'Knowledge transfer',
        'Onboarding help',
      ],
      effort: 2,
    };
  }

  /**
   * Trouve tous les fichiers source
   */
  private async findSourceFiles(projectPath: string, exclude: string[]): Promise<string[]> {
    const files: string[] = [];

    const traverse = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (EXCLUDE_DIRS.includes(entry.name) || exclude.some((e) => fullPath.includes(e))) {
            continue;
          }

          if (entry.isDirectory()) {
            await traverse(fullPath);
          } else if (entry.isFile()) {
            const ext = `.${entry.name.split('.').pop()}`;
            if (SOURCE_EXTENSIONS.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Ignorer les erreurs
      }
    };

    await traverse(projectPath);
    return files;
  }

  /**
   * Extrait un extrait de code
   */
  private extractCodeSnippet(lines: string[], targetLine: number, context: number): string {
    const start = Math.max(0, targetLine - context - 1);
    const end = Math.min(lines.length, targetLine + context);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Trouve la position ligne/colonne à partir d'un index
   */
  private findPosition(content: string, index: number): { line: number; column: number } | null {
    const before = content.substring(0, index);
    const lines = before.split('\n');
    return {
      line: lines.length,
      column: (lines[lines.length - 1] ?? '').length + 1,
    };
  }

  /**
   * Génère un ID unique
   */
  private generateId(type: string, file: string, line: number): string {
    return `refactor-${type}-${file.replace(/[^a-zA-Z0-9]/g, '-')}-${line}-${++this.suggestionCounter}`;
  }
}
