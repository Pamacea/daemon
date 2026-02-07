/**
 * Daemon - Configuration Utilities
 *
 * Handles project configuration and settings.
 */

const fs = require('fs');
const path = require('path');

/**
 * Get project root directory
 */
function getProjectRoot() {
  let currentDir = process.cwd();

  while (currentDir !== path.parse(currentDir).root) {
    const pkgPath = path.join(currentDir, 'package.json');

    if (fs.existsSync(pkgPath)) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

/**
 * Read package.json
 */
function readPackageJson(projectDir = getProjectRoot()) {
  const pkgPath = path.join(projectDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Get all dependencies
 */
function getDependencies(projectDir = getProjectRoot()) {
  const pkg = readPackageJson(projectDir);

  if (!pkg) {
    return {};
  }

  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
}

/**
 * Check if a dependency exists
 */
function hasDependency(depName, projectDir = getProjectRoot()) {
  const deps = getDependencies(projectDir);
  return depName in deps;
}

/**
 * Get dependency version
 */
function getDependencyVersion(depName, projectDir = getProjectRoot()) {
  const deps = getDependencies(projectDir);
  return deps[depName] || null;
}

/**
 * Check if project uses TypeScript
 */
function isTypeScriptProject(projectDir = getProjectRoot()) {
  return (
    hasDependency('typescript', projectDir) ||
    fs.existsSync(path.join(projectDir, 'tsconfig.json'))
  );
}

/**
 * Get test runner
 */
function getTestRunner(projectDir = getProjectRoot()) {
  const deps = getDependencies(projectDir);

  if (deps.vitest) return 'vitest';
  if (deps.jest) return 'jest';
  if (deps.mocha) return 'mocha';
  if (deps.jasmine) return 'jasmine';

  // Check config files
  const vitestConfig = path.join(projectDir, 'vitest.config.ts');
  const jestConfig = path.join(projectDir, 'jest.config.js');

  if (fs.existsSync(vitestConfig)) return 'vitest';
  if (fs.existsSync(jestConfig)) return 'jest';

  return 'vitest'; // Default
}

/**
 * Get framework
 */
function getFramework(projectDir = getProjectRoot()) {
  const deps = getDependencies(projectDir);

  // Meta-frameworks
  if (deps.next) return 'Next.js';
  if (deps['@remix-run/node']) return 'Remix';
  if (deps['@sveltejs/kit']) return 'SvelteKit';
  if (deps.nuxt) return 'Nuxt';
  if (deps.astro) return 'Astro';
  if (deps.gatsby) return 'Gatsby';

  // UI frameworks
  if (deps['solid-js']) return 'Solid';
  if (deps['@angular/core']) return 'Angular';
  if (deps.vue) return 'Vue';
  if (deps.svelte) return 'Svelte';
  if (deps['react-native']) return 'React Native';

  // Build tools / Runtimes
  if (deps.vite) return 'Vite';
  if (deps.express) return 'Express';
  if (deps.nest) return 'NestJS';

  // Check for React without a specific framework
  if (deps.react && deps['react-dom']) return 'React';

  return 'Unknown';
}

/**
 * Get database config
 */
function getDatabaseConfig(projectDir = getProjectRoot()) {
  const deps = getDependencies(projectDir);

  if (deps['@prisma/client']) {
    return {
      type: 'Prisma',
      schemaPath: path.join(projectDir, 'prisma', 'schema.prisma'),
    };
  }

  if (deps['drizzle-orm']) {
    return {
      type: 'Drizzle',
    };
  }

  if (deps.typeorm) {
    return {
      type: 'TypeORM',
    };
  }

  if (deps.mongoose) {
    return {
      type: 'Mongoose',
    };
  }

  return null;
}

/**
 * Get environment variable
 */
function getEnvVar(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

/**
 * Get Daemon config from package.json
 */
function getDaemonConfig(projectDir = getProjectRoot()) {
  const pkg = readPackageJson(projectDir);

  if (!pkg || !pkg.daemon) {
    return {};
  }

  return pkg.daemon;
}

/**
 * Get source directory
 */
function getSourceDir(projectDir = getProjectRoot()) {
  const srcDir = path.join(projectDir, 'src');
  const appDir = path.join(projectDir, 'app');

  if (fs.existsSync(appDir)) {
    return 'app';
  }

  if (fs.existsSync(srcDir)) {
    return 'src';
  }

  return '.';
}

/**
 * Get test directory
 */
function getTestDir(projectDir = getProjectRoot()) {
  const testsDir = path.join(projectDir, 'tests');
  const testDir = path.join(projectDir, 'test');
  const srcTestsDir = path.join(getSourceDir(projectDir), 'tests');

  if (fs.existsSync(testsDir)) {
    return 'tests';
  }

  if (fs.existsSync(testDir)) {
    return 'test';
  }

  if (fs.existsSync(srcTestsDir)) {
    return path.join(getSourceDir(projectDir), 'tests');
  }

  return 'tests';
}

module.exports = {
  getProjectRoot,
  readPackageJson,
  getDependencies,
  hasDependency,
  getDependencyVersion,
  isTypeScriptProject,
  getTestRunner,
  getFramework,
  getDatabaseConfig,
  getEnvVar,
  getDaemonConfig,
  getSourceDir,
  getTestDir,
};
