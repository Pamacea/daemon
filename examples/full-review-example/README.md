# Full Review Example

Exemple complet de review Daemon avec tous les analyseurs.

## Projet

Un projet "real-world" avec divers types de problèmes pour démontrer toutes les capacités de Daemon.

## Types de Problèmes

### 1. Static Analysis Issues

```typescript
// ❌ Unused imports
import { unused, useState, useEffect } from 'react';

// ❌ Unused variables
const data = fetchData();
const result = processData(data);

// ❌ Missing return type
function getUser(id) {
  return db.users.find(id);
}
```

### 2. Security Issues

```typescript
// ❌ Exposed secret
const API_KEY = 'sk_live_1234567890abcdef';

// ❌ SQL injection risk
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ❌ eval usage
const parsed = eval(data);

// ❌ Non-https request
fetch('http://api.example.com/data');
```

### 3. Performance Issues

```typescript
// ❌ Unnecessary re-renders
function Parent() {
  const [data, setData] = useState([]);
  return <Child data={data} onClick={handleClick} />;
}

// ❌ Large bundle imports
import _ from 'lodash';
import { BigNumber } from 'bignumber.js';

// ❌ N+1 queries
async function getUsersWithPosts() {
  const users = await db.users.findAll();
  for (const user of users) {
    user.posts = await db.posts.findByUser(user.id);
  }
}
```

### 4. Code Quality Issues

```typescript
// ❌ High complexity
function processComplexData(data) {
  if (data.type === 'A') {
    if (data.subtype === 1) {
      if (data.status === 'active') {
        if (data.confirmed) {
          // ... 10 more levels
        }
      }
    }
  }
}

// ❌ Code duplication
function validateUserA(user) {
  if (!user.email) return false;
  if (!user.name) return false;
  return true;
}

function validateUserB(user) {
  if (!user.email) return false;
  if (!user.name) return false;
  return true;
}

// ❌ Magic numbers
const size = data.length * 1.5 + 42;
```

## Lancer la Review Complète

```bash
cd full-review-example

# Review avec tous les analyseurs
npx @oalacea/daemon review --verbose

# Review avec sortie JSON
npx @oalacea/daemon review --json > review.json

# Review avec auto-fix
npx @oalacea/daemon review --fix --dry-run
```

## Rapport Attendu

```json
{
  "summary": {
    "totalIssues": 47,
    "critical": 5,
    "high": 12,
    "medium": 18,
    "low": 12,
    "fixable": 32,
    "score": 62
  },
  "categories": {
    "static": {
      "issues": 15,
      "fixable": 12,
      "topIssues": [
        "Unused imports: 8 files",
        "Missing return types: 5 functions",
        "Unused variables: 3 variables"
      ]
    },
    "security": {
      "issues": 5,
      "fixable": 2,
      "topIssues": [
        "Exposed secret in config.ts",
        "SQL injection risk in users.service.ts",
        "eval() usage in parser.ts",
        "Non-https request in api.ts",
        "Missing CORS headers"
      ]
    },
    "dependencies": {
      "issues": 8,
      "fixable": 8,
      "topIssues": [
        "5 outdated packages",
        "2 vulnerable dependencies",
        "1 duplicate dependency"
      ]
    },
    "performance": {
      "issues": 10,
      "fixable": 6,
      "topIssues": [
        "Unnecessary re-renders: 3 components",
        "Large bundle: lodash (500KB)",
        "N+1 query in users.service.ts",
        "Missing lazy loading: 2 routes"
      ]
    },
    "code-quality": {
      "issues": 9,
      "fixable": 4,
      "topIssues": [
        "High complexity: 4 functions",
        "Code duplication: 3 pairs",
        "Magic numbers: 12 occurrences",
        "Long functions: 2 > 50 lines"
      ]
    }
  }
}
```

## Recommandations Prioritaires

### 🔴 Critical (Fix Immediately)

1. **Exposed API Secret** - `src/config/api.ts:12`
   - Move to environment variable
   - Rotate the exposed key
   - Impact: +15 pts security

2. **SQL Injection** - `src/services/users.ts:45`
   - Use parameterized queries
   - Impact: +10 pts security

3. **Eval Usage** - `src/utils/parser.ts:23`
   - Replace with JSON.parse or proper parser
   - Impact: +8 pts security

### 🟠 High Priority

4. **Unused Dependencies** - `package.json`
   - Remove: moment, lodash
   - Impact: +5 pts performance

5. **Complex Function** - `src/components/DataGrid.tsx`
   - Refactor into smaller functions
   - Impact: +5 pts quality

6. **N+1 Query** - `src/services/users.ts:78`
   - Use eager loading
   - Impact: +8 pts performance

## Auto-Fix

```bash
# Prévisualiser les fixes
npx @oalacea/daemon review --fix --dry-run

# Appliquer les fixes sûrs
npx @oalacea/daemon review --fix --categories static

# Créer une PR avec les fixes
npx @oalacea/daemon review --fix --branch="fix/daemon-auto-fix"
```

## CI/CD Integration

```yaml
name: Daemon Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Daemon Review
        run: npx @oalacea/daemon review --json > review.json

      - name: Check Score
        run: |
          SCORE=$(node -e "console.log(require('./review.json').summary.score)")
          if [ $SCORE -lt 70 ]; then
            echo "Score $SCORE is below minimum 70"
            exit 1
          fi

      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const review = require('./review.json');
            const body = `## Daemon Review

            | Metric | Value |
            |--------|-------|
            | Total Issues | ${review.summary.totalIssues} |
            | Critical | ${review.summary.critical} 🔴 |
            | High | ${review.summary.high} 🟠 |
            | Medium | ${review.summary.medium} 🟡 |
            | Low | ${review.summary.low} 🟢 |
            | Fixable | ${review.summary.fixable} 🔧 |
            | Score | ${review.summary.score}/100 |

            ### Top Issues
            ${review.issues.slice(0, 5).map(i =>
              `- **[${i.severity}]** \`${i.location.file}:${i.location.line}\`\n  ${i.message}`
            ).join('\n')}
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```
