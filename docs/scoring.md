# Scoring System

Le système de scoring de Daemon évalue la qualité du code et des tests selon plusieurs dimensions.

## Overview

Le scoring fournit une évaluation holistique de votre projet sur 5 dimensions principales :

| Dimension | Poids | Description |
|-----------|-------|-------------|
| **Test Coverage** | 30% | % de code couvert par les tests |
| **Code Quality** | 25% | Qualité du code (ESLint, complexesité) |
| **Performance** | 20% | Performance backend et frontend |
| **Security** | 15% | Vulnérabilités et bonnes pratiques |
| **Documentation** | 10% | Documentation du code |

## Score Global

Le score global est calculé ainsi :

```
Score Global = (Coverage × 0.30) + (Quality × 0.25) + (Performance × 0.20) + (Security × 0.15) + (Documentation × 0.10)
```

## Dimensions Détaillées

### 1. Test Coverage (30%)

Mesure le pourcentage de code couvert par les tests.

**Calcul :**
```
Coverage Score = (Lines Covered / Total Lines) × 100
```

**Sous-métriques :**
- **Statement Coverage** : % d'instructions exécutées
- **Branch Coverage** : % de branches conditionnelles testées
- **Function Coverage** : % de fonctions appelées

**Seuils :**
- Excellent : ≥ 80%
- Good : 60-79%
- Average : 40-59%
- Poor : < 40%

### 2. Code Quality (25%)

Évalue la qualité du code via plusieurs métriques.

**Sous-dimensions :**

| Métrique | Poids |
|----------|-------|
| Complexité Cyclomatique | 40% |
| Duplication de Code | 30% |
| Conventions de Style | 20% |
| Dead Code | 10% |

**Complexité Cyclomatique :**
```
Complexity Score = 100 - (Avg Complexity × 5)
```
- Max 10 points par fonction au-delà de 10

**Duplication :**
```
Duplication Score = 100 - (Duplication % × 2)
```

**Seuils ESLint :**
- 0 errors : 100 points
- 1-5 errors : 80 points
- 6-10 errors : 60 points
- 11+ errors : 40 points

### 3. Performance (20%)

Évalue les performances backend et frontend.

**Backend (50% de la dimension) :**
- p50 Latency : target < 100ms
- p95 Latency : target < 500ms
- p99 Latency : target < 1000ms
- Throughput : req/s

**Frontend (50% de la dimension) :**
- Lighthouse Performance Score
- Core Web Vitals :
  - LCP (Largest Contentful Paint) : < 2.5s
  - FID (First Input Delay) : < 100ms
  - CLS (Cumulative Layout Shift) : < 0.1

**Calcul :**
```
Performance Score = (Backend Score × 0.5) + (Frontend Score × 0.5)
```

### 4. Security (15%)

Analyse les vulnérabilités et bonnes pratiques de sécurité.

**Checks :**
- npm audit results
- Snyk security scan
- Dependencies vulnérabilités
- Secrets exposés
- HTTPS usage
- Headers sécurité

**Pénalités :**
- Critical vuln : -50 points
- High vuln : -30 points
- Medium vuln : -10 points
- Low vuln : -5 points

### 5. Documentation (10%)

Évalue la documentation du code.

**Métriques :**
- % de fonctions documentées
- README complet
- API documentation (OpenAPI/Swagger)
- Changelog présent
- Contributing guidelines

## Configuration

Le scoring peut être configuré via `daemon.config.js` :

```javascript
// daemon.config.js
export default {
  scoring: {
    // Personnaliser les poids
    weights: {
      coverage: 0.30,
      quality: 0.25,
      performance: 0.20,
      security: 0.15,
      documentation: 0.10,
    },

    // Seuils personnalisés
    thresholds: {
      coverage: {
        excellent: 80,
        good: 60,
        average: 40,
      },
      performance: {
        lighthouse: {
          performance: 85,
          accessibility: 90,
          'best-practices': 85,
          seo: 80,
        },
        backend: {
          p50: 100,
          p95: 500,
          p99: 1000,
        },
      },
      complexity: {
        max: 10,
        warning: 7,
      },
    },

    // Exclude des fichiers/dossiers
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/*.e2e-spec.ts',
    ],

    // Règles personnalisées
    customRules: [
      {
        id: 'custom-rule',
        category: 'quality',
        severity: 'medium',
        check: (file) => { /* ... */ },
        score: (result) => result ? 10 : -5,
      },
    ],
  },
};
```

## API

### ScorerService

```typescript
import { ScorerService } from '@oalacea/daemon/scoring';

const scorer = new ScorerService({
  weights: {
    coverage: 0.30,
    quality: 0.25,
    performance: 0.20,
    security: 0.15,
    documentation: 0.10,
  },
});

// Calculer le score
const result = await scorer.score(projectPath);

console.log(result);
// {
//   overall: 82,
//   dimensions: {
//     coverage: { score: 85, weight: 0.30, contribution: 25.5 },
//     quality: { score: 78, weight: 0.25, contribution: 19.5 },
//     performance: { score: 88, weight: 0.20, contribution: 17.6 },
//     security: { score: 75, weight: 0.15, contribution: 11.25 },
//     documentation: { score: 70, weight: 0.10, contribution: 7.0 },
//   },
//   grade: 'A',
//   recommendations: [...]
// }
```

### Méthodes

```typescript
// Score complet
const result = await scorer.score(projectPath, options);

// Score d'une dimension uniquement
const coverage = await scorer.scoreCoverage(projectPath);
const quality = await scorer.scoreQuality(projectPath);

// Comparaison avec un commit précédent
const comparison = await scorer.compare(projectPath, baseCommit);

// Historique des scores
const history = await scorer.getHistory(projectPath, limit);
```

## Grades

Le système attribue une lettre basée sur le score global :

| Grade | Score | Signification |
|-------|-------|---------------|
| **A+** | 95-100 | Excellent |
| **A** | 90-94 | Très bon |
| **B** | 80-89 | Bon |
| **C** | 70-79 | Acceptable |
| **D** | 60-69 | À améliorer |
| **E** | < 60 | Critique |

## Recommandations

Le système génère des recommandations prioritaires :

```typescript
interface Recommendation {
  id: string;
  category: Dimension;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: number; // Points gagnés si appliqué
  effort: 'low' | 'medium' | 'high';
  example?: string;
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Score Check

on: [pull_request]

jobs:
  score:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Daemon Score
        run: npx @oalacea/daemon score --min=80
      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const score = require('./score-report.json');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Score: ${score.overall}/100 (${score.grade})\n${score.table}`
            });
```

### GitLab CI

```yaml
score:
  stage: test
  script:
    - npx @oalacea/daemon score --output score-report.json
  artifacts:
    reports:
      metrics: score-report.json
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
```

## Best Practices

1. **Surveiller le trend** : Le score absolu importe moins que l'amélioration continue
2. **Focus sur le high-impact** : Prioriser les recommandations à fort impact
3. **Équilibrer les dimensions** : Un score déséquilibré indique un problème
4. **Contextualiser** : Un score de 70 sur un projet legacy est une victoire
5. **Automatiser** : Intégrer le scoring dans la CI/CD

## Exemples

### Voir le score d'un projet

```bash
npx @oalacea/daemon score
```

### Comparer avec une branche

```bash
npx @oalacea/daemon score --compare=origin/main
```

### Sortie JSON

```bash
npx @oalacea/daemon score --json > score-report.json
```

### Score minimum requis

```bash
npx @oalacea/daemon score --min=75
# Exit code 1 si score < 75
```

### Détails par dimension

```bash
npx @oalacea/daemon score --verbose
```
