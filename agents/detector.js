/**
 * Daemon - Project Detector
 *
 * Analyzes a project directory to detect:
 * - Framework (Next.js, Remix, SvelteKit, Vite, etc.)
 * - Language (TypeScript, JavaScript, Python, etc.)
 * - Test Runner (Vitest, Jest, Pytest, etc.)
 * - Database (Prisma, Drizzle, Neon, Supabase, local)
 * - Existing tests
 * - Coverage
 * - Key dependencies
 * - Target URL
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Framework patterns
const FRAMEWORK_PATTERNS = {
  'Next.js': [
    { file: 'package.json', pattern: /"next"\s*:/ },
    { file: 'next.config.js', exists: true },
    { file: 'next.config.mjs', exists: true },
    { file: 'next.config.ts', exists: true },
  ],
  'Remix': [
    { file: 'package.json', pattern: /"@remix-run\/node"\s*:/ },
    { file: 'remix.config.js', exists: true },
    { file: 'remix.config.ts', exists: true },
  ],
  'SvelteKit': [
    { file: 'package.json', pattern: /"@sveltejs\/kit"\s*:/ },
    { file: 'svelte.config.js', exists: true },
  ],
  'Nuxt': [
    { file: 'package.json', pattern: /"nuxt"\s*:/ },
    { file: 'nuxt.config.ts', exists: true },
    { file: 'nuxt.config.js', exists: true },
  ],
  'Vite + React': [
    { file: 'package.json', pattern: /"vite"\s*:/ },
    { file: 'package.json', pattern: /"react"\s*:/ },
    { not: ['Next.js', 'Remix', 'SvelteKit', 'Nuxt'] },
  ],
  'Vite + Vue': [
    { file: 'package.json', pattern: /"vite"\s*:/ },
    { file: 'package.json', pattern: /"vue"\s*:/ },
  ],
  'Vite + Svelte': [
    { file: 'package.json', pattern: /"vite"\s*:/ },
    { file: 'package.json', pattern: /"svelte"\s*:/ },
  ],
  'Astro': [
    { file: 'package.json', pattern: /"astro"\s*:/ },
  ],
  'Gatsby': [
    { file: 'package.json', pattern: /"gatsby"\s*:/ },
  ],
  'Angular': [
    { file: 'angular.json', exists: true },
  ],
};

// Database patterns
const DATABASE_PATTERNS = {
  'Prisma Postgres': {
    package: /@prisma\/client/,
    schema: /provider\s*=\s*"postgresql"/,
  },
  'Prisma MySQL': {
    package: /@prisma\/client/,
    schema: /provider\s*=\s*"mysql"/,
  },
  'Prisma SQLite': {
    package: /@prisma\/client/,
    schema: /provider\s*=\s*"sqlite"/,
  },
  'Prisma': {
    package: /@prisma\/client/,
  },
  'Drizzle': {
    package: /drizzle-orm/,
  },
  'TypeORM': {
    package: /typeorm/,
  },
  'MikroORM': {
    package: /@mikro-orm/,
  },
  'Mongoose': {
    package: /mongoose/,
  },
};

// Test runner patterns
const TEST_RUNNER_PATTERNS = {
  'Vitest': {
    package: /vitest/,
    config: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs'],
  },
  'Jest': {
    package: /jest/,
    config: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs'],
  },
  'Mocha': {
    package: /mocha/,
  },
  'Jasmine': {
    package: /jasmine/,
  },
};

// Important dependency categories
const DEPS_CATEGORIES = {
  'Router': ['@tanstack/react-router', '@tanstack/react-router', 'react-router', 'react-router-dom', 'next/router', '@remix-run/react', '@sveltejs/kit', 'vue-router', 'react-navigation'],
  'State': ['zustand', '@reduxjs/toolkit', 'redux', 'jotai', 'recoil', 'valtio', 'mobx', 'pinia', 'vuex'],
  'Query': ['@tanstack/react-query', '@tanstack/react-query', '@tanstack/solid-query', '@tanstack/vue-query', 'swr', 'react-query', '@apollo/client'],
  'Forms': ['react-hook-form', 'formik', 'zod', 'yup', 'joi', 'superstruct', 'valibot'],
  'UI': ['@radix-ui', '@headlessui', '@chakra-ui', '@mui/material', 'antd', 'mantine', 'shadcn/ui', 'tailwindcss'],
  'Testing': ['@testing-library/react', '@testing-library/vue', '@testing-library/svelte', '@testing-library/dom'],
  'E2E': ['@playwright/test', 'cypress', '@wdio/cli', 'nightwatch', 'testcafe'],
};

/**
 * Detect database connection details from .env files
 */
