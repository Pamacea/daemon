//! CLI module for daemon-rust
//!
//! Provides command-line interface for Rust project analysis

use crate::{Config, Result};
use anyhow::Context;
use console::Style;
use std::path::Path;

/// Daemon CLI for Rust projects
pub struct DaemonCli {
    config: Config,
}

impl DaemonCli {
    /// Create a new Daemon CLI instance
    pub fn new() -> Result<Self> {
        Ok(Self {
            config: Config::load()?,
        })
    }

    /// Run the init command for a Rust project
    pub async fn init(&self, project_path: &str) -> Result<()> {
        let path = Path::new(project_path);

        self.print_banner();

        // Check if it's a Rust project
        if !path.join("Cargo.toml").exists() {
            anyhow::bail!("Not a Rust project (no Cargo.toml found)");
        }

        // Detect framework
        let framework = self.detect_framework(&path)?;

        let cyan = Style::new().cyan();
        let green = Style::new().green();

        println!("{}", cyan.apply_to("  → Framework detected: "));
        println!("{}", green.apply_to(format!("{:?}", framework)));

        // Create .daemon directory
        let daemon_dir = path.join(".daemon");
        std::fs::create_dir_all(&daemon_dir)
            .context("Failed to create .daemon directory")?;

        // Write EXECUTE.md for Rust
        let execute_md = self.generate_execute_prompt(framework)?;
        std::fs::write(daemon_dir.join("EXECUTE.md"), execute_md)?;

        println!("{}", green.apply_to("  ✓ Daemon initialized for Rust!"));

        Ok(())
    }

    fn detect_framework(&self, path: &Path) -> Result<crate::RustFramework> {
        let cargo_toml = path.join("Cargo.toml");
        let content = std::fs::read_to_string(&cargo_toml)?;

        // Check dependencies to detect framework
        if content.contains("axum") {
            Ok(crate::RustFramework::Axum)
        } else if content.contains("actix-web") {
            Ok(crate::RustFramework::ActixWeb)
        } else if content.contains("rocket") {
            Ok(crate::RustFramework::Rocket)
        } else if content.contains("poem") {
            Ok(crate::RustFramework::Poem)
        } else {
            Ok(crate::RustFramework::Vanilla)
        }
    }

    fn generate_execute_prompt(&self, framework: crate::RustFramework) -> Result<String> {
        Ok(format!(r#"# Daemon - Rust Project Testing Guide

> **DETECTED CONTEXT**
> Framework: {:?}
> Language: Rust
> Test Runner: cargo-test / nextest
> Database: none detected (unless manually configured)
> Target: http://localhost:3000

## Quick Start

This guide helps you test your Rust application with Daemon.

## Framework-Specific Testing

### Framework-Specific Templates

```rust
// Unit test example
#[cfg(test)]
mod tests {{
    use super::*;

    #[tokio::test]
    async fn test_handler() {{
        let response = my_handler().await;
        assert_eq!(response.status(), 200);
    }}
}}
```

## Testing Commands

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run with nextest (faster, parallel)
cargo nextest

# Run specific test
cargo test test_name

# Run tests in watch mode
cargo watch -x test
```

## Integration Tests

For database integration, consider transaction rollback:
- Use test containers
- Rollback after each test
- Never modify real data

## Completion

Report:
```
✓ Unit Tests: X created, Y passing
✓ Integration: X created, Y passing
```
"#, framework))
    }

    fn print_banner(&self) {
        println!();
        println!("═══════════════════════════════════════════════════");
        println!("  Daemon - Rust Edition");
        println!("═══════════════════════════════════════════════════");
        println!();
    }
}
