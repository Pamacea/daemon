# Daemon v0.6.0 - Plan d'Amélioration et Refactorisation

> **Version cible:** 0.6.0
> **Date:** 2025-02-18
> **Statut:** Planification

---

## 📋 Sommaire Exécutif

La version 0.6.0 de Daemon vise à transformer le projet en un toolkit de testing robuste, maintenable et performant. Les axes principaux sont :

1. **Architecture** - Structure modulaire avec séparation des préoccupations
2. **Performance** - Optimisation Docker, opérations async, caching
3. **Tests** - Suite de tests complète (>90% de couverture)
4. **TypeScript** - Migration complète pour la sécurité des types
5. **Composants** - Abstractions réutilisables

---

## 🎯 Objectifs Quantifiés

| Métrique | Actuel | Cible v0.6.0 | Amélioration |
|----------|--------|--------------|--------------|
| Couverture de tests | 0% | >90% | +90% |
| Démarrage CLI | ~3s | <1s | -66% |
| Taille image Docker | ~500MB | <300MB | -40% |
| Nombre de dépendences | 0 | TypeScript + outils de test | Ajout justifié |
| Modules TypeScript | 0% | 100% | +100% |
| Complexité cyclomatique | Élevée | Faible | -30% |

---

## 📐 Architecture Proposée

### Structure Actuelle

```
daemon/
├── bin/cli.js          # 450 lignes, trop de responsabilités
├── agents/             # 8 agents, couplage fort
├── lib/                # 3 utilitaires
├── prompts/            # Templates markdown
└── templates/          # Templates de tests
```

**Problèmes identifiés :**
- `cli.js` monolithique (450 lignes)
- `execSync` bloquant partout
- Pas de gestion d'erreurs structurée
- Aucun test
- Code 100% JavaScript

### Nouvelle Structure v0.6.0

```
daemon/
├── src/
│   ├── cli/                    # Couche CLI (Command Pattern)
│   │   ├── commands/
│   │   │   ├── init.command.ts
│   │   │   ├── detect.command.ts
│   │   │   └── test.command.ts
│   │   ├── index.ts            # Point d'entrée
│   │   └── cli.ts              # Gestionnaire CLI
│   │
│   ├── services/               # Logique métier (Strategy Pattern)
│   │   ├── docker/
│   │   │   ├── docker.service.ts
│   │   │   ├── container.manager.ts
│   │   │   └── image.builder.ts
│   │   ├── detection/
│   │   │   ├── framework.detector.ts
│   │   │   ├── database.detector.ts
│   │   │   └── dependency.analyzer.ts
│   │   ├── testing/
│   │   │   ├── test.generator.ts
│   │   │   ├── test.runner.ts
│   │   │   └── coverage.analyzer.ts
│   │   └── reporting/
│   │       ├── reporter.service.ts
│   │       └── formatters/
│   │           ├── json.formatter.ts
│   │           ├── markdown.formatter.ts
│   │           └── console.formatter.ts
│   │
│   ├── core/                   # Modèles de domaine
│   │   ├── types/
│   │   │   ├── project.types.ts
│   │   │   ├── detection.types.ts
│   │   │   ├── docker.types.ts
│   │   │   └── test.types.ts
│   │   ├── config/
│   │   │   └── daemon.config.ts
│   │   └── constants.ts
│   │
│   └── shared/                 # Utilitaires partagés
│       ├── utils/
│       │   ├── command.executer.ts
│       │   ├── file.helper.ts
│       │   └── logger.ts
│       ├── errors/
│       │   ├── docker.error.ts
│       │   ├── detection.error.ts
│       │   └── base.error.ts
│       └── templates/
│           ├── template.engine.ts
│           └── prompt.builder.ts
│
├── tests/                      # Suite de tests
│   ├── unit/
│   │   ├── services/
│   │   └── shared/
│   ├── integration/
│   │   ├── commands/
│   │   └── workflows/
│   ├── performance/
│   │   └── benchmarks/
│   └── fixtures/
│
├── prompts/                    # Templates (inchangés)
├── templates/                  # Templates de tests (inchangés)
├── tsconfig.json
└── package.json
```

### Diagramme des Dépendances

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Init Command │  │ Detect       │  │ Test Command │      │
│  │              │  │ Command      │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                        Services Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Docker      │  │ Detection   │  │ Testing             │  │
│  │ Service     │  │ Service     │  │ Service             │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                         Core Layer                          │
│  Types │ Config │ Constants │ Errors │ Utils                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Optimisations de Performance

### 1. Docker - Optimisations

| Optimisation | Impact | Complexité | Gain |
|--------------|--------|------------|------|
| Multi-stage build | Élevé | Moyenne | -150MB |
| Layer caching | Élevé | Faible | -30s rebuild |
| Alpine variant | Moyen | Faible | -100MB |
| Lazy tool install | Moyen | Moyenne | -50MB |

**Dockerfile optimisé :**

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
# Install only production deps
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage
FROM node:20-alpine
RUN apk add --no-cache chromium nss \
    && npx playwright install --with-deps chromium
