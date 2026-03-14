# Scoring Example

Exemple d'utilisation du système de scoring de Daemon.

## Projet

Un petit projet React avec TypeScript pour démontrer le scoring.

## Structure

```
scoring-example/
├── src/
│   ├── components/
│   │   ├── Button.tsx         # ✅ Testé, bien structuré
│   │   ├── Card.tsx           # ⚠️ Pas de tests
│   │   └── OldComponent.tsx   # ❌ Code complexe, pas testé
│   ├── utils/
│   │   ├── format.ts          # ✅ Testé
│   │   └── helpers.ts         # ⚠️ Tests partiels
│   └── App.tsx
├── tests/                     # Tests générés par Daemon
└── daemon.config.js           # Configuration de scoring
```

## Scoring Attendu

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Coverage** | 65% | Certaines parties non testées |
| **Quality** | 75% | Complexité moyenne, quelques warnings |
| **Performance** | 90% | Pas de problèmes majeurs |
| **Security** | 85% | Pas de vulnérabilités connues |
| **Documentation** | 60% | JSDoc partiel |
| **Global** | 76/100 | B |

## Lancer le Scoring

```bash
cd scoring-example
npx @oalacea/daemon score --verbose
```

## Configuration

```javascript
// daemon.config.js
export default {
  scoring: {
    weights: {
      coverage: 0.30,
      quality: 0.25,
      performance: 0.20,
      security: 0.15,
      documentation: 0.10,
    },
    thresholds: {
      coverage: {
        excellent: 80,
        good: 60,
        average: 40,
      },
      complexity: {
        max: 10,
        warning: 7,
      },
    },
    exclude: [
      'node_modules/**',
      'dist/**',
    ],
  },
};
```

## Recommandations Typiques

Après analyse, Daemon suggère :

1. **High Priority** (impact +15 pts)
   - Ajouter des tests pour `OldComponent.tsx` (complexité 12)
   - Refactorer en composants plus petits

2. **Medium Priority** (impact +8 pts)
   - Ajouter tests pour `Card.tsx`
   - Compléter les tests de `helpers.ts`

3. **Low Priority** (impact +3 pts)
   - Ajouter JSDoc aux fonctions utilitaires
   - Uniformiser le style d'imports
