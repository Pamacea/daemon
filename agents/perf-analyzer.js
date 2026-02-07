/**
 * Daemon - Performance Analyzer Agent
 *
 * Analyzes application performance including:
 * - API response times
 * - Database query efficiency
 * - Bundle size
 * - Web Vitals
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  container: 'daemon-tools',
  docker: 'docker exec',
};

/**
 * Run k6 performance test
 */
function runK6Test(testFile, options = {}) {
  const stages = options.stages || [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ];

  const thresholds = options.thresholds || [
    'http_req_duration[p(95)]<200',
    'http_req_failed<0.01',
  ];

  // Create temp k6 script
  const script = generateK6Script(options.target || 'http://host.docker.internal:3000', stages, thresholds);

  return runDockerCommand(`k6 run -`, { input: script });
}

/**
 * Generate k6 test script
 */
function generateK6Script(target, stages, thresholds) {
  return `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: ${JSON.stringify(stages)},
  thresholds: {
    ${thresholds.map(t => `'${t}': true`).join(',\n    ')}
  },
};

const BASE_URL = '${target}';

export default function () {
  let res = http.get(\`\${BASE_URL}/\`);
  check(res, {
    'homepage OK': r => r.status === 200,
  });

  sleep(1);

  res = http.get(\`\${BASE_URL}/api/users\`);
  check(res, {
    'users API OK': r => r.status === 200,
    'response time < 200ms': r => r.timings.duration < 200,
  });

  sleep(1);
}
`;
}

/**
 * Analyze bundle size
 */
function analyzeBundleSize(projectDir) {
  const buildDir = path.join(projectDir, '.next', 'static', 'chunks');
  const distDir = path.join(projectDir, 'dist', 'assets');

  let chunksDir;
  if (fs.existsSync(buildDir)) chunksDir = buildDir;
  else if (fs.existsSync(distDir)) chunksDir = distDir;
  else return null;

  const chunks = [];
  let totalSize = 0;

  function analyzeDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        analyzeDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.css'))) {
        const stats = fs.statSync(fullPath);
        const size = stats.size;
        totalSize += size;

        chunks.push({
          name: entry.name,
          size: size,
          sizeKB: (size / 1024).toFixed(2),
          path: path.relative(projectDir, fullPath),
        });
      }
    }
  }

  analyzeDir(chunksDir);

  return {
    totalSize,
    totalSizeKB: (totalSize / 1024).toFixed(2),
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    chunks: chunks.sort((a, b) => b.size - a.size).slice(0, 20), // Top 20
  };
}

/**
 * Analyze database queries (Prisma)
 */
function analyzeDbQueries(projectDir) {
  const prismaDir = path.join(projectDir, 'prisma');
  if (!fs.existsSync(prismaDir)) {
    return null;
  }

  const schemaPath = path.join(prismaDir, 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    return null;
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const models = [];
  const modelMatches = schema.matchAll(/model\s+(\w+)\s*{([^}]+)}/g);

  for (const match of modelMatches) {
    const modelName = match[1];
    const body = match[2];

    const fields = [];
    const fieldMatches = body.matchAll(/(\w+)\s+(\w+)(?:\s+@([^{\s]+[^}]*))?/g);

    for (const fieldMatch of fieldMatches) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const attributes = fieldMatch[3] || '';

      fields.push({
        name: fieldName,
        type: fieldType,
        attributes: attributes,
        isIndexed: attributes.includes('index') || attributes.includes('unique') || attributes.includes('id'),
      });
    }

    models.push({
      name: modelName,
      fields: fields,
    });
  }

  return {
    models,
    recommendations: generateDbRecommendations(models),
  };
}

/**
 * Generate database recommendations
 */
function generateDbRecommendations(models) {
  const recommendations = [];

  for (const model of models) {
    // Check for common filter fields without indexes
    const filterFields = ['email', 'username', 'slug', 'status', 'published', 'createdAt'];

    for (const field of model.fields) {
      if (filterFields.includes(field.name) && !field.isIndexed) {
        recommendations.push({
          type: 'index',
          model: model.name,
          field: field.name,
          message: `Consider adding index on ${model.name}.${field.name}`,
          priority: field.name === 'email' ? 'high' : 'medium',
        });
      }
    }
  }

  return recommendations;
}

/**
 * Analyze Web Vitals (Lighthouse)
 */
function analyzeWebVitals(target) {
  // This would run Playwright with metrics
  return runDockerCommand(`npx playwright test --reporter=json`, {
    cwd: path.join(process.cwd(), 'tests', 'e2e'),
  });
}

/**
 * Run command in Docker container
 */
function runDockerCommand(command, options = {}) {
  const dockerCmd = `${CONFIG.docker} ${CONFIG.container} ${command}`;

  try {
    return {
      success: true,
      output: execSync(dockerCmd, {
        encoding: 'utf-8',
        stdio: options.silent ? 'pipe' : 'inherit',
        input: options.input,
      }),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate performance report
 */
function generateReport(analysis) {
  const report = {
    summary: {},
    recommendations: [],
  };

  // Bundle analysis
  if (analysis.bundle) {
    report.summary.bundle = {
      totalSize: analysis.bundle.totalSizeMB + ' MB',
      largestChunks: analysis.bundle.chunks.slice(0, 5),
    };

    // Check for large bundles
    analysis.bundle.chunks.forEach((chunk) => {
      if (chunk.size > 200 * 1024) { // > 200KB
        report.recommendations.push({
          type: 'bundle',
          message: `Large chunk: ${chunk.name} (${chunk.sizeKB} KB)`,
          priority: 'medium',
        });
      }
    });
  }

  // DB analysis
  if (analysis.db) {
    report.summary.database = {
      models: analysis.db.models.length,
      recommendations: analysis.db.recommendations,
    };
    report.recommendations.push(...analysis.db.recommendations);
  }

  return report;
}

/**
 * Full performance analysis
 */
function analyze(projectDir) {
  const analysis = {
    bundle: analyzeBundleSize(projectDir),
    db: analyzeDbQueries(projectDir),
  };

  return generateReport(analysis);
}

module.exports = {
  runK6Test,
  analyzeBundleSize,
  analyzeDbQueries,
  analyzeWebVitals,
  generateReport,
  analyze,
};
