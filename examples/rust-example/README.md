# Rust Example

Exemple de projet Rust avec Axum pour démontrer le support Rust de Daemon.

## Projet

Une API REST simple avec Axum, SQLite et JWT.

## Structure

```
rust-example/
├── Cargo.toml                # Dépendances
├── src/
│   ├── main.rs               # Point d'entrée
│   ├── lib.rs                # Module library
│   ├── handlers/
│   │   ├── mod.rs
│   │   ├── health.rs         # Health check
│   │   └── users.rs          # User handlers
│   ├── models/
│   │   ├── mod.rs
│   │   └── user.rs
│   └── db.rs                 # Database
└── tests/
    ├── handlers_test.rs      # Tests des handlers
    └── integration_test.rs   # Tests d'intégration
```

## Lancer les Tests

```bash
cd rust-example

# Tests unitaires
cargo test

# Tests avec coverage
cargo tarpaulin --out Html

# Clippy
cargo clippy

# Format check
cargo fmt --check
```

## Template Utilisé

Daemon utilise le template `templates/rust/axum-handler.test.rs` :

```rust
use axum::{body::Body, http::{Request, StatusCode}};
use tower::ServiceExt;

#[tokio::test]
async fn test_health_check() {
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
```

## Cargo.toml

```toml
[package]
name = "rust-example"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.7", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tower = "0.4"
tower-http = { version = "0.5", features = ["cors"] }

[dev-dependencies]
tower = "0.4"
http-body-util = "0.1"
pretty-assertions = "1.4"
```
