/**
 * Daemon - Lighthouse Page Scanner
 *
 * Automatically discovers and tests all pages with Lighthouse:
 * 1. Scans project for routes/pages
 * 2. Generates page list
 * 3. Runs Lighthouse on each page
 * 4. Aggregates results
 * 5. Generates recommendations
 */

const fs = require('fs');
const path = require('path');

/**
 * Discover pages based on framework
 */
function discoverPages(projectDir, framework) {
  const pages = [];

  switch (framework) {
    case 'Next.js':
      // App Router
      const appDir = path.join(projectDir, 'app');
      if (fs.existsSync(appDir)) {
        pages.push(...scanNextjsAppDir(appDir));
      }
      // Pages Router
      const pagesDir = path.join(projectDir, 'pages');
      if (fs.existsSync(pagesDir)) {
        pages.push(...scanNextjsPagesDir(pagesDir));
      }
      break;

    case 'Remix':
      const remixRoutesDir = path.join(projectDir, 'app', 'routes');
      if (fs.existsSync(remixRoutesDir)) {
        pages.push(...scanRemixRoutes(remixRoutesDir));
      }
      break;

    case 'SvelteKit':
      const svelteRoutesDir = path.join(projectDir, 'src', 'routes');
      if (fs.existsSync(svelteRoutesDir)) {
        pages.push(...scanSvelteKitRoutes(svelteRoutesDir));
      }
      break;

    case 'Nuxt':
      const nuxtPagesDir = path.join(projectDir, 'pages');
      if (fs.existsSync(nuxtPagesDir)) {
        pages.push(...scanNuxtPages(nuxtPagesDir));
      }
      break;

    case 'Vite':
    case 'React':
    case 'Vue':
    case 'Solid':
    case 'Svelte':
      const srcIndex = path.join(projectDir, 'src', 'App.tsx');
      const srcIndexVue = path.join(projectDir, 'src', 'App.vue');
      const mainJsx = path.join(projectDir, 'src', 'main.jsx');

      if (fs.existsSync(srcIndex) || fs.existsSync(srcIndexVue) || fs.existsSync(mainJsx)) {
        pages.push({
          path: '/',
          name: 'Home',
          priority: 'critical',
          source: 'SPA entry point'
        });
      }
      break;

    case 'Angular':
      const angularRoutes = path.join(projectDir, 'src', 'app', 'app-routing.module.ts');
      if (fs.existsSync(angularRoutes)) {
        pages.push(...scanAngularRoutes(angularRoutes));
      }
      break;

    case 'Express':
    case 'NestJS':
      pages.push(
        ...scanExpressRoutes(projectDir)
      );
      break;
  }

  // Always add common routes for web apps
  const commonRoutes = [
    { path: '/', name: 'Home', priority: 'critical' },
    { path: '/login', name: 'Login', priority: 'high' },
    { path: '/register', name: 'Register', priority: 'medium' },
    { path: '/dashboard', name: 'Dashboard', priority: 'high' },
  ];

  // Merge without duplicates
  const existingPaths = new Set(pages.map(p => p.path));
  for (const route of commonRoutes) {
    if (!existingPaths.has(route.path)) {
      pages.push({ ...route, source: 'common route' });
    }
  }

  return pages.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Scan Next.js App Router
 */
function scanNextjsAppDir(appDir, basePath = '') {
  const pages = [];
  const items = fs.readdirSync(appDir, { withFileTypes: true });

  for (const item of items) {
    if (item.name.startsWith('_')) continue; // Ignore _layout, _error, etc.

    const fullPath = path.join(appDir, item.name);
    const routePath = basePath + (item.name === 'page.tsx' || item.name === 'page.ts'
      ? '/'
      : `/${item.name.replace(/\.tsx?$/, '').replace(/\[\.{3}.+\]/, '*').replace(/\[(.+)\]/, ':$1')}`);

    if (item.isDirectory()) {
      pages.push(...scanNextjsAppDir(fullPath, routePath));
    } else if (item.name.startsWith('page.')) {
      pages.push({
        path: routePath === '' ? '/' : routePath,
        name: getPageName(routePath),
        priority: routePath === '/' ? 'critical' : 'medium',
        source: fullPath
      });
    }
  }

  return pages;
}

/**
 * Scan Next.js Pages Router
 */
function scanNextjsPagesDir(pagesDir, basePath = '') {
  const pages = [];
  const items = fs.readdirSync(pagesDir, { withFileTypes: true });

  for (const item of items) {
    if (item.name.startsWith('_')) continue;

    const fullPath = path.join(pagesDir, item.name);
    const routePath = basePath + (item.name === 'index.tsx' || item.name === 'index.ts'
      ? '/'
      : `/${item.name.replace(/\.tsx?$/, '')}`);

    if (item.isDirectory()) {
      pages.push(...scanNextjsPagesDir(fullPath, routePath));
    } else if (item.name.endsWith('.tsx') || item.name.endsWith('.ts')) {
      pages.push({
        path: routePath,
        name: getPageName(routePath),
        priority: routePath === '/' || routePath.includes('dashboard') ? 'high' : 'medium',
        source: fullPath
      });
    }
  }

  return pages;
}

/**
 * Scan Remix routes
 */
function scanRemixRoutes(routesDir, basePath = '') {
  const pages = [];
  const items = fs.readdirSync(routesDir, { withFileTypes: true });

  for (const item of items) {
    if (item.name.startsWith('_')) continue;

    const fullPath = path.join(routesDir, item.name);
    const routePath = basePath + (item.name === 'root.tsx' || item.name === 'root.ts'
      ? '/'
      : `/${item.name.replace(/\.tsx?$/, '').replace(/\[\.{3}.+\]/, '*').replace(/\[(.+)\]/, ':$1')}`);

    if (item.isDirectory()) {
      pages.push(...scanRemixRoutes(fullPath, routePath));
    } else if (!item.name.startsWith('_')) {
      pages.push({
        path: routePath === '' ? '/' : routePath,
        name: getPageName(routePath),
        priority: routePath === '/' ? 'critical' : 'medium',
        source: fullPath
      });
    }
  }

  return pages;
}

/**
 * Scan SvelteKit routes
 */
function scanSvelteKitRoutes(routesDir, basePath = '') {
  const pages = [];
  const items = fs.readdirSync(routesDir, { withFileTypes: true });

  for (const item of items) {
    if (item.name.startsWith('_')) continue;

    const fullPath = path.join(routesDir, item.name);
    const routePath = basePath + (item.name === '+page.svelte'
      ? '/'
      : `/${item.name.replace(/\+\w+\./, '').replace(/\[\.{3}.+\]/, '*').replace(/\[(.+)\]/, ':$1')}`);

    if (item.isDirectory()) {
      pages.push(...scanSvelteKitRoutes(fullPath, routePath));
    } else if (item.name.includes('+page')) {
      pages.push({
        path: routePath === '' ? '/' : routePath,
        name: getPageName(routePath),
        priority: routePath === '/' ? 'critical' : 'medium',
        source: fullPath
      });
    }
  }

  return pages;
}

/**
 * Scan Nuxt pages
 */
function scanNuxtPages(pagesDir, basePath = '') {
  const pages = [];
  const items = fs.readdirSync(pagesDir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(pagesDir, item.name);
    const routePath = basePath + (item.name === 'index.vue'
      ? '/'
      : `/${item.name.replace(/\.vue$/, '').replace(/\[\.{3}.+\]/, '*').replace(/\[(.+)\]/, ':$1')}`);

    if (item.isDirectory()) {
      pages.push(...scanNuxtPages(fullPath, routePath));
    } else if (item.name.endsWith('.vue')) {
      pages.push({
        path: routePath,
        name: getPageName(routePath),
        priority: routePath === '/' ? 'critical' : 'medium',
        source: fullPath
      });
    }
  }

  return pages;
}

/**
 * Scan Angular routes (basic)
 */
function scanAngularRoutes(routingFile) {
  const content = fs.readFileSync(routingFile, 'utf-8');
  const pages = [
    { path: '/', name: 'Home', priority: 'critical', source: routingFile }
  ];

  // Extract path definitions from RouterModule
  const pathMatches = content.matchAll(/path:\s*['"`]([^'"`]+)['"`]/g);
  for (const match of pathMatches) {
    const routePath = match[1];
    if (routePath !== '' && routePath !== '**') {
      pages.push({
        path: `/${routePath}`,
        name: getPageName(`/${routePath}`),
        priority: 'medium',
        source: routingFile
      });
    }
  }

  return pages;
}

/**
 * Scan Express/NestJS routes (basic API routes)
 */
function scanExpressRoutes(projectDir) {
  const pages = [];

  // For API routes, we typically test the API documentation or main endpoints
  const commonApiRoutes = [
    { path: '/api', name: 'API Root', priority: 'low', source: 'API routes' },
    { path: '/api/health', name: 'Health Check', priority: 'low', source: 'API routes' },
  ];

  // Try to find route definitions
  const srcFiles = findFiles(projectDir, ['.ts', '.js'], ['routes', 'controllers']);

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8');

    // Look for route definitions like app.get(), router.get(), @Get(), etc.
    const getRoutes = content.matchAll(/(?:app|router)\.get\(['"`]([^'"`]+)['"`]/g);
    for (const match of getRoutes) {
      pages.push({
        path: `/api${match[1]}`,
        name: `API: ${match[1]}`,
        priority: 'low',
        source: file
      });
    }
  }

  return pages.length > 0 ? pages : commonApiRoutes;
}

/**
 * Helper: Find files recursively
 */
function findFiles(dir, extensions, keywords = []) {
  const results = [];

  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && !item.name.startsWith('.')) {
        results.push(...findFiles(fullPath, extensions, keywords));
      }
    } else if (extensions.some(ext => item.name.endsWith(ext))) {
      if (keywords.length === 0 || keywords.some(kw => fullPath.includes(kw))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Helper: Get readable page name
 */
function getPageName(routePath) {
  if (routePath === '/') return 'Home';

  const parts = routePath.split('/').filter(Boolean);
  return parts
    .map(p => p.replace(/[:-]/g, ' ').replace(/\*/g, 'wildcard'))
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' / ');
}

/**
 * Generate Lighthouse commands for all pages
 */
function generateLighthouseCommands(pages, baseUrl) {
  return pages.map((page, index) => ({
    ...page,
    command: `npx lighthouse "${baseUrl}${page.path}" --output=json --output=html --chrome-flags="--headless --no-sandbox" --quiet`,
    outputPath: path.join(process.cwd(), 'reports', `lighthouse-${index}-${page.path.replace(/\//g, '-')}.json`)
  }));
}

/**
 * Create page scanner summary
 */
function createPageSummary(pages) {
  const byPriority = {
    critical: pages.filter(p => p.priority === 'critical'),
    high: pages.filter(p => p.priority === 'high'),
    medium: pages.filter(p => p.priority === 'medium'),
    low: pages.filter(p => p.priority === 'low'),
  };

  return {
    total: pages.length,
    byPriority,
    pages: pages.map(p => ({
      path: p.path,
      name: p.name,
      priority: p.priority,
      source: p.source
    }))
  };
}

module.exports = {
  discoverPages,
  generateLighthouseCommands,
  createPageSummary,
  // Export scanner functions for testing
  scanNextjsAppDir,
  scanNextjsPagesDir,
  scanRemixRoutes,
  scanSvelteKitRoutes,
  scanNuxtPages,
  scanAngularRoutes,
  scanExpressRoutes,
};
