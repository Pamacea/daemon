/**
 * Test Generator
 *
 * Génération automatique de tests pour le code non couvert:
 * - Génération de stubs de tests
 * - Détection des fonctions sans tests
 * - Suggestions de cas de test
 * - Suivi des patterns du framework de test
 *
 * @module services/review/fixers/test-generator
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, dirname, basename } from 'node:path';
import { access, constants } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import type { Issue, GeneratedTest, TestGenerationResult, CoverageStats } from '../review.types.js';
import type { DockerExecResult } from '../../../core/types/docker.types.js';
import { DockerManager } from '../../docker/docker-manager.js';
import { createLogger, type Logger } from '../../../shared/utils/logger.js';

/**
 * Extensions de fichiers source
 */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Extensions de fichiers de test
 */
const TEST_EXTENSIONS = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.test.js', '.test.jsx'];

/**
 * Configuration de génération par framework
 */
const FRAMEWORK_TEMPLATES = {
  vitest: {
    import: "import { describe, it, expect } from 'vitest'",
    testBlock: 'describe',
    testCase: 'it',
    assertion: 'expect',
  },
  jest: {
    import: "import { describe, test, expect } from '@jest/globals'",
    testBlock: 'describe',
    testCase: 'test',
    assertion: 'expect',
  },
  mocha: {
    import: "import { describe, it } from 'mocha'",
    testBlock: 'describe',
    testCase: 'it',
    assertion: 'expect',
  },
};

/**
 * Fonction extractée via AST simplifié
 */
interface ExtractedFunction {
  name: string;
  type: 'function' | 'arrow-function' | 'method' | 'async-function';
  isAsync: boolean;
  hasParams: boolean;
  line: number;
  exported: boolean;
  defaultExport: boolean;
}

/**
 * Classe exportée extractée
 */
interface ExtractedClass {
  name: string;
  methods: ExtractedFunction[];
  line: number;
  exported: boolean;
  defaultExport: boolean;
}

/**
 * Générateur de tests
 */
export class TestGenerator {
  private readonly docker: DockerManager;
  private readonly logger: Logger;
  private projectPath: string;
  private testFramework: keyof typeof FRAMEWORK_TEMPLATES = 'vitest';

  constructor(docker?: DockerManager) {
    this.docker = docker ?? new DockerManager();
    this.logger = createLogger('TestGenerator');
    this.projectPath = '';
  }

