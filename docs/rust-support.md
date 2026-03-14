# Rust Support

Daemon supporte les projets Rust avec détection de framework et templates de tests.

## Frameworks Supportés

| Framework | Détection | Templates | Status |
|-----------|-----------|-----------|--------|
| **Axum** | ✅ Cargo.toml | ✅ | Full |
| **Actix-web** | ✅ Cargo.toml | ✅ | Full |
| **Rocket** | ✅ Cargo.toml | ✅ | Full |

## Détection

Daemon détecte automatiquement le framework Rust via `Cargo.toml` :

```toml
# Axum detection
[dependencies]
axum = "0.7"

# Actix detection
[dependencies]
actix-web = "4.0"

# Rocket detection
[dependencies]
rocket = "0.5"
```

## Templates

### Unit Tests

Template de base pour les tests unitaires Rust :

```rust
/// Template: rust/unit.test.rs
use super::*;
use pretty_assertions::assert_eq;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_returns_expected_value() {
        let input = "test";
        let result = function_to_test(input);
        assert_eq!(result, "expected");
    }

    #[test]
    fn test_function_handles_empty_input() {
        let result = function_to_test("");
        assert_eq!(result, "default");
    }

    #[test]
    #[should_panic(expected = "Expected error message")]
    fn test_function_panics_on_invalid_input() {
        function_to_test("invalid");
    }
}
```

### Tests d'Intégration

```rust
/// Template: rust/integration.test.rs
use tokio::runtime::Runtime;

#[tokio::test]
async fn test_integration_scenario() {
    let runtime = Runtime::new().unwrap();

    let result = runtime.spawn(async {
        // Votre test async ici
        true
    }).await.unwrap();

    assert!(result);
}

#[tokio::test]
async fn test_database_operation() {
    let pool = create_test_pool().await;
    let result = sqlx::query("SELECT * FROM users WHERE id = $1")
        .bind(1)
        .fetch_one(&pool)
        .await;

    assert!(result.is_ok());
}
```

### Axum Handler Tests

```rust
/// Template: rust/axum-handler.test.rs
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;

#[tokio::test]
async fn test_handler_returns_200() {
    let app = create_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_handler_returns_json() {
    let app = create_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/users")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json.is_array());
}
```

### Actix Controller Tests

```rust
/// Template: rust/actix-controller.test.rs
use actix_web::{
    http::{header::ContentType, StatusCode},
    test,
    App,
};

#[actix_web::test]
async fn test_index_returns_success() {
    let app = test::init_service(App::new().route("/", web::get().to(index))).await;

    let req = test::TestRequest::get()
        .uri("/")
        .to_request();

    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::OK);
}

#[actix_web::test]
async fn test_post_creates_resource() {
    let app = test::init_service(App::new().route("/users", web::post().to(create_user))).await;

    let payload = serde_json::json!({
        "name": "Test User",
        "email": "test@example.com"
    });

    let req = test::TestRequest::post()
        .uri("/users")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::CREATED);
}

#[actix_web::test]
async fn test_validation_rejects_invalid_data() {
    let app = test::init_service(App::new().route("/users", web::post().to(create_user))).await;

    let invalid_payload = serde_json::json!({
        "name": "",
        "email": "not-an-email"
    });

    let req = test::TestRequest::post()
        .uri("/users")
        .set_json(&invalid_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}
```

### Rocket Route Tests

```rust
/// Template: rust/rocket-route.test.rs
use rocket::local::asynchronous::Client;
use rocket::http::{Header, Status};

#[rocket::async_test]
async fn test_get_route() {
    let client = Client::tracked(rocket().await).unwrap();

    let response = client.get("/").dispatch().await;

    assert_eq!(response.status(), Status::Ok);
}

#[rocket::async_test]
async fn test_authenticated_route() {
    let client = Client::tracked(rocket().await).unwrap();

    let response = client
        .get("/protected")
        .header(Header::new("Authorization", "Bearer token"))
        .dispatch()
        .await;

    assert_eq!(response.status(), Status::Ok);
}

#[rocket::async_test]
async fn test_post_route_with_json() {
    let client = Client::tracked(rocket().await).unwrap();

    let response = client
        .post("/users")
        .header(ContentType::JSON)
        .body(r#"{"name":"Test","email":"test@example.com"}"#)
        .dispatch()
        .await;

    assert_eq!(response.status(), Status::Created);
}
```

## Outils Rust Inclus

Le Docker Daemon inclut :