function detectDatabaseConnection(projectDir, dbType) {
  const envFiles = ['.env', '.env.local', '.env.development', '.env.test'];
  let connection = 'DATABASE_URL';
  let provider = null;

  for (const envFile of envFiles) {
    const envPath = path.join(projectDir, envFile);
    if (!fs.existsSync(envPath)) continue;

    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');

      // Detect provider-specific URLs
      if (envContent.includes('neon.tech') || envContent.includes('NEON')) {
        provider = 'Neon Postgres';
        connection = 'DATABASE_URL (Neon)';
      } else if (envContent.includes('supabase.co') || envContent.includes('SUPABASE')) {
        provider = 'Supabase Postgres';
        connection = 'DATABASE_URL (Supabase)';
      } else if (envContent.includes('planetscale.com') || envContent.includes('PLANETSCALE')) {
        provider = 'PlanetScale MySQL';
        connection = 'DATABASE_URL (PlanetScale)';
      } else if (envContent.includes('turso') || envContent.includes('TURSO')) {
        provider = 'Turso SQLite';
        connection = 'DATABASE_URL (Turso)';
      } else if (envContent.includes('localhost') || envContent.includes('127.0.0.1')) {
        provider = 'Local Database';
        connection = 'DATABASE_URL (localhost)';
      } else if (envContent.includes('railway.app') || envContent.includes('RAILWAY')) {
        provider = 'Railway';
        connection = 'DATABASE_URL (Railway)';
      } else if (envContent.includes('render.com') || envContent.includes('RENDER')) {
        provider = 'Render';
        connection = 'DATABASE_URL (Render)';
      }

      // Extract port if local
      if (provider === 'Local Database') {
        const portMatch = envContent.match(/:(\d{4,5})/);
        if (portMatch) {
          connection = `localhost:${portMatch[1]}`;
        }
      }

      if (provider) break;
    } catch (e) {
      // Skip files that can't be read
    }
  }

  return {
    type: provider || dbType || 'Database detected',
    connection: connection,
    testStrategy: 'transaction-rollback',
  };
}

/**
 * Read package.json safely
 */
function readPackageJson(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * Detect framework from package.json and project structure
 */
function detectFramework(projectDir, pkg) {
  if (!pkg) return null;

  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    let matchScore = 0;

    for (const pattern of patterns) {
      if (pattern.exists !== undefined) {
        const filePath = path.join(projectDir, pattern.file);
        if (fs.existsSync(filePath) === pattern.exists) {
          matchScore++;
        }
      } else if (pattern.pattern) {
        if (pattern.pattern.test(JSON.stringify(allDeps))) {
          matchScore++;
        }
      }
    }

    if (matchScore > 0) {
      // Check if it should be excluded
      if (patterns.some(p => p.not && p.not.includes(framework))) {
        continue;
      }
      return framework;
    }
  }

  // Fallback detection
  if (allDeps.express) return 'Express';
  if (allDeps.fastify) return 'Fastify';
  if (allDeps.hono) return 'Hono';
  if (allDeps.koa) return 'Koa';
  if (allDeps.nest) return 'NestJS';
  if (allDeps['@nestjs/core']) return 'NestJS';
  if (allDeps.django || allDeps['django-rest-framework']) return 'Django';
  if (allDeps.flask) return 'Flask';
  if (allDeps.fastapi) return 'FastAPI';
  if (allDeps.spring) return 'Spring Boot';

  return null;
}

/**
 * Detect language
 */
