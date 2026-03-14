# Daemon Examples

Collection d'exemples démontrant les fonctionnalités de Daemon v0.7.0.

## Exemples Disponibles

| Exemple | Description | Démonstration |
|---------|-------------|---------------|
| **[scoring-example](./scoring-example/)** | Projet React avec scoring | Système de scoring 5 dimensions |
| **[rust-example](./rust-example/)** | API Rust avec Axum | Support Rust complet |
| **[nestjs-example](./nestjs-example/)** | API NestJS complète | Analyseurs NestJS |
| **[full-review-example](./full-review-example/)** | Problèmes variés | Review complet |

## Utilisation

Chaque exemple peut être analysé avec Daemon :

```bash
# Cloner le repository
git clone https://github.com/Pamacea/daemon.git
cd daemon/examples

# Analyser un exemple
cd scoring-example
npx @oalacea/daemon

# Review avec détails
cd ../full-review-example
npx @oalacea/daemon review --verbose

# Scoring seulement
cd ../nestjs-example
npx @oalacea/daemon score
```

## Scoring Example

Projet React montrant le système de scoring :

```
scoring-example/
├── src/
│   ├── components/
│   │   ├── Button.tsx         # ✅ Bon
│   │   ├── Card.tsx           # ⚠️ Pas de tests
│   │   └── OldComponent.tsx   # ❌ Complexe
│   └── utils/
│       ├── format.ts          # ✅ Testé
│       └── helpers.ts         # ⚠️ Tests partiels
└── daemon.config.js
```

**Score attendu :** 76/100 (B)

## Rust Example

API Rust avec Axum démontrant :

- Tests unitaires avec mocks
- Tests d'intégration
- Handlers async
- Repository pattern

```
rust-example/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── handlers/             # Route handlers
│   ├── models/               # Data models
│   └── db.rs                 # Database
└── tests/                    # Integration tests
```

**Outils utilisés :** cargo, cargo-nextest, clippy, rustfmt

## NestJS Example

API NestJS complète avec :

- Controllers, Services, Modules
- Guards (JWT auth)
- Pipes (validation)
- Interceptors (logging, transform)
- E2E tests

```
nestjs-example/
├── src/
│   ├── users/                # Users module
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── dto/
│   │   └── entities/
│   ├── auth/                 # Auth module
│   │   ├── guards/
│   │   └── strategies/
│   └── common/
│       ├── pipes/
│       └── interceptors/
└── test/                     # E2E tests
```

**Analyse NestJS :** DI checks, decorator validation, pattern verification

## Full Review Example

Projet avec tous types de problèmes :

- **Static** : unused imports, missing types
- **Security** : exposed secrets, SQL injection
- **Performance** : bundle size, N+1 queries
- **Quality** : complexity, duplication

**Issues trouvées :** 47 (5 critical, 12 high, 18 medium, 12 low)

## Créer un Propre Exemple

```bash
# Créer un nouveau projet
mkdir my-example
cd my-example
npm init -y

# Configurer Daemon
cat > daemon.config.js << EOF
export default {
  scoring: {
    weights: { coverage: 0.3, quality: 0.25, performance: 0.2, security: 0.15, documentation: 0.1 },
  },
};
EOF

# Lancer Daemon
npx @oalacea/daemon
```

## Ressources

- [Documentation principale](../README.md)
- [Scoring System](../docs/scoring.md)
- [Code Review](../docs/review.md)
- [Rust Support](../docs/rust-support.md)
- [NestJS Support](../docs/nestjs-support.md)
