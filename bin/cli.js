#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// --- Config ---
const CONFIG = {
  IMAGE: 'daemon-tools',
  CONTAINER: 'daemon-tools',
  PROMPT_SRC: path.join(__dirname, '..', 'prompts', 'EXECUTE.md'),
  // Output in current working directory
  PROMPT_DEST: path.join(process.cwd(), '.daemon', 'EXECUTE.md'),
  PROJECT_DIR: process.cwd(),
  DOCKERFILE: path.join(__dirname, 'Dockerfile')
};

// --- Colors ---
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const blue = (s) => `\x1b[34m${s}\x1b[0m`;
const magenta = (s) => `\x1b[35m${s}\x1b[0m`;

// --- Utilities ---
function run(cmd, { silent = false, timeout = 60000 } = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout }).trim();
  } catch (error) {
    if (!silent && error.status !== null) {
      console.error(dim(`  [debug] Command exited with code ${error.status}`));
    }
    return null;
  }
}

function fail(msg) {
  console.error(`\n  ${red('✗')} ${msg}\n`);
  process.exit(1);
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// --- Project Markers ---
const PROJECT_MARKERS = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'composer.json',
  'Cargo.toml'
];

function hasProjectFiles() {
  const cwd = path.resolve(process.cwd());
  try {
    const realCwd = fs.realpathSync(cwd);
    if (realCwd !== cwd) {
      console.warn(yellow('  ⚠ Symbolic link detected in path, using real path'));
    }
  } catch {
    // realpathSync failed, continue with cwd
  }
  return PROJECT_MARKERS.some((f) => fs.existsSync(path.join(cwd, f)));
}

// --- Detection Import ---
function runDetection(projectDir) {
  const detectorPath = path.join(__dirname, '..', 'agents', 'detector.js');

  if (!fs.existsSync(detectorPath)) {
    // Fallback if detector doesn't exist yet
    return {
      framework: 'Unknown',
      language: 'JavaScript/TypeScript',
      testRunner: 'Vitest',
      database: null,
      existingTests: 0,
      coverage: null,
      dependencies: [],
      target: 'http://localhost:3000'
    };
  }

  try {
    // Execute detector as a module
    const detector = require(detectorPath);
    return detector.analyze(projectDir);
  } catch (e) {
    console.log(dim(`  [debug] Detection error: ${e.message}`));
    return {
      framework: 'Unknown',
      language: 'JavaScript/TypeScript',
      testRunner: 'Vitest',
      database: null,
      existingTests: 0,
      coverage: null,
      dependencies: [],
      target: 'http://localhost:3000'
    };
  }
}

// --- Prompt Generation ---
function generatePrompt(context) {
  const promptSrc = CONFIG.PROMPT_SRC;

  if (!fs.existsSync(promptSrc)) {
    return generateFallbackPrompt(context);
  }

  const basePrompt = fs.readFileSync(promptSrc, 'utf-8');

  // Build context block
  const contextBlock = buildContextBlock(context);

  return contextBlock + '\n' + basePrompt;
}

function buildContextBlock(context) {
  const lines = [
    '> **DETECTED CONTEXT**',
  ];

  if (context.framework) {
    lines.push(`> Framework: ${context.framework}`);
  }
  if (context.language) {
    lines.push(`> Language: ${context.language}`);
  }
  if (context.testRunner) {
    lines.push(`> Test Runner: ${context.testRunner}`);
  }
  if (context.database) {
    lines.push(`> Database: ${context.database.type || 'detected'}`);
    lines.push(`> DB Connection: ${context.database.connection || 'DATABASE_URL'}`);
    lines.push(`> Test Strategy: Transaction rollback (do not modify real data)`);
  } else {
    lines.push(`> Database: none detected`);
  }
  lines.push(`> Existing Tests: ${context.existingTests || 0} found`);
  if (context.coverage) {
    lines.push(`> Current Coverage: ${context.coverage}`);
  }
  if (context.dependencies && context.dependencies.length > 0) {
    lines.push(`> Key Dependencies: ${context.dependencies.join(', ')}`);
  }
  lines.push(`> Target: ${context.target || 'http://localhost:3000'}`);

  lines.push('');
  lines.push('> **IMPORTANT**:');
  lines.push('> - Use this detected context. Do not re-detect.');
  lines.push('> - Always read source code before generating tests.');
  lines.push('> - Run tests to verify they work before declaring success.');
  if (context.database) {
    lines.push('> - Use transaction rollback for DB tests - never modify real data.');
  }
  lines.push('');
  lines.push('> **WORKFLOW**:');
  lines.push('> 1. Read ./.daemon/EXECUTE.md for full instructions');
  lines.push('> 2. Generate tests following the detected patterns');
  lines.push('> 3. Run tests via Docker container');
  lines.push('> 4. Fix failures iteratively until all pass');
  lines.push('> 5. Generate final report');
  lines.push('');

  return lines.join('\n');
}