COPY --from=builder /node_modules ./node_modules
CMD ["sleep", "infinity"]
```

### 2. Opérations Async

**Avant (bloquant) :**
```javascript
const output = execSync('docker info', { stdio: 'pipe' });
```

**Après (async) :**
```typescript
import { promisify } from 'util';
const execAsync = promisify(exec);

async function checkDocker(): Promise<boolean> {
  try {
    await execAsync('docker info', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
```

### 3. Caching

| Cache | Durée | Gain |
|-------|-------|------|
| Détection framework | Session | -500ms |
| Résultats analyse | 5 min | -2s |
| Templates compilés | Permanent | -100ms |

**Implémentation :**
```typescript
class CacheService {
  private cache = new Map<string, { value: any; expiry: number }>();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value as T;
  }

  set(key: string, value: any, ttl: number): void {
    this.cache.set(key, { value, expiry: Date.now() + ttl });
  }
}
```

---

## 🧪 Stratégie de Tests

### Couverture Cible

| Module | Couverture Cible | Priorité |
|--------|------------------|----------|
| CLI/Commands | 95% | P0 |
| Services/Docker | 90% | P0 |
| Services/Detection | 95% | P0 |
| Services/Testing | 85% | P1 |
| Shared/Utils | 95% | P0 |
| Shared/Errors | 90% | P1 |
| Core/Types | 100% (types) | P0 |

### Structure des Tests

```
tests/
├── unit/
│   ├── services/
│   │   ├── docker/
│   │   │   ├── docker.service.test.ts
│   │   │   ├── container.manager.test.ts
│   │   │   └── image.builder.test.ts
│   │   ├── detection/
│   │   │   ├── framework.detector.test.ts
│   │   │   └── database.detector.test.ts
│   │   └── testing/
│   │       └── test.generator.test.ts
│   ├── shared/
│   │   ├── command.executer.test.ts
│   │   ├── file.helper.test.ts
│   │   └── template.engine.test.ts
│   └── fixtures/
│       ├── package.json
│       └── projects/
│
├── integration/
│   ├── commands/
│   │   ├── init.integration.test.ts
│   │   └── detect.integration.test.ts
│   └── workflows/
│       └── full-flow.integration.test.ts
│
└── performance/
    └── benchmarks/
        ├── detection.bench.ts
        ├── docker.bench.ts
        └── startup.bench.ts
```

### Mocking Strategy

```typescript
// __mocks__/docker.ts
export const mockDockerExec = vi.fn();
vi.mock('../src/services/docker/docker.service', () => ({
  DockerService: vi.fn().mockImplementation(() => ({
    exec: mockDockerExec,
    isRunning: vi.fn().mockResolvedValue(true),
  })),
}));
```

---

## 🔧 Composants Réutilisables

### 1. CommandExecutor

```typescript
interface CommandOptions {
  timeout?: number;
  silent?: boolean;
  retries?: number;
  onError?: 'throw' | 'return' | 'ignore';
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

class CommandExecutor {
  async execute(command: string, options: CommandOptions = {}): Promise<CommandResult>;
  async executeParallel(commands: string[], options?: CommandOptions): Promise<CommandResult[]>;
}
```

### 2. FileSystemHelper

```typescript
class FileSystemHelper {
  async readJson<T>(path: string): Promise<T>;
  async writeJson(path: string, data: unknown): Promise<void>;
  async ensureDir(path: string): Promise<void>;
  async findFiles(pattern: string, cwd: string): Promise<string[]>;
  async exists(path: string): Promise<boolean>;
}
```

### 3. DockerManager

```typescript
interface DockerConfig {
  imageName: string;
  containerName: string;
  dockerfilePath: string;
}

class DockerManager {
  isRunning(): Promise<boolean>;
  build(options?: BuildOptions): Promise<void>;
  create(options?: CreateOptions): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  exec(command: string, options?: ExecOptions): Promise<DockerExecResult>;
  getLogs(options?: LogOptions): Promise<string>;
  remove(): Promise<void>;
}
```

### 4. TemplateEngine

```typescript
interface TemplateContext {
  [key: string]: string | number | boolean | object;
}

class TemplateEngine {
  compile(templatePath: string): Promise<Template>;
  render(template: Template, context: TemplateContext): Promise<string>;
  renderInline(template: string, context: TemplateContext): Promise<string>;
  registerHelper(name: string, fn: Handlebars.HelperDelegate): void;
}
```

### 5. ReporterFactory

```typescript
type ReportFormat = 'json' | 'markdown' | 'console' | 'html';

interface ReportData {
  summary: TestSummary;
  results: TestResult[];
  metadata: ReportMetadata;
}

class ReporterFactory {
  create(format: ReportFormat): Reporter;
}

interface Reporter {
  generate(data: ReportData): Promise<string>;
  output(data: ReportData, destination: string | WriteStream): Promise<void>;
}
```

---

## 📝 Migration TypeScript

### Étape 1: Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Étape 2: Types de Base

```typescript
// src/core/types/project.types.ts
export interface ProjectContext {
  framework: Framework;
  language: Language;
  testRunner: TestRunner;
  database: DatabaseInfo | null;
  existingTests: number;
  coverage: string | null;
  dependencies: string[];
  target: string;
}

export type Framework =
  | 'Next.js'
  | 'Remix'
  | 'SvelteKit'
  | 'Nuxt'
  | 'Vite + React'
  | 'Vite + Vue'
  | 'Astro'
  | 'Unknown';

export type Language = 'TypeScript' | 'JavaScript' | 'Python' | 'Go';

export type TestRunner = 'Vitest' | 'Jest' | 'Mocha' | 'Jasmine';

export interface DatabaseInfo {
  type: string;
  connection: string;
  testStrategy: string;
}
```

### Ordre de Migration

| Phase | Modules | Complexité |
|-------|---------|------------|
| 1 | core/types/* | Faible |
| 2 | shared/utils/* | Faible |
| 3 | shared/errors/* | Moyenne |
| 4 | services/detection/* | Moyenne |
| 5 | services/docker/* | Moyenne |
| 6 | services/testing/* | Élevée |
| 7 | cli/commands/* | Moyenne |
| 8 | cli/index.ts | Faible |

---

## 📅 Roadmap d'Implémentation

### Sprint 1: Fondations (Semaine 1-2)

**Objectif:** Préparer l'infrastructure

- [ ] Configuration TypeScript
- [ ] Structure des dossiers
- [ ] Types de base
- [ ] Logger
- [ ] Système d'erreurs

**Livrables:**
- `tsconfig.json` validé
- `src/core/types/*` créé
- `src/shared/utils/logger.ts`
- `src/shared/errors/*`

### Sprint 2: Composants Réutilisables (Semaine 2-3)

**Objectif:** Créer les abstractions

- [ ] CommandExecutor
- [ ] FileSystemHelper
- [ ] TemplateEngine
- [ ] Tests unitaires associés

**Livrables:**
- `src/shared/utils/*`
- Tests unitaires avec >90% couverture

### Sprint 3: Services - Docker (Semaine 3-4)

**Objectif:** Refactoriser les opérations Docker

- [ ] DockerManager
- [ ] ContainerManager
- [ ] ImageBuilder
- [ ] Tests + mocks

**Livrables:**
- `src/services/docker/*`
- Tests unitaires et intégration
- Dockerfile optimisé

### Sprint 4: Services - Detection (Semaine 4-5)

**Objectif:** Refactoriser la détection

- [ ] FrameworkDetector
- [ ] DatabaseDetector
- [ ] DependencyAnalyzer
- [ ] Tests avec fixtures

**Livrables:**
- `src/services/detection/*`
- Tests avec projets fixtures

### Sprint 5: CLI - Commands (Semaine 5-6)

**Objectif:** Refactoriser le CLI

- [ ] InitCommand
- [ ] DetectCommand
- [ ] TestCommand
- [ ] CLI orchestrator

**Livrables:**
- `src/cli/*`
- Tests d'intégration
- Nouveau `bin/cli.js`

### Sprint 6: Performance & Optimisation (Semaine 6-7)

**Objectif:** Optimiser les performances

- [ ] Cache service
- [ ] Parallel execution
- [ ] Docker optimizations
- [ ] Benchmarks

**Livrables:**
- `src/shared/cache/*`
- Tests de performance
- Dockerfile multi-stage

### Sprint 7: Documentation & Finalisation (Semaine 7-8)

**Objectif:** Préparer la release

- [ ] README mis à jour
- [ ] CHANGELOG
- [ ] Examples
- [ ] Release notes

---

## 🎯 Critères de Succès

### Fonctionnels

- [ ] Toutes les commandes CLI fonctionnent
- [ ] Détection framework précise à 95%
- [ ] Support des mêmes frameworks qu'en v0.5.x
- [ ] Templates EXECUTE.md générés correctement

### Non-Fonctionnels

- [ ] >90% couverture de tests
- [ ] 100% TypeScript strict
- [ ] <1s démarrage CLI
- [ ] <300MB image Docker
- [ ] 0 erreurs TypeScript
- [ ] 0 vulnérabilités de sécurité

### Qualité

- [ ] Complexité cyclomatique <10 par fonction
- [ ] 0 code dupliqué (>3 lignes)
- [ ] Documentation complète des types
- [ ] Tests lisibles et maintenus

---

## 📊 Risques et Mitigation

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Breaking changes utilisateurs | Moyenne | Élevée | Versionning sémantique, migration guide |
| Regression bugs | Moyenne | Moyenne | Suite de tests complète |
| Performance dégradée | Faible | Moyenne | Benchmarks avant/après |
| Migration TS complexe | Moyenne | Faible | Migration progressive, scripts d'aide |

---

## 🔗 Ressources

- **Repo:** https://github.com/Pamacea/daemon
- **Issues:** https://github.com/Pamacea/daemon/issues
- **Discussions:** https://github.com/Pamacea/daemon/discussions

---

*Document généré pour la planification v0.6.0*