function detectLanguage(projectDir, pkg) {
  if (!pkg) return 'JavaScript';

  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  // Check for TypeScript
  if (allDeps.typescript || allDeps['@types/node']) {
    return 'TypeScript';
  }

  // Check source files
  const srcDir = path.join(projectDir, 'src');
  if (fs.existsSync(srcDir)) {
    const hasTs = hasFilesWithExtension(srcDir, ['.ts', '.tsx']);
    const hasJs = hasFilesWithExtension(srcDir, ['.js', '.jsx']);

    if (hasTs && !hasJs) return 'TypeScript';
    if (hasTs && hasJs) return 'TypeScript + JavaScript';
  }

  return 'JavaScript';
}

/**
 * Detect test runner
 */
function detectTestRunner(projectDir, pkg) {
  if (!pkg) return 'Vitest';

  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  // Check for Vitest first (most common in modern projects)
  if (allDeps.vitest) return 'Vitest';
  if (allDeps.jest) return 'Jest';
  if (allDeps.mocha) return 'Mocha';
  if (allDeps.jasmine) return 'Jasmine';

  // Check for config files
  if (fs.existsSync(path.join(projectDir, 'vitest.config.ts'))) return 'Vitest';
  if (fs.existsSync(path.join(projectDir, 'vitest.config.js'))) return 'Vitest';
  if (fs.existsSync(path.join(projectDir, 'jest.config.js'))) return 'Jest';
  if (fs.existsSync(path.join(projectDir, 'jest.config.ts'))) return 'Jest';

  return 'Vitest'; // Default for modern projects
}

/**
 * Detect database
 */
function detectDatabase(projectDir, pkg) {
  if (!pkg) return null;

  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  // Check for Prisma
  if (allDeps['@prisma/client'] || allDeps['@prisma/client']) {
    const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
    let provider = 'Prisma';

    if (fs.existsSync(schemaPath)) {
      try {
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        if (schema.includes('provider = "postgresql"')) {
          provider = 'Prisma Postgres';
        } else if (schema.includes('provider = "mysql"')) {
          provider = 'Prisma MySQL';
        } else if (schema.includes('provider = "sqlite"')) {
          provider = 'Prisma SQLite';
        } else if (schema.includes('provider = "mongodb"')) {
          provider = 'Prisma MongoDB';
        } else if (schema.includes('provider = "cockroachdb"')) {
          provider = 'Prisma CockroachDB';
        }
      } catch (e) {
        // Schema not readable
      }
    }

    return detectDatabaseConnection(projectDir, provider);
  }

  // Check for Drizzle
  if (allDeps['drizzle-orm']) {
    return detectDatabaseConnection(projectDir, 'Drizzle ORM');
  }

  // Check for TypeORM
  if (allDeps.typeorm) {
    return detectDatabaseConnection(projectDir, 'TypeORM');
  }

  // Check for MikroORM
  if (allDeps['@mikro-orm'] || allDeps['@mikro-orm/core']) {
    return detectDatabaseConnection(projectDir, 'MikroORM');
  }

  // Check for Mongoose
  if (allDeps.mongoose) {
    return detectDatabaseConnection(projectDir, 'MongoDB (Mongoose)');
  }

  return null;
}

/**
 * Count existing test files
 */
function countExistingTests(projectDir) {
  const testExtensions = ['.test.ts', '.test.tsx', '.test.js', '.test.jsx',
                          '.spec.ts', '.spec.tsx', '.spec.js', '.spec.jsx'];

  let count = 0;

  function countInDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and other common exclusions
          if (['node_modules', '.next', 'dist', 'build', '.git', 'coverage'].includes(entry.name)) {
            continue;
          }
          countInDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          const baseName = path.basename(entry.name, ext);
          const fullName = baseName + ext;

          if (testExtensions.some(te => fullName.endsWith(te))) {
            count++;
          }
        }
      }
    } catch (e) {
      // Skip directories that can't be read
    }
  }

  countInDir(projectDir);
  return count;
}

/**
 * Get coverage if available
 */
