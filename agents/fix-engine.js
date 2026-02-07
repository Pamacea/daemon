/**
 * Daemon - Fix Engine
 *
 * Analyzes test failures and applies fixes.
 * Handles common test issues automatically.
 */

const fs = require('fs');
const path = require('path');

/**
 * Analyze test failure and categorize
 */
function categorizeFailure(errorOutput, testPath) {
  if (!errorOutput) return { category: 'unknown' };

  if (errorOutput.includes('Cannot find module')) {
    return { category: 'import', message: 'Module import issue' };
  }

  if (errorOutput.includes('is not defined') || errorOutput.includes('is not a function')) {
    return { category: 'mock', message: 'Missing mock' };
  }

  if (errorOutput.includes('timeout')) {
    return { category: 'timeout', message: 'Test timeout' };
  }

  if (errorOutput.includes('Expected') && errorOutput.includes('Received')) {
    return { category: 'assertion', message: 'Assertion failed' };
  }

  if (errorOutput.includes('Cannot read property')) {
    return { category: 'null', message: 'Null/undefined access' };
  }

  if (errorOutput.includes('ECONNREFUSED') || errorOutput.includes('connect')) {
    return { category: 'connection', message: 'Connection refused' };
  }

  return { category: 'unknown', message: 'Unknown error' };
}

/**
 * Fix import issues
 */
function fixImportIssue(testPath, error) {
  const content = fs.readFileSync(testPath, 'utf-8');
  const missingModule = error.match(/Cannot find module ['"](.+)['"]/)?.[1];

  if (!missingModule) return false;

  // Check if it's a relative import issue
  if (missingModule.startsWith('@/')) {
    // Check if vitest.config.ts has the alias
    const vitestConfig = path.join(process.cwd(), 'vitest.config.ts');
    if (fs.existsSync(vitestConfig)) {
      const config = fs.readFileSync(vitestConfig, 'utf-8');
      if (!config.includes('resolve:') || !config.includes('alias:')) {
        return {
          fixType: 'config',
          message: 'Add path alias to vitest.config.ts',
          configFix: `
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});`,
        };
      }
    }
  }

  return {
    fixType: 'import',
    message: `Create or update import for ${missingModule}`,
  };
}

/**
 * Fix mock issues
 */
function fixMockIssue(testPath, error) {
  const content = fs.readFileSync(testPath, 'utf-8');
  const missingVar = error.match(/(.+) is not defined/)?.[1];

  if (!missingVar) return false;

  // Check if it's a hook/function that needs mocking
  if (missingVar.startsWith('use')) {
    return {
      fixType: 'mock',
      message: `Add mock for ${missingVar}`,
      mock: `vi.mock('@/hooks/${missingVar}', () => ({
      ${missingVar}: vi.fn(() => ({/* default return */})),
    }));`,
    };
  }

  return {
    fixType: 'mock',
    message: `Add mock for ${missingVar}`,
  };
}

/**
 * Fix assertion issues
 */
function fixAssertionIssue(testPath, error) {
  const content = fs.readFileSync(testPath, 'utf-8');

  // Check for common issues
  if (error.includes('querySelector returned null')) {
    return {
      fixType: 'selector',
      message: 'Element not found - use queryBy or add waitFor',
      suggestion: 'Replace getBy with queryBy for optional elements, or add waitFor',
    };
  }

  if (error.includes('received null') || error.includes('received undefined')) {
    return {
      fixType: 'assertion',
      message: 'Element/property is null/undefined',
      suggestion: 'Check if component renders with required props',
    };
  }

  return {
    fixType: 'manual',
    message: 'Manual fix required',
    error,
  };
}

/**
 * Fix timeout issues
 */
function fixTimeoutIssue(testPath, error) {
  return {
    fixType: 'timeout',
    message: 'Increase test timeout or fix async operation',
    suggestion: `Add timeout to test: it('test name', async () => { ... }, { timeout: 10000 })`,
  };
}

/**
 * Fix connection issues
 */
function fixConnectionIssue(testPath, error) {
  return {
    fixType: 'mock',
    message: 'Mock external API calls',
    suggestion: 'Use vi.mock or MSW to mock fetch/axios calls',
  };
}

/**
 * Generate fix for a failing test
 */
function generateFix(testPath, error) {
  const failure = categorizeFailure(error, testPath);

  switch (failure.category) {
    case 'import':
      return fixImportIssue(testPath, error);
    case 'mock':
      return fixMockIssue(testPath, error);
    case 'timeout':
      return fixTimeoutIssue(testPath, error);
    case 'assertion':
      return fixAssertionIssue(testPath, error);
    case 'connection':
      return fixConnectionIssue(testPath, error);
    default:
      return {
        fixType: 'manual',
        message: 'Manual analysis required',
        error,
      };
  }
}

/**
 * Apply fix to file
 */
function applyFix(testPath, fix) {
  if (!fix) return false;

  const content = fs.readFileSync(testPath, 'utf-8');
  let newContent = content;

  switch (fix.fixType) {
    case 'mock':
      // Add mock at top of file after imports
      const importsEnd = content.indexOf(');', content.indexOf('import '));
      if (importsEnd > -1) {
        newContent = content.slice(0, importsEnd + 2) +
          '\n\n' + fix.mock +
          content.slice(importsEnd + 2);
      }
      break;

    case 'timeout':
      // Add timeout option to it() call
      newContent = content.replace(
        /it\('([^']+)',\s*(async\s*)?\(([^)]*)\)\s*=>/g,
        "it('$1', async ($2) => { ... }, { timeout: 10000 })"
      );
      break;

    case 'selector':
      // Suggest using queryBy instead of getBy
      newContent = content.replace(
        /getBy\(([^)]+)\)/g,
        'queryBy($1) || getBy($1)'
      );
      break;

    default:
      return false;
  }

  if (newContent !== content) {
    fs.writeFileSync(testPath, newContent);
    return true;
  }

  return false;
}

/**
 * Fix all failing tests
 */
function fixFailures(testResults) {
  const fixes = [];

  for (const result of testResults) {
    if (result.status === 'failed') {
      const fix = generateFix(result.file, result.error);
      fixes.push({
        file: result.file,
        error: result.error,
        fix,
      });
    }
  }

  return fixes;
}

/**
 * Create fix summary
 */
function createFixSummary(fixes) {
  const summary = {
    total: fixes.length,
    applied: 0,
    manual: 0,
    failed: 0,
    details: [],
  };

  for (const fix of fixes) {
    const detail = {
      file: fix.file,
      type: fix.fix?.fixType || 'unknown',
      message: fix.fix?.message || 'No fix available',
      applied: false,
    };

    if (fix.fix?.fixType === 'manual') {
      summary.manual++;
      detail.applied = false;
    } else if (fix.fix) {
      // Try to apply fix
      // const applied = applyFix(fix.file, fix.fix);
      // if (applied) summary.applied++;
      // else summary.failed++;
      summary.manual++; // For safety, mark as manual
      detail.applied = false;
    } else {
      summary.failed++;
    }

    summary.details.push(detail);
  }

  return summary;
}

module.exports = {
  categorizeFailure,
  fixImportIssue,
  fixMockIssue,
  fixAssertionIssue,
  fixTimeoutIssue,
  fixConnectionIssue,
  generateFix,
  applyFix,
  fixFailures,
  createFixSummary,
};