  /**
   * Génère des tests pour un projet
   *
   * @param projectPath - Chemin du projet
   * @param options - Options de génération
   * @returns Résultat de la génération
   */
  async generateTests(
    projectPath: string,
    options: {
      coverage?: CoverageStats;
      targetFiles?: string[];
      framework?: 'vitest' | 'jest' | 'mocha';
      dryRun?: boolean;
    } = {}
  ): Promise<TestGenerationResult> {
    this.projectPath = projectPath;
    this.testFramework = options.framework ?? this.testFramework;

    this.logger.info(`Starting test generation for: ${projectPath}`);

    const generated: GeneratedTest[] = [];
    const failed: Array<{ filePath: string; reason: string }> = [];

    // Détecter les fichiers source sans tests
    const sourceFiles = await this.findFilesWithoutTests(projectPath, options.targetFiles);

    this.logger.info(`Found ${sourceFiles.length} files without tests`);

    // Générer des tests pour chaque fichier
    for (const sourceFile of sourceFiles) {
      try {
        const testContent = await this.generateTestForFile(sourceFile, projectPath);

        if (testContent) {
          const testPath = this.getTestPath(sourceFile, projectPath);

          if (!options.dryRun) {
            await this.writeTestFile(testPath, testContent);
          }

          generated.push({
            filePath: testPath,
            content: testContent,
            type: 'unit',
            estimatedCoverage: 50, // Estimation conservatrice
          });
        } else {
          failed.push({
            filePath: sourceFile,
            reason: 'Could not generate test content',
          });
        }
      } catch (error) {
        failed.push({
          filePath: sourceFile,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info(`Generated ${generated.length} tests, ${failed.length} failed`);

    return {
      generated,
      failed,
      totalCoverage: options.coverage,
    };
  }

  /**
   * Génère des suggestions de tests pour une issue spécifique
   *
   * @param issue - Issue de couverture de test
   * @returns Suggestions de tests
   */
  generateTestSuggestions(issue: Issue): string[] {
    const suggestions: string[] = [];

    const filePath = issue.location.file;
    const fileName = basename(filePath, '.ts').replace(/\.(test|spec)$/, '');

    suggestions.push(`Create test file: ${fileName}.test.ts`);
    suggestions.push('Test the main exported functions');
    suggestions.push('Test edge cases and error conditions');
    suggestions.push('Mock external dependencies');

    if (issue.category === 'testing') {
      suggestions.push('Add test for authentication/authorization');
      suggestions.push('Test with valid and invalid inputs');
    }

    return suggestions;
  }

  /**
   * Génère un stub de test pour un fichier source
   */
  private async generateTestForFile(sourceFile: string, projectPath: string): Promise<string | null> {
    const content = await readFile(sourceFile, 'utf-8');
    const relativePath = relative(projectPath, sourceFile);
    const fileName = basename(sourceFile);
    const nameWithoutExt = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');

    // Extraire les fonctions et classes
    const functions = await this.extractFunctions(content);
    const classes = await this.extractClasses(content);

    // Vérifier s'il y a quelque chose à tester
    if (functions.length === 0 && classes.length === 0) {
      // Fichier vide ou uniquement des exports
      return null;
    }

    // Générer le contenu du test
    const template = FRAMEWORK_TEMPLATES[this.testFramework];
    const imports = this.generateImports(relativePath, functions, classes);
    const testCases = this.generateTestCases(functions, classes, nameWithoutExt);

    return `/**
 * Tests for ${nameWithoutExt}
 *
 * Auto-generated test file
 * TODO: Review and complete the tests
 */

${imports}

describe('${nameWithoutExt}', () => {
${testCases}
});
`;
  }

  /**
   * Génère les imports nécessaires pour le fichier de test
   */
  private generateImports(relativePath: string, functions: ExtractedFunction[], classes: ExtractedClass[]): string {
    const imports: string[] = [];

    // Import du framework de test
    imports.push(FRAMEWORK_TEMPLATES[this.testFramework].import);

    // Import du fichier à tester (avec / si pas d'extension .js implicite)
    const importPath = relativePath.replace(/\.(ts|tsx|js|jsx)$/, '');
    const isRelative = !importPath.startsWith('.');
    const finalImportPath = isRelative ? `./${importPath}` : importPath;

    // Détecter si c'est un default export ou named export
    const hasDefaultExport =
      functions.some((f) => f.defaultExport) || classes.some((c) => c.defaultExport);
    const hasNamedExports =
      functions.some((f) => !f.defaultExport && f.exported) || classes.some((c) => !c.defaultExport && c.exported);

    if (hasDefaultExport && hasNamedExports) {
      imports.push(`import ${basename(finalImportPath)}, * as ${basename(finalImportPath)}NS from '${finalImportPath}'`);
    } else if (hasDefaultExport) {
      imports.push(`import ${basename(finalImportPath)} from '${finalImportPath}'`);
    } else if (hasNamedExports) {
      // Générer les named exports
      const names = [
        ...functions.filter((f) => !f.defaultExport && f.exported).map((f) => f.name),
        ...classes.filter((c) => !c.defaultExport && c.exported).map((c) => c.name),
      ];
      imports.push(`import { ${names.join(', ')} } from '${finalImportPath}'`);
    } else {
      // Importer tout par défaut
      imports.push(`import * as ${basename(finalImportPath).replace(/[^a-zA-Z0-9]/g, '')} from '${finalImportPath}'`);
    }

    return imports.join('\n');
  }

  /**
   * Génère les cas de test
   */
  private generateTestCases(functions: ExtractedFunction[], classes: ExtractedClass[], fileName: string): string {
    const cases: string[] = [];

    // Tests pour les fonctions
    for (const func of functions) {
      if (func.exported || func.defaultExport) {
        cases.push(this.generateFunctionTest(func));
      }
    }

    // Tests pour les classes
    for (const cls of classes) {
      if (cls.exported || cls.defaultExport) {
        cases.push(this.generateClassTest(cls));
      }
    }

    // Si aucun cas spécifique, ajouter un placeholder
    if (cases.length === 0) {
      cases.push(`  // TODO: Add tests for ${fileName}`);
      cases.push(`  it('should be defined', () => {`);
      cases.push(`    expect(true).toBe(true);`);
      cases.push(`  });`);
    }

    return cases.join('\n\n');
  }

  /**
   * Génère un test pour une fonction
   */
  private generateFunctionTest(func: ExtractedFunction): string {
    const template = FRAMEWORK_TEMPLATES[this.testFramework];
    const indent = '    ';

    let test = `${indent}it('should ${func.name}', () => {\n`;
    test += `${indent}  // TODO: Implement test\n`;
    test += `${indent}  const result = ${func.name}();\n`;
    test += `${indent}  ${template.assertion}(result).toBeDefined();\n`;
    test += `${indent}});\n`;

    if (func.hasParams) {
      test += `\n${indent}it('should handle edge cases for ${func.name}', () => {\n`;
      test += `${indent}  // TODO: Test with null, undefined, empty values\n`;
      test += `${indent}});\n`;
    }

    return test;
  }

  /**
   * Génère un test pour une classe
   */
  private generateClassTest(cls: ExtractedClass): string {
    const template = FRAMEWORK_TEMPLATES[this.testFramework];
    const indent = '    ';

    let test = `${indent}describe('${cls.name}', () => {\n`;
    test += `${indent}  let instance: ${cls.name};\n\n`;
    test += `${indent}  beforeEach(() => {\n`;
    test += `${indent}    instance = new ${cls.name}();\n`;
    test += `${indent}  });\n\n`;

    // Tests pour chaque méthode
    for (const method of cls.methods) {
      test += `${indent}  it('should have ${method.name} method', () => {\n`;
      test += `${indent}    ${template.assertion}(instance.${method.name}).toBeDefined();\n`;
      test += `${indent}  });\n\n`;
    }

    test += `${indent}});\n`;

    return test;
  }

  /**
   * Extrait les fonctions d'un fichier
   */
  private async extractFunctions(content: string): Promise<ExtractedFunction[]> {
    const functions: ExtractedFunction[] = [];
    const lines = content.split('\n');

    // Patterns pour détecter les fonctions
    const patterns = [
      // function name() {}
      /(?:export\s+(?:default\s+)?)?function\s+(\w+)\s*\(/g,
      // const name = () => {}
      /(?:export\s+(?:const|let|var)\s+(?:default\s+)?)(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
      // const name = async function() {}
      /(?:export\s+(?:const|let|var)\s+(?:default\s+)?)(\w+)\s*=\s*async\s+function\s*\(/g,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      for (const pattern of patterns) {
        const match = pattern.exec(line);
        if (match) {
          functions.push({
            name: match[1],
            type: line.includes('=>') ? 'arrow-function' : 'function',
            isAsync: line.includes('async'),
            hasParams: /\([^)]*\)/.test(line),
            line: i + 1,
            exported: line.includes('export'),
            defaultExport: line.includes('default'),
          });
        }
      }
    }

    return functions;
  }

  /**
   * Extrait les classes d'un fichier
   */
  private async extractClasses(content: string): Promise<ExtractedClass[]> {
    const classes: ExtractedClass[] = [];
    const lines = content.split('\n');

    // Pattern pour détecter les classes
    const classPattern = /(?:export\s+(?:default\s+)?)?class\s+(\w+)/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      classPattern.lastIndex = 0;
      const match = classPattern.exec(line);

      if (match) {
        // Extraire les méthodes de la classe
        const methods = this.extractClassMethods(lines, i + 1);

        classes.push({
          name: match[1],
          methods,
          line: i + 1,
          exported: line.includes('export'),
          defaultExport: line.includes('default'),
        });
      }
    }

    return classes;
  }

  /**
   * Extrait les méthodes d'une classe
   */
  private extractClassMethods(lines: string[], startLine: number): ExtractedFunction[] {
    const methods: ExtractedFunction[] = [];
    let indentLevel = 0;

    // Trouver le niveau d'indentation de la classe
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      if (!line) {
        // Fin de classe
        if (indentLevel === 0) break;
        continue;
      }

      // Détection du niveau d'indentation
      if (/^\s*\}/.test(line)) {
        if (indentLevel === 0) break;
        indentLevel--;
        continue;
      }

      // Détecter les méthodes
      const methodMatch = line.match(/(\w+)\s*\(|^\s+(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/);
      if (methodMatch) {
        const methodName = methodMatch[1] || methodMatch[2];
        if (methodName && !['constructor', 'get', 'set'].includes(methodName)) {
          methods.push({
            name: methodName,
            type: 'method',
            isAsync: line.includes('async'),
            hasParams: /\([^)]*\)/.test(line),
            line: i + 1,
            exported: true,
            defaultExport: false,
          });
        }
      }
    }

    return methods;
  }

  /**
   * Trouve les fichiers source sans tests
   */
  private async findFilesWithoutTests(projectPath: string, targetFiles?: string[]): Promise<string[]> {
    const sourceFiles: string[] = [];

    if (targetFiles) {
      return targetFiles.filter((f) => !this.hasTestFile(f, projectPath));
    }

    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__tests__'];

    const traverse = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await traverse(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = `.${entry.name.split('.').pop()}`;
            if (sourceExtensions.includes(ext) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
              if (!this.hasTestFile(fullPath, projectPath)) {
                sourceFiles.push(fullPath);
              }
            }
          }
        }
      } catch {
        // Ignorer les erreurs
      }
    };

    await traverse(projectPath);
    return sourceFiles;
  }

  /**
   * Vérifie si un fichier a un fichier de test correspondant
   */
  private hasTestFile(sourceFile: string, projectPath: string): boolean {
    const relativePath = relative(projectPath, sourceFile);
    const baseName = relativePath.replace(/\.(ts|tsx|js|jsx)$/, '');

    for (const testExt of TEST_EXTENSIONS) {
      const testPath = join(projectPath, `${baseName}${testExt}`);
      if (existsSync(testPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Obtient le chemin du fichier de test
   */
  private getTestPath(sourceFile: string, projectPath: string): string {
    const relativePath = relative(projectPath, sourceFile);
    const baseName = relativePath.replace(/\.(ts|tsx|js|jsx)$/, '');

    // Préférer .test.ts pour TypeScript, .test.js pour JavaScript
    const ext = sourceFile.endsWith('.ts') || sourceFile.endsWith('.tsx') ? '.test.ts' : '.test.js';

    return join(projectPath, `${baseName}${ext}`);
  }

  /**
   * Écrit le fichier de test
   */
  private async writeTestFile(testPath: string, content: string): Promise<void> {
    const dir = dirname(testPath);

    try {
      await mkdir(dir, { recursive: true });
      await writeFile(testPath, content, 'utf-8');
      this.logger.debug(`Created test file: ${testPath}`);
    } catch (error) {
      this.logger.error(`Failed to write test file: ${testPath}`, error);
      throw error;
    }
  }

  /**
   * Exécute les tests générés
   */
  async runTests(projectPath: string): Promise<{ success: boolean; output: string }> {
    const command = 'npm test -- --run --reporter=json 2>&1 || true';
    const result = await this.docker.exec(command, {
      workingDir: projectPath,
      timeout: 60000,
    });

    return {
      success: result.exitCode === 0,
      output: result.stdout + result.stderr,
    };
  }
}
