/**
 * Daemon - Test Generator Agent
 *
 * Generates test files based on source code analysis.
 * Supports unit, integration, and E2E test generation.
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate a unit test for a component
 */
function generateComponentTest(componentPath, componentName, content) {
  const hasProps = /interface Props|type Props|Props:/.test(content);
  const hasOnClick = /onClick|handleClick/.test(content);
  const hasDisabled = /disabled|isDisabled/.test(content);
  const hasLoading = /loading|isLoading/.test(content);
  const hasChildren = /children|{props\.children}/.test(content);
  const hasError = /error|isError/.test(content);
  const hasVariants = /variant=|variants/.test(content);

  let imports = [
    `import { render, screen } from '@testing-library/react';`,
    `import { describe, it, expect, vi } from 'vitest';`,
    `import { ${componentName} } from '@/components/${componentName}';`,
  ];

  let tests = [];

  // Basic render test
  tests.push(`
  it('should render', () => {
    render(<${componentName} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });`);

  // Children test
  if (hasChildren) {
    tests.push(`
  it('should render children', () => {
    render(<${componentName}>Test content</${componentName}>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });`);
  }

  // Disabled test
  if (hasDisabled) {
    tests.push(`
  it('should be disabled when disabled prop is true', () => {
    render(<${componentName} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });`);
  }

  // Loading test
  if (hasLoading) {
    tests.push(`
  it('should show loading state', () => {
    render(<${componentName} loading />);
    expect(screen.getByTestId(/spinner|loading/i)).toBeInTheDocument();
  });`);
  }

  // Error test
  if (hasError) {
    tests.push(`
  it('should show error message', () => {
    render(<${componentName} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });`);
  }

  // onClick test
  if (hasOnClick) {
    tests.push(`
  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<${componentName} onClick={handleClick} />);
    await screen.getByRole('button').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });`);
  }

  // Variant test
  if (hasVariants) {
    tests.push(`
  it('should apply variant class', () => {
    render(<${componentName} variant="danger" />);
    expect(screen.getByRole('button')).toHaveClass('btn-danger');
  });`);
  }

  return `${imports.join('\n')}

describe('${componentName}', () => {${tests.join('\n')}
});
`;
}

/**
 * Generate a unit test for a hook
 */
function generateHookTest(hookPath, hookName, content) {
  const hasReturn = /return\s*{/.test(content);
  const hasState = /useState|useReducer/.test(content);
  const hasEffect = /useEffect/.test(content);
  const hasCallback = /useCallback/.test(content);
  const hasMemo = /useMemo/.test(content);

  let imports = [
    `import { renderHook, act, waitFor } from '@testing-library/react';`,
    `import { describe, it, expect, vi } from 'vitest';`,
    `import { ${hookName} } from '@/hooks/${hookName}';`,
  ];

  let tests = [];

  // Basic return test
  tests.push(`
  it('should return initial state', () => {
    const { result } = renderHook(() => ${hookName}());
    expect(result.current).toBeDefined();
  });`);

  // State update test
  if (hasState) {
    tests.push(`
  it('should update state', async () => {
    const { result } = renderHook(() => ${hookName}());

    act(() => {
      result.current.setValue('test');
    });

    await waitFor(() => {
      expect(result.current.value).toBe('test');
    });
  });`);
  }

  // Cleanup test
  if (hasEffect) {
    tests.push(`
  it('should cleanup on unmount', () => {
    const cleanup = vi.fn();
    const { unmount } = renderHook(() => ${hookName}({ cleanup }));
    unmount();
    expect(cleanup).toHaveBeenCalled();
  });`);
  }

  return `${imports.join('\n')}

describe('${hookName}', () => {${tests.join('\n')}
});
`;
}

/**
 * Generate a unit test for a utility function
 */
function generateUtilTest(utilPath, utilName, content) {
  const hasParams = /function\s+\w+\s*\(([^)]+)\)|export\s+const\s+\w+\s*=\s*\(([^)]+)\)/.test(content);
  const isAsync = /async\s+function|=>\s*async/.test(content);

  let imports = [
    `import { describe, it, expect } from 'vitest';`,
    `import { ${utilName} } from '@/utils/${utilName}';`,
  ];

  let tests = [];

  if (isAsync) {
    tests.push(`
  it('should return result', async () => {
    const result = await ${utilName}('test');
    expect(result).toBeDefined();
  });`);
  } else {
    tests.push(`
  it('should return result', () => {
    const result = ${utilName}('test');
    expect(result).toBeDefined();
  });`);
  }

  return `${imports.join('\n')}

describe('${utilName}', () => {${tests.join('\n')}
});
`;
}

