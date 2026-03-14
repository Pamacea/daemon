# ESLint / TypeScript API en Rust - Faisabilité et Roadmap

## 🎯 Objectif

Créer une couche de traduction Rust pour les outils JS/TS existants (ESLint, TypeScript API).

---

## 📊 Défi Technique

| Outil | Langage | Challenge |
|-------|---------|-----------|
| **ESLint** | JavaScript | Rules plugins en JS, AST spécifique |
| **TypeScript API** | TypeScript | Nécessite le compilateur TS |
| **swc** | Rust/WASM | Parser JS/TS rapide, mais pas linter complet |

---

## 🚀 Solutions Disponibles

### Option 1: swc + Rust Analysis (RECOMMANDÉE)

```rust
use swc_common::ast::Module;
use swc_ecma_parser::{Parser, StringInput};
use swc_ecma_visit::VisitWith;

// Parser TypeScript avec swc
fn parse_ts(code: &str) -> Result<Module, swc_common::Error> {
    let mut parser = Parser::new(
        StringInput::from(code),
        Default::default(),
    );
    parser.parse_module()
}

// Analyser l'AST pour détecter les patterns
fn detect_issues(module: &Module) -> Vec<Issue> {
    let mut visitor = IssueDetector::new();
    module.visit_with(&mut visitor);
    visitor.issues
}

struct IssueDetector {
    issues: Vec<Issue>,
}
```

**Avantages :**
- ✅ Parsing ultra-rapide (10x+ plus vite que typescript)
- ✅ 100% Rust
- ✅ Support complet TS/JS

**Inconvénients :**
- ❌ Pas de linting natif (doit être réécrit)
- ❌ Pas de type-checking (parse uniquement)

---

### Option 2: Bridge vers Node.js (HYBRIDE)

```
┌─────────────────────────────────────────────────┐
│                  DAEMON (Rust)                   │
│  • Parsing AST avec swc                          │
│  • Détection de patterns                        │
│  • Génération de fixes                            │
│                                                  │
│  ┌─────────────────────────────────────────────┐  │
│  │  ESLint/TS Bridge (Node.js)                 │  │
│  │  • Reçoit AST rust                           │  │
│  │  • Exécute ESLint/TypeScript API             │  │
│  │  • Retourne résultats                         │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Protocole HTTP :**
```json
// Request
{
  "ast": {...},
  "file": "src/index.ts",
  "options": {"parser": "@typescript-eslint/parser"}
}

// Response
{
  "issues": [
    { "line": 10, "rule": "no-unused-vars", "message": "..." }
  ],
  "fixable": true
}
```

---

## 📋 Roadmap Implémentation

### Phase 1 : Parser & Détection (1-2 semaines)

```rust
// src/linter/parser.rs
pub struct TsParser {
    // Parser TypeScript/JavaScript
    pub fn parse(&self, code: &str, lang: Language) -> Result<Module>;

    // Extraire les infos
    pub fn extract_functions(&self, module: &Module) -> Vec<Function>;
    pub fn extract_imports(&self, module: &Module) -> Vec<Import>;
}

pub enum Language {
    TypeScript,
    JavaScript,
    Jsx,
    Tsx,
}
```

**Sortie :** AST sérialisé en JSON pour envoi au bridge Node.js

### Phase 2 : Bridge HTTP (1 semaine)

```rust
// src/linter/bridge.rs
pub struct LinterBridge {
    base_url: String,
}

impl LinterBridge {
    pub async fn lint(&self, ast_json: &str) -> Result<Vec<Issue>> {
        let client = reqwest::Client::new();
        let resp = client.post(&format!("{}/lint", ast_json))
            .await?
            .json::<LintResponse>()?;
        Ok(resp.issues)
    }

    pub async fn fix(&self, file: &str, issues: &[Issue]) -> Result<String> {
        // Call ESLint --fix
    }
}
```

### Phase 3 : Linter Rust Natif (3-4 semaines)

```rust
// Règles ESLint réécrites en Rust
pub struct NoUnusedVarsRule {
    // Implémentation native
}

impl Rule for NoUnusedVarsRule {
    fn check(&self, ast: &Module) -> Vec<Issue> {
        // Analyse des déclarations
    }

    fn fix(&self, ast: &Module, issue: &Issue) -> FixedCode {
        // Génération du code corrigé
    }
}
```

---

## 🎯 Recommandation

**Architecture Hybride** est plus réaliste à court terme :

1. **Swc** pour parsing AST (rapide)
2. **Bridge Node.js** pour ESLint/TS API existants
3. **Progressivement** migrer les règles vers Rust

**Évolution cible :**
- Court terme : Bridge + swc
- Moyen terme : Règles Rust les plus courantes
- Long terme : 100% Rust (si la communauté suit)

---

## 📚 Ressources

- **swc** : https://swc.rs (parser JS/TS ultra-rapide)
- **rslint** : https://github.com/rust-lang/rust-analyzer (linting Rust)
- **deno_lint** : https://deno.land/manual/linter (linter Deno, support JS/TS)
- **biome** : https://biomejs.dev (toolchain JS/TS, rust backend)

---

## 🔄 Architecture Technique Proposée

```rust
// src/linter/mod.rs
pub struct DaemonLinter {
    parser: TsParser,
    bridge: Option<LinterBridge>,
    native_rules: Vec<Box<dyn Rule>>,
}

impl DaemonLinter {
    pub async fn analyze(&self, file: &str) -> Result<LintReport> {
        // 1. Parser avec swc
        let module = self.parser.parse(file)?;

        // 2. Analyse native (règles Rust)
        let native_issues = self.analyze_native(&module)?;

        // 3. Analyse bridge (ESLint/TS API)
        let bridge_issues = if let Some(bridge) = &self.bridge {
            bridge.lint(&serde_json::to_string(&module).unwrap()).await?
        } else {
            vec![]
        };

        Ok(LintReport {
            native: native_issues,
            bridge: bridge_issues,
        })
    }
}
```
