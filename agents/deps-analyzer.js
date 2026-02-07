/**
 * Daemon - Dependency Efficiency Analyzer
 *
 * Analyzes codebase for dependency usage patterns and inefficiencies:
 * - TanStack Router patterns
 * - React Query usage
 * - Prisma query patterns
 * - Zustand store patterns
 * - React Compiler readiness
 */

const fs = require('fs');
const path = require('path');

/**
 * Find files matching a pattern
 */
function findFiles(dir, pattern, excludeDirs = ['node_modules', '.next', 'dist', 'build']) {
  const files = [];

  function traverse(currentDir) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (excludeDirs.includes(entry.name)) continue;
        traverse(path.join(currentDir, entry.name));
      } else if (entry.isFile() && entry.name.match(pattern)) {
        files.push(path.join(currentDir, entry.name));
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Read file content
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Analyze TanStack Router usage
 */
function analyzeTanStackRouter(projectDir) {
  const findings = {
    good: [],
    issues: [],
    recommendations: [],
  };

  const routeFiles = findFiles(path.join(projectDir, 'src'), /routes/);

  for (const file of routeFiles) {
    const content = readFile(file);

    // Check for typed routes
    if (content.includes('useParams') || content.includes('$')) {
      findings.good.push(`Typed params in ${path.relative(projectDir, file)}`);
    }

    // Check for loaders
    if (content.includes('loader:') || content.includes('loaderBefore')) {
      findings.good.push(`Data loader in ${path.relative(projectDir, file)}`);
    } else if (content.includes('useQuery') || content.includes('useFetch')) {
      findings.issues.push(`Missing loader in ${path.relative(projectDir, file)} - data fetching without loader`);
    }

    // Check for error boundaries
    if (content.includes('loader:') && !content.includes('errorComponent') && !content.includes('ErrorBoundary')) {
      findings.issues.push(`Missing error boundary in ${path.relative(projectDir, file)}`);
      findings.recommendations.push(`Add errorComponent to route in ${path.relative(projectDir, file)}`);
    }
  }

  // Check navigation for prefetching
  const componentFiles = findFiles(path.join(projectDir, 'src'), /.*\.(tsx|jsx)$/);
  for (const file of componentFiles) {
    const content = readFile(file);
    if (content.includes('<Link') && !content.includes('prefetch=') && !content.includes('prefetchIntent')) {
      findings.issues.push(`Link prefetching not enabled in ${path.relative(projectDir, file)}`);
    }
  }

  return findings;
}

/**
 * Analyze React Query usage
 */
function analyzeReactQuery(projectDir) {
  const findings = {
    good: [],
    issues: [],
    recommendations: [],
  };

  const hookFiles = findFiles(path.join(projectDir, 'src'), /hooks/);
  const componentFiles = findFiles(path.join(projectDir, 'src'), /.*\.(tsx|jsx)$/);
  const allFiles = [...hookFiles, ...componentFiles];

  for (const file of allFiles) {
    const content = readFile(file);

    if (!content.includes('useQuery') && !content.includes('useMutation')) continue;

    // Check for array cache keys
    if (content.includes('useQuery(') || content.includes('useInfiniteQuery(')) {
      const hasArrayKey = /\['/.test(content) || /queryKey:\s*\[/.test(content);
      if (hasArrayKey) {
        findings.good.push(`Array-based cache keys in ${path.relative(projectDir, file)}`);
      } else {
        findings.issues.push(`Non-array cache keys in ${path.relative(projectDir, file)}`);
        findings.recommendations.push(`Use array-based cache keys in ${path.relative(projectDir, file)}`);
      }
    }

    // Check for staleTime
    if (content.includes('useQuery(') && !content.includes('staleTime')) {
      findings.issues.push(`Missing staleTime in ${path.relative(projectDir, file)}`);
      findings.recommendations.push(`Add staleTime to queries in ${path.relative(projectDir, file)}`);
    }

    // Check for mutation invalidation
    if (content.includes('useMutation(')) {
      if (content.includes('invalidateQueries')) {
        findings.good.push(`Proper invalidation in ${path.relative(projectDir, file)}`);
      } else {
        findings.issues.push(`Missing invalidation in mutation at ${path.relative(projectDir, file)}`);
      }
    }
  }

  return findings;
}

/**
 * Analyze Prisma usage
 */
function analyzePrisma(projectDir) {
  const findings = {
    good: [],
    issues: [],
    recommendations: [],
  };

  const libFiles = findFiles(path.join(projectDir, 'src'), /.*\.(ts|js)$/);

  for (const file of libFiles) {
    const content = readFile(file);

    if (!content.includes('prisma.')) continue;

    // Check for select usage
    if (content.includes('prisma.') && content.includes('findMany')) {
      if (content.includes('select:')) {
        findings.good.push(`Using select in ${path.relative(projectDir, file)}`);
      } else if (content.includes('.findMany().then')) {
        findings.issues.push(`Not using select in ${path.relative(projectDir, file)} - returning full objects`);
        findings.recommendations.push(`Add select to prisma queries in ${path.relative(projectDir, file)}`);
      }
    }

    // Check for potential N+1
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('findMany') || lines[i].includes('findFirst')) {
        // Check next 10 lines for forEach with prisma query
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('forEach') && lines[j].includes('prisma.')) {
            findings.issues.push(`Potential N+1 query in ${path.relative(projectDir, file)}:${i + 1}`);
            findings.recommendations.push(`Use include or separate query with WHERE in ${path.relative(projectDir, file)}`);
            break;
          }
        }
      }
    }
  }

  // Check schema for indexes
  const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
  if (fs.existsSync(schemaPath)) {
    const schema = readFile(schemaPath);
    const models = schema.matchAll(/model\s+(\w+)\s*{([^}]+)}/g);

    for (const modelMatch of models) {
      const modelName = modelMatch[1];
      const body = modelMatch[2];

      if (body.includes('email') && !body.includes('@@index') && !body.includes('@@unique')) {
        findings.recommendations.push(`Add index on ${modelName}.email for faster lookups`);
      }
    }
  }

  return findings;
}

