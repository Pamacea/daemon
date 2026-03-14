# daemon-rust

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Crates.io](https://img.shields.io/crates/v/daemon-rust)](https://crates.io/crates/daemon-rust)
[![docs.rs](https://img.shields.io/docsrs/daemon-rust)](https://docs.rs/daemon-rust)

> AI-powered testing and code quality toolkit for Rust projects.

**daemon-rust** provides automated test generation, code analysis, and quality scoring for Rust web applications. It supports major frameworks like Axum, Actix, Rocket, and Poem.

## Features

- 🔍 **Framework Detection** - Automatically detects Axum, Actix, Rocket, Poem
- 🧪 **Test Generation** - Unit, integration, and E2E test templates
- 📊 **Quality Analysis** - Code coverage, complexity metrics, dependency analysis
- 🎯 **Recommendations** - Actionable suggestions for improving your test suite
- ⚡ **Fast Test Runner** - Supports cargo-nextest for parallel test execution

## Installation

### CLI

```bash
# From crates.io (once published)
cargo install daemon-rust

# Or build locally
cargo install --path crates/daemon-rust
```

### Library

```toml
# Cargo.toml
[dependencies]
daemon-rust = "0.1"
```

## Quick Start

### CLI Usage

```bash
# Initialize daemon in your Rust project
daemon-rust init

# Analyze your project
daemon-rust analyze

# Generate tests
daemon-rust generate

# Run tests with reporting
daemon-rust test
```

### Library Usage

```rust
use daemon_rust::{DaemonCli, Config};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = DaemonCli::new()?;

    // Analyze current project
    let report = cli.analyze(".")?;
    println!("Framework: {:?}", report.framework);
    println!("Existing tests: {}", report.existing_tests);

    // Generate tests
    let test_plan = cli.generate_tests(".", &report)?;
    println!("Generated {} unit tests", test_plan.unit_tests.len());

    Ok(())
}
```

## Supported Frameworks

| Framework | Version | Detection | Unit Tests | Integration |
|-----------|---------|-----------|------------|-------------|
| **Axum** | 0.7+ | ✅ | ✅ | ✅ |
| **Actix Web** | 4.0+ | ✅ | ✅ | ✅ |
| **Rocket** | 0.5+ | ✅ | ✅ | ✅ |
| **Poem** | 3.0+ | ✅ | ✅ | ✅ |
| **Vanilla** | any | ✅ | ✅ | ✅ |

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║                  DAEMON-RUST ANALYSIS                      ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Project: my-api                                           ║
║  Framework: Axum 0.7                                       ║
║  Test Runner: cargo-nextest                                ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐   ║
║  │  METRICS                                           │   ║
║  │  Existing Tests: 12                               │   ║
║  │  Coverage: 45%                                    │   ║
║  │  Dependencies: 23                                 │   ║
║  └────────────────────────────────────────────────────┘   ║
║                                                            ║
║  ┌────────────────────────────────────────────────────┐   ║
║  │  RECOMMENDATIONS                                    │   ║
║  │  🔴 P0: Add handler tests (12 untested handlers)   │   ║
║  │  🟠 P1: Increase coverage to 80%                    │   ║
║  │  🟡 P2: Add integration tests for API endpoints    │   ║
║  └────────────────────────────────────────────────────┘   ║
║                                                            ║
║  Generated: 15 test files                                   ║
╚════════════════════════════════════════════════════════════╝
```

## Configuration

Create `daemon-rust.toml` in your project root:

```toml
# daemon-rust.toml
[general]
project_type = "axum"
test_runner = "nextest"

[scoring]
coverage_target = 80
complexity_threshold = 10

[generation]
include_unit_tests = true
include_integration_tests = true
include_e2e_tests = false

[exclude]
paths = ["**/mock/**", "**/test_utils/**"]
```

## Test Templates

### Axum Handler Test

```rust
//! Generated unit test for Axum handler
use super::*;
use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn handler_returns_200() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
```

### Actix Handler Test

```rust
//! Generated unit test for Actix handler
use super::*;
use actix_web::{test, App};

#[actix_web::test]
async fn handler_index_works() {
    let app = test::init_service(|| App::new().service(index)).await;

    let req = test::TestRequest::get().uri("/").to_request();
    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());
}
```

## Development

```bash
# Run tests
cargo test

# Run with nextest
cargo install cargo-nextest
cargo nextest run

# Format code
cargo fmt

# Lint
cargo clippy

# Build documentation
cargo doc --open
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT - See [LICENSE](LICENSE) for details.

## See Also

- [Main Daemon Project](https://github.com/Pamacea/daemon) - Full testing toolkit
- [Playwright Rust Feasibility](../docs/PLAYWRIGHT_RUST_FEASIBILITY.md) - Browser automation roadmap
- [ESLint/TS Rust Feasibility](../docs/ESLINT_TYPESCRIPT_RUST_FEASIBILITY.md) - JS/TS parsing in Rust