/**
 * Generate an integration test for an API route
 */
function generateApiTest(routePath, routeMethod, content) {
  const hasValidation = /zod|validate|schema/.test(content);
  const hasAuth = /auth|requireAuth|getSession/.test(content);
  const hasDb = /prisma|db\./.test(content);

  let imports = [
    `import { describe, it, expect, beforeEach, afterEach } from 'vitest';`,
    `import { POST, GET } from '@/app${routePath}/route';`,
  ];

  if (hasDb) {
    imports.push(`import { db } from '@test/db';`);
  }

  let tests = [];

  // Success test
  tests.push(`
  it('should return 200 on success', async () => {
    const request = new Request('http://localhost:3000${routePath}', {
      method: '${routeMethod}',
      body: JSON.stringify({ test: 'data' }),
    });

    const response = await ${routeMethod}(request);
    expect(response.status).toBe(200);
  });`);

  // Validation test
  if (hasValidation) {
    tests.push(`
  it('should return 400 for invalid data', async () => {
    const request = new Request('http://localhost:3000${routePath}', {
      method: '${routeMethod}',
      body: JSON.stringify({ invalid: 'data' }),
    });

    const response = await ${routeMethod}(request);
    expect(response.status).toBe(400);
  });`);
  }

  // Auth test
  if (hasAuth) {
    tests.push(`
  it('should return 401 without auth', async () => {
    const request = new Request('http://localhost:3000${routePath}', {
      method: '${routeMethod}',
    });

    const response = await ${routeMethod}(request);
    expect(response.status).toBe(401);
  });`);
  }

  // DB transaction test
  if (hasDb) {
    tests = [
      `
  beforeEach(async () => {
    await db.begin();
  });`,
      `
  afterEach(async () => {
    await db.rollback();
  });`,
      ...tests,
    ];
  }

  return `${imports.join('\n')}

describe('${routeMethod} ${routePath}', () => {${tests.join('\n')}
});
`;
}

/**
 * Generate an E2E test with Playwright
 */
function generateE2ETest(pageName, actions) {
  let imports = [
    `import { test, expect } from '@playwright/test';`,
  ];

  let testContent = '';

  if (actions.includes('login')) {
    testContent += `
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });`;
  }

  testContent += `

  test('should complete flow', async ({ page }) => {
    await page.goto('/${pageName}');`;

  if (actions.includes('fill')) {
    testContent += `
    await page.fill('input[name="email"]', 'test@example.com');`;
  }

  if (actions.includes('click')) {
    testContent += `
    await page.click('button[type="submit"]');`;
  }

  if (actions.includes('navigate')) {
    testContent += `
    await expect(page).toHaveURL('/dashboard');`;
  }

  testContent += `
  });`;

  return `${imports.join('\n')}

test.describe('${pageName}', () => {${testContent}
});
`;
}

/**
 * Main generator function
 */
function generateTest(type, filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath, path.extname(filePath));

  switch (type) {
    case 'component':
      return generateComponentTest(filePath, filename, content);
    case 'hook':
      return generateHookTest(filePath, filename, content);
    case 'util':
      return generateUtilTest(filePath, filename, content);
    case 'api':
      return generateApiTest(options.route, options.method, content);
    case 'e2e':
      return generateE2ETest(filename, options.actions || []);
    default:
      throw new Error(`Unknown test type: ${type}`);
  }
}

/**
 * Find files without tests
 */
function findFilesWithoutTests(projectDir, pattern) {
  const files = [];

  function findInDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (['node_modules', '.next', 'dist', 'build', '.git', 'coverage'].includes(entry.name)) {
          continue;
        }
        findInDir(fullPath);
      } else if (entry.isFile() && fullPath.match(pattern)) {
        const testPath = fullPath.replace(/\.(tsx?)$/, '.test$1');
        if (!fs.existsSync(testPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  findInDir(projectDir);
  return files;
}

module.exports = {
  generateTest,
  generateComponentTest,
  generateHookTest,
  generateUtilTest,
  generateApiTest,
  generateE2ETest,
  findFilesWithoutTests,
};