/**
 * Analyze Zustand usage
 */
function analyzeZustand(projectDir) {
  const findings = {
    good: [],
    issues: [],
    recommendations: [],
  };

  const storeFiles = findFiles(path.join(projectDir, 'src'), /store|stores/);
  const componentFiles = findFiles(path.join(projectDir, 'src'), /.*\.(tsx|jsx)$/);

  for (const file of storeFiles) {
    const content = readFile(file);

    // Check store size
    const lines = content.split('\n').length;
    if (lines > 500) {
      findings.issues.push(`Large store file ${path.relative(projectDir, file)} (${lines} lines)`);
      findings.recommendations.push(`Consider splitting ${path.basename(file)} into multiple stores`);
    }
  }

  for (const file of componentFiles) {
    const content = readFile(file);

    if (!content.includes('useStore')) continue;

    // Check for full-store subscriptions
    if (content.includes('useStore()') || content.match(/useStore\(\s*state\s*=>\s*state/)) {
      findings.issues.push(`Full-store subscription in ${path.relative(projectDir, file)}`);
      findings.recommendations.push(`Use selectors for specific fields in ${path.relative(projectDir, file)}`);
    }
  }

  return findings;
}

/**
 * Analyze React Compiler readiness
 */
function analyzeReactCompilerReadiness(projectDir) {
  const findings = {
    good: [],
    issues: [],
    recommendations: [],
  };

  const componentFiles = findFiles(path.join(projectDir, 'src'), /.*\.(tsx|jsx)$/);

  for (const file of componentFiles) {
    const content = readFile(file);

    // Check for simple useMemo that can be removed
    const simpleMemo = content.match(/useMemo\(\(\)\s*=>\s*([^,]+),\s*\[[^\]]*\]\)/g);
    if (simpleMemo) {
      for (const memo of simpleMemo) {
        const value = memo.match(/=>\s*(.+),/)?.[1];
        if (value && !value.includes('()') && !value.includes('function')) {
          findings.recommendations.push(`Remove simple useMemo in ${path.basename(file)} - React Compiler will handle this`);
        }
      }
    }

    // Check for useCallback dependencies
    const useCallbacks = content.matchAll(/useCallback\([^)]+\)/g);
    for (const callback of useCallbacks) {
      const deps = callback[0].match(/\[([^\]]*)\]/)?.[1];
      if (deps && deps.trim() === '') {
        findings.issues.push(`useCallback with empty deps in ${path.basename(file)}`);
      }
    }

    // Check for large inline objects
    const largeObjects = content.match(/{{[\s\S]{200,}}}/g);
    if (largeObjects) {
      findings.issues.push(`Large inline object in ${path.basename(file)} - move outside component`);
      findings.recommendations.push(`Extract large objects to constants in ${path.basename(file)}`);
    }
  }

  return findings;
}

/**
 * Analyze bundle optimization
 */
function analyzeBundleOptimization(projectDir) {
  const findings = {
    good: [],
    issues: [],
    recommendations: [],
  };

  const files = findFiles(path.join(projectDir, 'src'), /.*\.(ts|tsx|js|jsx)$/);

  for (const file of files) {
    const content = readFile(file);

    // Check for namespace imports
    if (content.includes('* as ')) {
      findings.issues.push(`Namespace import in ${path.basename(file)}`);
      findings.recommendations.push(`Use named imports for better tree-shaking in ${path.basename(file)}`);
    }

    // Check for large library imports
    const largeLibs = ['monaco-editor', 'codemirror', 'pdfjs-dist', 'fabric'];
    for (const lib of largeLibs) {
      if (content.includes(`from '${lib}'`) || content.includes(`from "${lib}"`)) {
        if (!content.includes('dynamic(') && !content.includes('React.lazy')) {
          findings.recommendations.push(`Use dynamic import for ${lib} in ${path.basename(file)}`);
        }
      }
    }
  }

  // Check package.json for duplicate dependencies
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(readFile(pkgPath));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    for (const [name, version] of Object.entries(deps)) {
      if (name.startsWith('@types/')) {
        const mainPkg = name.substring(6);
        if (mainPkg in deps) {
          findings.good.push(`Types package for ${mainPkg} found`);
        }
      }
    }
  }

  return findings;
}

/**
 * Run full analysis
 */
function analyze(projectDir) {
  return {
    tanStackRouter: analyzeTanStackRouter(projectDir),
    reactQuery: analyzeReactQuery(projectDir),
    prisma: analyzePrisma(projectDir),
    zustand: analyzeZustand(projectDir),
    reactCompiler: analyzeReactCompilerReadiness(projectDir),
    bundleOptimization: analyzeBundleOptimization(projectDir),
  };
}

module.exports = {
  analyze,
  analyzeTanStackRouter,
  analyzeReactQuery,
  analyzePrisma,
  analyzeZustand,
  analyzeReactCompilerReadiness,
  analyzeBundleOptimization,
};
