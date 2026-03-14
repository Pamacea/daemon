pub mod cli;
pub mod config;
pub mod generators;
pub mod analyzers;

pub use cli::DaemonCli;
pub use config::Config;

/// Result type for Daemon operations
pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;

/// Daemon Rust - Main library trait
///
/// This trait defines the interface for Rust project analysis and test generation.
pub trait DaemonRust {
    /// Analyze a Rust project and generate test recommendations
    fn analyze(&self, project_path: &str) -> Result<AnalysisReport>;

    /// Generate test files for the project
    fn generate_tests(&self, project_path: &str, report: &AnalysisReport) -> Result<TestPlan>;

    /// Run tests and report results
    fn run_tests(&self, project_path: &str) -> Result<TestResults>;
}

/// Analysis report for a Rust project
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AnalysisReport {
    pub project_name: String,
    pub framework: Option<RustFramework>,
    pub test_runner: TestRunner,
    pub existing_tests: usize,
    pub coverage: Option<CoverageInfo>,
    pub dependencies: Vec<Dependency>,
    pub recommendations: Vec<Recommendation>,
}

/// Rust frameworks supported by Daemon
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum RustFramework {
    #[serde(rename = "axum")]
    Axum,
    #[serde(rename = "actix")]
    ActixWeb,
    #[serde(rename = "rocket")]
    Rocket,
    #[serde(rename = "actix")]
    Actix,
    #[serde(rename = "poem")]
    Poem,
    #[serde(rename = "none")]
    Vanilla,
}

/// Test runners for Rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum TestRunner {
    #[serde(rename = "cargo-test")]
    CargoTest,
    #[serde(rename = "nextest")]
    Nextest,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CoverageInfo {
    pub line_percentage: f64,
    pub branch_percentage: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Dependency {
    pub name: String,
    pub version: String,
    pub category: DepCategory,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum DepCategory {
    #[serde(rename = "web-framework")]
    WebFramework,
    #[serde(rename = "async-runtime")]
    AsyncRuntime,
    #[serde(rename = "database")]
    Database,
    #[serde(rename = "testing")]
    Testing,
    #[serde(rename = "serde")]
    Serde,
    #[serde(rename = "utils")]
    Utils,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Recommendation {
    pub priority: Priority,
    pub category: RecommendationCategory,
    pub description: String,
    pub effort: Effort,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum Priority {
    #[serde(rename = "p0")]
    P0,
    #[serde(rename = "p1")]
    P1,
    #[serde(rename = "p2")]
    P2,
}

#[derive(Debug, Clone, serde::serialize::Serialize, serde::Deserialize)]
pub enum RecommendationCategory {
    #[serde(rename = "testing")]
    Testing,
    #[serde(rename = "quality")]
    Quality,
    #[serde(rename = "security")]
    Security,
    #[serde(rename = "performance")]
    Performance,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum Effort {
    #[serde(rename = "quick")]
    Quick,
    #[serde(rename = "moderate")]
    Moderate,
    #[serde(rename = "significant")]
    Significant,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestPlan {
    pub unit_tests: Vec<TestFile>,
    pub integration_tests: Vec<TestFile>,
    pub e2e_tests: Option<Vec<TestFile>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestFile {
    pub path: String,
    pub description: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestResults {
    pub total: usize,
    pub passed: usize,
    pub failed: usize,
    pub duration_ms: u64,
    pub details: Vec<TestDetail>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestDetail {
    pub name: String,
    pub status: TestStatus,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum TestStatus {
    #[serde(rename = "passed")]
    Passed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "skipped")]
    Skipped,
}