function generateFallbackPrompt(context) {
  return `# Daemon — Automated Testing Process

> **DETECTED CONTEXT**
> Framework: ${context.framework || 'Unknown'}
> Language: ${context.language || 'JavaScript/TypeScript'}
> Test Runner: ${context.testRunner || 'Vitest'}
> Database: ${context.database?.type || 'none'}
> Target: ${context.target || 'http://localhost:3000'}

## Instructions

This is the automated testing agent. Follow these steps:

1. **Read the project structure** - Understand the framework and patterns
2. **Generate unit tests** - For components, hooks, and utilities
3. **Generate integration tests** - For API routes and database operations
4. **Generate E2E tests** - For critical user flows
5. **Run performance tests** - API load testing and DB query analysis
6. **Analyze dependencies** - Check for efficiency patterns

Always run tests to verify they work. When a test fails, analyze and fix before proceeding.

## Tool Execution

All test tools run inside the Daemon Docker container:

\`\`\`bash
docker exec daemon-tools <command>
\`\`\`

### Available Commands

| Task | Command |
|------|---------|
| Unit tests | \`docker exec daemon-tools npm test\` |
| E2E tests | \`docker exec daemon-tools npx playwright test\` |
| Performance | \`docker exec daemon-tools k6 run tests/performance/load.js\` |

## Phase 1 - Unit Tests

Generate tests for:
- Components (render, props, events, edge cases)
- Hooks (state updates, return values, cleanup)
- Utils (pure functions, validators)

Template:
\`\`\`typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Component } from '@/components/Component';

describe('Component', () => {
  it('should render', () => {
    render(<Component />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
\`\`\`

## Phase 2 - Integration Tests

For API routes and database operations:
\`\`\`typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@test/db';

describe('API Integration', () => {
  beforeEach(async () => {
    await db.begin();
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should create resource', async () => {
    const result = await db.resource.create({ data: { name: 'test' } });
    expect(result).toHaveProperty('id');
  });
});
\`\`\`

## Phase 3 - E2E Tests

Use Playwright for user flows:
\`\`\`typescript
import { test, expect } from '@playwright/test';

test('user journey', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
\`\`\`

## Fix Loop

When tests fail:
1. Analyze the error
2. Determine if it's a test issue or code bug
3. Apply fix
4. Re-test

## Completion

Report:
\`\`\`
✓ Unit Tests: X created, Y passing
✓ Integration: X created, Y passing
✓ E2E: X created, Y passing
✓ Performance: API p95 = Xms
\`\`\`
`;
}

