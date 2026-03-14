// # daemon-rust
//
// Rust support for [Daemon](https://github.com/Pamacea/daemon) - AI-powered testing and code quality toolkit.
//
// ## Features
//
// - **Framework Detection** - Automatically detects Rust web frameworks (Axum, Actix, Rocket, Poem)
// - **Test Generation** - Generates unit and integration tests
// - **Quality Analysis** - Analyzes code quality, finds common issues
// - **Metrics Collection** - Code coverage, complexity metrics
//
// ## Quick Start
//
// ```rust,no_run
// use daemon_rust::{DaemonCli, Config};
//
// #[tokio::main]
// async fn main() -> Result<(), Box<dyn std::error::Error>> {
//     let cli = DaemonCli::new()?;
//     let config = Config::from_file("daemon-rust.toml")?;
//
//     // Analyze a Rust project
//     cli.analyze(".").await?;
//
//     // Generate tests
//     cli.generate_tests(".").await?;
//
//     Ok(())
// }
// ```

pub mod cli;
pub mod config;
pub mod generators;
pub mod analyzers;

pub use cli::DaemonCli;
pub use config::Config;

// Re-export anyhow for convenience
pub use anyhow;

/// Result type for Daemon operations
///
/// This type alias uses `anyhow::Result` for simplified error handling.
pub type Result<T> = anyhow::Result<T>;

/// Daemon Rust - Main library trait
///
/// This trait defines the core interface for Rust project analysis and test generation.
/// Implementations of this trait can provide custom analysis strategies while maintaining
/// a consistent API.
///
/// # Example
///
/// ```rust,no_run
/// use daemon_rust::{DaemonRust, AnalysisReport, Result};
///
/// struct MyAnalyzer;
///
/// impl DaemonRust for MyAnalyzer {
///     fn analyze(&self, project_path: &str) -> Result<AnalysisReport> {
///         // Custom analysis logic
///         Ok(AnalysisReport {
///             project_name: "my-project".to_string(),
///             framework: None,
///             test_runner: TestRunner::CargoTest,
///             existing_tests: 0,
///             coverage: None,
///             dependencies: vec![],
///             recommendations: vec![],
///         })
///     }
///
///     fn generate_tests(&self, project_path: &str, report: &AnalysisReport) -> Result<TestPlan> {
///         // Test generation logic
///         Ok(TestPlan {
///             unit_tests: vec![],
///             integration_tests: vec![],
///             e2e_tests: None,
///         })
///     }
///
///     fn run_tests(&self, project_path: &str) -> Result<TestResults> {
///         // Test execution logic
///         Ok(TestResults {
///             total: 0,
///             passed: 0,
///             failed: 0,
///             duration_ms: 0,
///             details: vec![],
///         })
///     }
/// }
/// ```
pub trait DaemonRust {
    /// Analyze a Rust project and generate test recommendations
    ///
    /// # Arguments
    ///
    /// * `project_path` - Path to the Rust project root (containing Cargo.toml)
    ///
    /// # Returns
    ///
    /// An `AnalysisReport` containing framework detection, dependency analysis,
    /// and testing recommendations.
    ///
    /// # Errors
    ///
    /// Returns an error if the project path is invalid, Cargo.toml cannot be read,
    /// or the project cannot be analyzed.
    fn analyze(&self, project_path: &str) -> Result<AnalysisReport>;

    /// Generate test files for the project
    ///
    /// # Arguments
    ///
    /// * `project_path` - Path to the Rust project root
    /// * `report` - The analysis report from [`analyze`](Self::analyze)
    ///
    /// # Returns
    ///
    /// A `TestPlan` containing generated test files organized by type.
    fn generate_tests(&self, project_path: &str, report: &AnalysisReport) -> Result<TestPlan>;

    /// Run tests and report results
    ///
    /// # Arguments
    ///
    /// * `project_path` - Path to the Rust project root
    ///
    /// # Returns
    ///
    /// `TestResults` with pass/fail counts and individual test details.
    fn run_tests(&self, project_path: &str) -> Result<TestResults>;
}

