# daemon-rust

Rust support for Daemon - AI-powered testing toolkit for Rust projects.

## Installation

```bash
# Via cargo (une fois publiée sur crates.io)
cargo install daemon-rust

# Ou localement pour développement
cargo install --path crates/daemon-rust
```

## Usage

```bash
# Initialize Daemon for a Rust project
daemon-rust init

# Analyze a Rust project
daemon-rust analyze

# Generate tests
daemon-rust generate
```

## Supported Frameworks

- Axum
- Actix Web
- Rocket
- Poem
- Vanilla Rust

## Features

- **Framework Detection** - Automatically detects Rust web framework
- **Test Generation** - Generates unit and integration tests
- **Quality Analysis** - Analyzes code quality, finds common issues
- **Metrics Collection** - Code coverage, complexity metrics

## Development

```bash
cd crates/daemon-rust
cargo test
cargo build --release
```

## License

MIT

## See Also

- [Main Daemon](https://github.com/Pamacea/daemon)
- [Playwright Rust Feasibility](../docs/PLAYWRIGHT_RUST_FEASIBILITY.md)
- [ESLint/TypeScript Rust Feasibility](../docs/ESLINT_TYPESCRIPT_RUST_FEASIBILITY.md)
