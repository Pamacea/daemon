/**
 * Daemon - Test Runner Agent
 *
 * Executes tests and parses results.
 * Supports Vitest, Jest, and Playwright.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  container: 'daemon-tools',
  docker: 'docker exec',
};

/**
 * Run tests inside the Docker container
 */
function runTests(command, options = {}) {
  const dockerCmd = `${CONFIG.docker} ${CONFIG.container} ${command}`;

  try {
    const output = execSync(dockerCmd, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      timeout: options.timeout || 120000,
      cwd: options.cwd || process.cwd(),
    });

    return {
      success: true,
      output,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
      exitCode: error.status || 1,
    };
  }
}

/**
 * Run unit tests
 */
function runUnitTests(testFile = null) {
  const cmd = testFile
    ? `npm test -- ${testFile}`
    : `npm test`;

  return runTests(cmd);
}

/**
 * Run integration tests
 */
function runIntegrationTests(testFile = null) {
  const cmd = testFile
    ? `npm test -- ${testFile}`
    : `npm test -- tests/integration`;

  return runTests(cmd);
}

/**
 * Run E2E tests
 */
function runE2ETests(testFile = null) {
  const cmd = testFile
    ? `npx playwright test ${testFile}`
    : `npx playwright test`;

  return runTests(cmd);
}

/**
 * Run performance tests
 */
function runPerformanceTests(testFile = null) {
  const cmd = testFile
    ? `k6 run ${testFile}`
    : `k6 run tests/performance`;

  return runTests(cmd);
}

/**
 * Parse Vitest/Jest output
 */
function parseTestOutput(output) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  };

  // Parse Vitest output
  const testFiles = output.match(/Test Files\s+\d+ passed/g);
  if (testFiles) {
    results.total += parseInt(testFiles[0].match(/\d+/)[0]);
  }

  const passed = output.match(/(\d+) passed/);
  if (passed) {
    results.passed += parseInt(passed[1]);
  }

  const failed = output.match(/(\d+) failed/);
  if (failed) {
    results.failed += parseInt(failed[1]);
    // Parse failure details
    const failOutput = output.match(/FAIL\s+(.+)/g);
    if (failOutput) {
      results.failures = failOutput.map((f) => {
        const match = f.match(/FAIL\s+(.+?)\s+/);
        return match ? match[1] : f;
      });
    }
  }

  const skipped = output.match(/(\d+) skipped/);
  if (skipped) {
    results.skipped += parseInt(skipped[1]);
  }

  return results;
}

/**
 * Parse Playwright output
 */
function parseE2EOutput(output) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  };

  const passed = output.match(/passed\s+(\d+)/);
  if (passed) results.passed += parseInt(passed[1]);

  const failed = output.match(/failed\s+(\d+)/);
  if (failed) {
    results.failed += parseInt(failed[1]);
    // Parse failure details
    const failLines = output.match(/^.*?\[ERROR\].*$/gm);
    if (failLines) {
      results.failures = failLines;
    }
  }

  const skipped = output.match(/skipped\s+(\d+)/);
  if (skipped) results.skipped += parseInt(skipped[1]);

  results.total = results.passed + results.failed + results.skipped;

  return results;
}

/**
 * Parse k6 output
 */
function parsePerfOutput(output) {
  const results = {
    requests: 0,
    duration: 0,
    avgResponseTime: 0,
    p95: 0,
    p99: 0,
    rps: 0,
    failureRate: 0,
  };

  // Parse k6 summary output
  const checks = output.match(/checks.*?:\s+([\d.]+)%/);
  if (checks) results.failureRate = 100 - parseFloat(checks[1]);

  const dataReceived = output.match(/data_received\s+([\d.]+\s+\w+)/);
  if (dataReceived) results.dataReceived = dataReceived[1];

  const httpReqDuration = output.match(/http_req_duration.*?avg=\s*([\d.]+)ms.*?p\(95\)=\s*([\d.]+)ms/);
  if (httpReqDuration) {
    results.avgResponseTime = parseFloat(httpReqDuration[1]);
    results.p95 = parseFloat(httpReqDuration[2]);
  }

  const httpReqs = output.match(/http_reqs\s+([\d.]+)/);
  if (httpReqs) results.requests = parseInt(httpReqs[1]);

  const iterationDuration = output.match(/iteration_duration.*?avg=\s*([\d.]+)/);
  if (iterationDuration) results.duration = parseFloat(iterationDuration[1]);

  return results;
}

/**
 * Get test coverage
 */
function getCoverage() {
  const result = runTests('npm test -- --coverage');

  if (!result.success) {
    return null;
  }

  const coverage = {
    lines: 0,
    functions: 0,
    branches: 0,
    statements: 0,
  };

  // Parse coverage output
  const lines = result.output.match(/All files[^]*?(\d+)%/);
  if (lines) coverage.lines = parseInt(lines[1]);

  const functions = result.output.match(/functions[^]*?(\d+)%/);
  if (functions) coverage.functions = parseInt(functions[1]);

  const branches = result.output.match(/branches[^]*?(\d+)%/);
  if (branches) coverage.branches = parseInt(branches[1]);

  const statements = result.output.match(/statements[^]*?(\d+)%/);
  if (statements) coverage.statements = parseInt(statements[1]);

  return coverage;
}

/**
 * Run all tests and return summary
 */
async function runAllTests() {
  const summary = {
    unit: null,
    integration: null,
    e2e: null,
    performance: null,
    coverage: null,
  };

  // Unit tests
  const unitResult = runUnitTests();
  summary.unit = {
    ...parseTestOutput(unitResult.output),
    success: unitResult.success,
  };

  // Integration tests
  const integrationResult = runIntegrationTests();
  summary.integration = {
    ...parseTestOutput(integrationResult.output),
    success: integrationResult.success,
  };

  // E2E tests
  const e2eResult = runE2ETests();
  summary.e2e = {
    ...parseE2EOutput(e2eResult.output),
    success: e2eResult.success,
  };

  // Performance tests
  const perfResult = runPerformanceTests();
  summary.performance = {
    ...parsePerfOutput(perfResult.output),
    success: perfResult.success,
  };

  // Coverage
  summary.coverage = getCoverage();

  return summary;
}

/**
 * Run a single test file
 */
function runSingleTest(testPath) {
  return runTests(`npm test -- ${testPath}`);
}

/**
 * Watch tests
 */
function watchTests() {
  return runTests('npm test -- --watch');
}

/**
 * Debug a failing test
 */
function debugTest(testPath) {
  return runTests(`npm test -- ${testPath} --reporter=verbose --no-coverage`);
}

module.exports = {
  runTests,
  runUnitTests,
  runIntegrationTests,
  runE2ETests,
  runPerformanceTests,
  parseTestOutput,
  parseE2EOutput,
  parsePerfOutput,
  getCoverage,
  runAllTests,
  runSingleTest,
  watchTests,
  debugTest,
};