function getCoverage(projectDir) {
  const coverageDirs = ['coverage', '.nyc_output'];
  const coverageFiles = ['coverage/coverage-summary.json', 'coverage-summary.json'];

  for (const file of coverageFiles) {
    const filePath = path.join(projectDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const coverage = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        // Try to extract total coverage
        if (coverage.total) {
          const lines = coverage.total.lines?.pct || 0;
          return `${Math.round(lines)}%`;
        }
      } catch (e) {
        // Can't read coverage
      }
    }
  }

  return null;
}

/**
 * Get key dependencies by category
 */
function getKeyDependencies(projectDir, pkg) {
  if (!pkg) return [];

  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const keyDeps = [];

  for (const [category, patterns] of Object.entries(DEPS_CATEGORIES)) {
    for (const pattern of patterns) {
      if (allDeps[pattern]) {
        keyDeps.push(`${category}: ${pattern}`);
        break;
      }
    }
  }

  // Add some important standalone dependencies
  if (allDeps.zod && !keyDeps.some(d => d.includes('zod'))) {
    keyDeps.push('Forms: zod');
  }
  if (allDeps.next) {
    keyDeps.push('Framework: next');
  }
  if (allDeps.react) {
    keyDeps.push('UI: react');
  }
  if (allDeps.vue) {
    keyDeps.push('UI: vue');
  }
  if (allDeps.svelte) {
    keyDeps.push('UI: svelte');
  }

  return keyDeps;
}

/**
 * Detect target URL for testing
 */
function detectTargetUrl(projectDir, pkg) {
  const platform = process.platform;

  // Determine host based on platform
  let host;
  if (platform === 'linux') {
    host = 'localhost';
  } else {
    // macOS and Windows Docker runs in a VM
    host = 'host.docker.internal';
  }

  // Try to detect port from package.json scripts
  let port = '3000'; // Default

  if (pkg && pkg.scripts) {
    const scripts = Object.values(pkg.scripts).join(' ');

    const portMatches = scripts.match(/-p\s*(\d{4,5})/gi);
    if (portMatches) {
      const numbers = portMatches.map(m => parseInt(m.replace(/-p\s*/, '')));
      port = numbers[0]?.toString() || port;
    }

    const devPortMatch = scripts.match(/PORT=(\d{4,5})/i);
    if (devPortMatch) {
      port = devPortMatch[1];
    }

    const nextPortMatch = scripts.match(/next\s+dev.*-p\s*(\d{4,5})/);
    if (nextPortMatch) {
      port = nextPortMatch[1];
    }
  }

  // Check .env files for PORT
  const envFiles = ['.env', '.env.local', '.env.development'];
  for (const envFile of envFiles) {
    const envPath = path.join(projectDir, envFile);
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const portMatch = envContent.match(/^PORT=(\d{4,5})/m);
        if (portMatch) {
          port = portMatch[1];
          break;
        }
      } catch (e) {
        // Skip
      }
    }
  }

  return `http://${host}:${port}`;
}

/**
 * Helper: Check if directory has files with extension
 */
function hasFilesWithExtension(dir, extensions) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        return true;
      }
    }
  } catch (e) {
    // Directory not readable
  }
  return false;
}

/**
 * Main analysis function
 */
async function analyze(projectDir) {
  const pkg = readPackageJson(projectDir);

  const context = {
    framework: detectFramework(projectDir, pkg) || 'Unknown',
    language: detectLanguage(projectDir, pkg),
    testRunner: detectTestRunner(projectDir, pkg),
    database: detectDatabase(projectDir, pkg),
    existingTests: countExistingTests(projectDir),
    coverage: getCoverage(projectDir),
    dependencies: getKeyDependencies(projectDir, pkg),
    target: detectTargetUrl(projectDir, pkg),
  };

  return context;
}

// Export for use in CLI
if (require.main === module) {
  const projectDir = process.argv[2] || process.cwd();
  analyze(projectDir)
    .then(context => {
      console.log(JSON.stringify(context, null, 2));
    })
    .catch(err => {
      console.error('Analysis failed:', err);
      process.exit(1);
    });
}

module.exports = { analyze };