| Outil | Usage |
|-------|-------|
| **rustc** | Compilateur Rust |
| **cargo** | Gestionnaire de paquets |
| **rustfmt** | Formatter de code |
| **clippy** | Linter |
| **cargo-nextest** | Test runner parallèle |
| **cargo-audit** | Audit de sécurité |
| **cargo-watch** | Watch mode |

## Commandes

### Tests Rust

```bash
# Lancer tous les tests
docker exec daemon-tools cargo test

# Tests avec output
docker exec daemon-tools cargo test -- --nocapture

# Tests spécifiques
docker exec daemon-tools cargo test test_name

# Tests en parallèle
docker exec daemon-tools cargo nextest run

# Tests avec coverage
docker exec daemon-tools cargo tarpaulin --out Html
```

### Linting

```bash
# Clippy
docker exec daemon-tools cargo clippy

# Clippy avec tous les warnings
docker exec daemon-tools cargo clippy -- -W clippy::all

# Fix automatique
docker exec daemon-tools cargo clippy --fix
```

### Formatting

```bash
# Vérifier le format
docker exec daemon-tools cargo fmt --check

# Formater le code
docker exec daemon-tools cargo fmt
```

### Audit de sécurité

```bash
# Audit des dépendances
docker exec daemon-tools cargo audit

# Audit avec base de données mise à jour
docker exec daemon-tools cargo audit --db fetch
```

## Configuration

```javascript
// daemon.config.js
export default {
  rust: {
    // Framework détecté automatiquement
    framework: 'axum', // or 'actix', 'rocket'

    // Test runner
    testRunner: 'cargo-nextest', // or 'cargo'

    // Features de test
    testFeatures: ['test', 'mock'],

    // Exclusions
    exclude: [
      'target/**',
      '**/mocks/**',
    ],

    // Templates personnalisés
    templates: {
      unit: './templates/rust/unit.test.rs',
      integration: './templates/rust/integration.test.rs',
      axum: './templates/rust/axum-handler.test.rs',
      actix: './templates/rust/actix-controller.test.rs',
      rocket: './templates/rust/rocket-route.test.rs',
    },
  },
};
```

## Best Practices

### 1. Structurer les tests

```
src/
├── lib.rs
├── modules/
│   ├── mod.rs
│   ├── user.rs
│   └── tests/              # Tests unitaires des modules
│       ├── user_test.rs
│       └── integration_test.rs
tests/                       # Tests d'intégration
    ├── api_test.rs
    └── database_test.rs
benches/                     # Benchmarks
    ├── api_bench.rs
    └── db_bench.rs
```

### 2. Utiliser des helpers

```rust
#[cfg(test)]
mod test_helpers {
    use super::*;

    pub async fn create_test_pool() -> SqlitePool {
        SqlitePool::connect(":memory:").await.unwrap()
    }

    pub async fn seed_test_data(pool: &SqlitePool) {
        // Seed data
    }

    pub async fn cleanup_test_data(pool: &SqlitePool) {
        // Cleanup
    }
}
```

### 3. Mocking

Utiliser `mockall` pour le mocking :

```rust
use mockall::{mock, predicate::*};

mock! {
    Repository {}

    impl RepositoryTrait for Repository {
        async fn get_user(&self, id: i32) -> Option<User>;
        async fn save_user(&self, user: &User) -> Result<(), Error>;
    }
}

#[tokio::test]
async fn test_with_mock() {
    let mut mock = MockRepository::new();
    mock.expect_get_user()
        .with(eq(1))
        .returning(|_| Some(User::default()));

    let result = mock.get_user(1).await;
    assert!(result.is_some());
}
```

### 4. Tests async

```rust
#[tokio::test]
async fn test_async_function() {
    let result = async_function().await;
    assert_eq!(result, expected);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_with_multiple_threads() {
    // Test avec runtime multi-thread
}
```

## CI/CD

### GitHub Actions

```yaml
name: Rust Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rust-lang/setup-rust-toolchain@v1

      - name: Run tests
        run: cargo test --verbose

      - name: Run clippy
        run: cargo clippy -- -D warnings

      - name: Check formatting
        run: cargo fmt -- --check
```

## Ressources

- [The Rust Book](https://doc.rust-lang.org/book/)
- [Rust By Example](https://doc.rust-lang.org/rust-by-example/)
- [Axum Docs](https://docs.rs/axum/)
- [Actix-web Docs](https://docs.rs/actix-web/)
- [Rocket Docs](https://docs.rs/rocket/)