// --- Main Function ---
async function main() {
  console.log('');
  console.log(bold(magenta('  ╔═══════════════════════════════════════╗')));
  console.log(bold(magenta('  ║   Daemon                            ║')));
  console.log(bold(magenta('  ║   AI-Powered Test Generation         ║')));
  console.log(bold(magenta('  ╚═══════════════════════════════════════╝')));
  console.log('');
  console.log(dim('  Automated testing toolkit for web applications'));
  console.log('');

  // Check if we're in a project directory
  if (!hasProjectFiles()) {
    console.log(yellow('  ⚠ No project markers found.'));
    console.log(yellow('  Please run from a project directory with package.json or equivalent.'));
    console.log('');
    const answer = await ask('  Continue anyway? ' + dim('(Y/n)') + ' ');
    if (answer === 'n' || answer === 'no') {
      process.exit(0);
    }
  }

  // --- Step 1: Check Docker ---
  console.log(`  ${dim('→')} Checking Docker...`);
  if (run('docker info', { silent: true }) === null) {
    fail(`Docker is not running.

  Start Docker Desktop (or the Docker daemon) and try again.

  Install Docker: ${cyan('https://docs.docker.com/get-docker/')}`);
  }
  console.log(`  ${green('✓')} Docker is running`);

  // --- Step 2: Build image if missing ---
  const imageExists = run(`docker images -q ${CONFIG.IMAGE}`);

  if (!imageExists) {
    console.log('');
    console.log(`  ${yellow('◆')} The testing toolkit needs to be installed (~500 MB Docker image).`);
    console.log(`  ${dim('This only happens once.')}`);
    console.log('');
    const answer = await ask(`  Install it now? ${dim('(Y/n)')} `);
    if (answer === 'n' || answer === 'no') {
      console.log('');
      console.log(dim('  No problem. Run npx --yes @oalacea/daemon@latest again when you\'re ready.'));
      console.log('');
      process.exit(0);
    }
    console.log('');
    console.log(`  ${yellow('→')} Building testing toolkit...`);
    console.log(dim('  This may take 2-3 minutes on first run...'));
    console.log('');
    try {
      execSync(
        `docker build -t ${CONFIG.IMAGE} -f "${CONFIG.DOCKERFILE}" "${path.dirname(CONFIG.DOCKERFILE)}"`,
        { stdio: 'inherit', timeout: 600000 }
      );
    } catch {
      fail(`Failed to build the testing toolkit image.

  Try manually:
    ${cyan(`docker build -t ${CONFIG.IMAGE} -f "${CONFIG.DOCKERFILE}" "${path.dirname(CONFIG.DOCKERFILE)}"`)}`);
    }
    console.log('');
    console.log(`  ${green('✓')} Testing toolkit installed`);
  } else {
    console.log(`  ${green('✓')} Testing toolkit ready`);
  }

  // --- Step 3: Start container if not running ---
  const containerRunning = run(
    `docker ps --filter "name=^${CONFIG.CONTAINER}$" --format "{{.Names}}"`
  );

  if (containerRunning === CONFIG.CONTAINER) {
    console.log(`  ${green('✓')} Toolkit container running (${bold(CONFIG.CONTAINER)})`);
  } else {
    const containerExists = run(
      `docker ps -a --filter "name=^${CONFIG.CONTAINER}$" --format "{{.Names}}"`
    );

    if (containerExists === CONFIG.CONTAINER) {
      process.stdout.write(`  ${yellow('→')} Starting toolkit container...`);
      if (run(`docker start ${CONFIG.CONTAINER}`, { timeout: 30000 }) === null) {
        console.log('');
        fail(`Failed to start container.

  Try manually:
    ${cyan(`docker start ${CONFIG.CONTAINER}`)}`);
      }
      console.log(` ${green('done')}`);
    } else {
      const isLinux = process.platform === 'linux';
      const networkFlag = isLinux ? '--network=host' : '';

      process.stdout.write(`  ${yellow('→')} Creating toolkit container (${CONFIG.CONTAINER})...`);
      const runCmd = `docker run -d --name ${CONFIG.CONTAINER} ${networkFlag} ${CONFIG.IMAGE}`.replace(/\s+/g, ' ');
      if (run(runCmd, { timeout: 30000 }) === null) {
        console.log('');
        fail(`Failed to create container.

  Try manually:
    ${cyan(runCmd)}`);
      }
      console.log(` ${green('done')}`);
    }
    console.log(`  ${green('✓')} Toolkit container running (${bold(CONFIG.CONTAINER)})`);
  }

  // --- Step 4: Run detection ---
  console.log(`  ${dim('→')} Analyzing project...`);
  const context = runDetection(CONFIG.PROJECT_DIR);

  // --- Step 5: Create daemon directory and prompt ---
  const daemonDir = path.dirname(CONFIG.PROMPT_DEST);
  if (!fs.existsSync(daemonDir)) {
    fs.mkdirSync(daemonDir, { recursive: true });
  }

  const prompt = generatePrompt(context);
  fs.writeFileSync(CONFIG.PROMPT_DEST, prompt);
  console.log(`  ${green('✓')} Prompt installed to ${bold('./.daemon/EXECUTE.md')}`);

  // --- Step 6: Print summary ---
  console.log('');
  console.log(bold('  Detected Configuration:'));
  console.log(`    Framework:    ${cyan(context.framework || 'Unknown')}`);
  console.log(`    Language:     ${cyan(context.language || 'JavaScript/TypeScript')}`);
  console.log(`    Test Runner:  ${cyan(context.testRunner || 'Vitest')}`);
  if (context.database) {
    console.log(`    Database:     ${cyan(context.database.type)}`);
    console.log(`    Connection:   ${cyan(context.database.connection)}`);
  }
  console.log(`    Existing:     ${cyan((context.existingTests || 0) + ' tests')}`);
  console.log(`    Target:       ${cyan(context.target || 'http://localhost:3000')}`);
  console.log('');

  // --- Step 7: Print instructions ---
  console.log(bold('  Ready!') + ' Open your AI agent from your project directory and paste:');
  console.log('');
  console.log(`    ${cyan(`Read ./.daemon/EXECUTE.md and start the testing process`)}`);
  console.log('');
  console.log(dim('  Works with Claude Code, Cursor, Windsurf, Aider, Codex...'));
  console.log('');
}

main();