/// Analysis report for a Rust project
///
/// Contains comprehensive information about a analyzed Rust project including
/// detected framework, existing test coverage, and actionable recommendations.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AnalysisReport {
    /// Name of the project from Cargo.toml
    pub project_name: String,
    /// Detected web framework (if any)
    pub framework: Option<RustFramework>,
    /// Test runner detected or configured
    pub test_runner: TestRunner,
    /// Number of existing test files found
    pub existing_tests: usize,
    /// Code coverage information (if available)
    pub coverage: Option<CoverageInfo>,
    /// All dependencies from Cargo.toml
    pub dependencies: Vec<Dependency>,
    /// Generated recommendations for improving testing
    pub recommendations: Vec<Recommendation>,
}

/// Rust web frameworks supported by Daemon
///
/// Each variant represents a major Rust web framework that Daemon
/// can detect and generate tests for.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RustFramework {
    /// [Axum](https://github.com/tokio-rs/axum) - Ergonomic and modular web framework
    Axum,
    /// [Actix Web](https://github.com/actix/actix-web) - Powerful, pragmatic framework
    ActixWeb,
    /// [Rocket](https://github.com/SergioBenitez/Rocket) - Simple, fast web framework
    Rocket,
    /// Legacy alias for ActixWeb
    Actix,
    /// [Poem](https://github.com/poem-web/poem) - Full-featured and easy-to-use web framework
    Poem,
    /// No web framework detected (vanilla Rust)
    Vanilla,
}

/// Test runners supported by Daemon
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TestRunner {
    /// Standard `cargo test`
    CargoTest,
    /// [cargo-nextest](https://nexte.st) - Faster test runner
    Nextest,
}

/// Code coverage information
///
/// Contains line and branch coverage percentages.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CoverageInfo {
    /// Percentage of lines covered (0.0 to 100.0)
    pub line_percentage: f64,
    /// Percentage of branches covered (0.0 to 100.0)
    pub branch_percentage: f64,
}

/// A Cargo dependency
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Dependency {
    /// Crate name
    pub name: String,
    /// Version requirement
    pub version: String,
    /// Category of the dependency
    pub category: DepCategory,
}

/// Dependency category for classification
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DepCategory {
    /// Web framework (axum, actix-web, etc.)
    WebFramework,
    /// Async runtime (tokio, async-std)
    AsyncRuntime,
    /// Database (sqlx, diesel, sea-orm)
    Database,
    /// Testing (criterion, proptest, etc.)
    Testing,
    /// Serialization (serde, serde_json)
    Serde,
    /// Utilities
    Utils,
}

/// A recommendation for improving the project
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Recommendation {
    /// Priority level (P0 = critical)
    pub priority: Priority,
    /// Category of the recommendation
    pub category: RecommendationCategory,
    /// Human-readable description
    pub description: String,
    /// Estimated effort to implement
    pub effort: Effort,
}

/// Priority level for recommendations
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    /// Critical - should be addressed immediately
    P0,
    /// High priority
    P1,
    /// Normal priority
    P2,
}

/// Category of recommendation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecommendationCategory {
    /// Test-related recommendations
    Testing,
    /// Code quality improvements
    Quality,
    /// Security fixes
    Security,
    /// Performance optimizations
    Performance,
}

/// Effort required to implement a recommendation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Effort {
    /// Can be done quickly (< 1 hour)
    Quick,
    /// Moderate effort (1-4 hours)
    Moderate,
    /// Requires significant work (> 4 hours)
    Significant,
}

/// Generated test plan
///
/// Contains organized test files ready to be written to disk.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestPlan {
    /// Unit test files (alongside source code)
    pub unit_tests: Vec<TestFile>,
    /// Integration test files (in tests/ directory)
    pub integration_tests: Vec<TestFile>,
    /// E2E test files (if applicable)
    pub e2e_tests: Option<Vec<TestFile>>,
}

/// A generated test file
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestFile {
    /// File path relative to project root
    pub path: String,
    /// Description of what the file tests
    pub description: String,
    /// Complete file content
    pub content: String,
}

/// Results from running tests
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestResults {
    /// Total number of tests run
    pub total: usize,
    /// Number of passing tests
    pub passed: usize,
    /// Number of failing tests
    pub failed: usize,
    /// Total duration in milliseconds
    pub duration_ms: u64,
    /// Individual test results
    pub details: Vec<TestDetail>,
}

/// Result of a single test
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestDetail {
    /// Test name
    pub name: String,
    /// Test status
    pub status: TestStatus,
    /// Test duration in milliseconds
    pub duration_ms: u64,
}

/// Status of a test
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TestStatus {
    /// Test passed
    Passed,
    /// Test failed
    Failed,
    /// Test was skipped
    Skipped,
}
