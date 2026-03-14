//! Analyzers for Rust projects
//!
//! Provides static analysis, code quality checks, and metrics collection

use crate::{Result, RustFramework};
use regex::Regex;
use std::path::Path;

/// Static analyzer for Rust projects
pub struct RustAnalyzer {
    framework: RustFramework,
}

impl RustAnalyzer {
    /// Create a new analyzer for the given framework
    pub fn new(framework: RustFramework) -> Self {
        Self { framework }
    }

    /// Analyze a Rust project and return metrics
    pub fn analyze(&self, project_path: &str) -> Result<ProjectMetrics> {
        let path = Path::new(project_path);

        Ok(ProjectMetrics {
            total_lines: self.count_lines(&path)?,
            test_files: self.count_test_files(&path)?,
            dependencies: self.analyze_dependencies(&path)?,
            has_clippy: self.has_clippy_toml(&path),
            has_docs_rs: self.has_docs_rs(&path),
            framework: self.framework.clone(),
        })
    }

    fn count_lines(&self, path: &Path) -> Result<usize> {
        let mut count = 0;

        for entry in walkdir::WalkDir::new(path.join("src"))
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension() == "rs")
        {
            let content = std::fs::read_to_string(entry.path())?;
            count += content.lines().count();
        }

        Ok(count)
    }

    fn count_test_files(&self, path: &Path) -> Result<usize> {
        let mut count = 0;

        for entry in glob::glob(&path.join("src/**/*_test.rs").display().to_string())
            .unwrap_or_else(|_| glob::glob(&path.join("tests/**/*.rs").display().to_string()).unwrap())
        {
            if entry.is_ok() {
                count += 1;
            }
        }

        Ok(count)
    }

    fn analyze_dependencies(&self, path: &Path) -> Result<Vec<String>> {
        let cargo_toml = path.join("Cargo.toml");
        let content = std::fs::read_to_string(&cargo_toml)?;

        // Parse dependencies with regex
        let dep_regex = Regex::new(r#"^\s+([\w-]+)\s*=")?#)?;
        let mut deps = Vec::new();

        for line in content.lines() {
            if let Some(cap) = dep_regex.captures(line.as_ref()) {
                if let Some(dep_name) = cap.get(1) {
                    deps.push(dep_name.to_string());
                }
            }
        }

        Ok(deps)
    }

    fn has_clippy_toml(&self, path: &Path) -> bool {
        path.join("clippy.toml").exists()
    }

    fn has_docs_rs(&self, path: &Path) -> bool {
        path.join("src/docs.rs").exists()
    }
}

/// Metrics for a Rust project
#[derive(Debug, Clone)]
pub struct ProjectMetrics {
    pub total_lines: usize,
    pub test_files: usize,
    pub dependencies: Vec<String>,
    pub has_clippy: bool,
    pub has_docs_rs: bool,
    pub framework: RustFramework,
}

/// Code quality analyzer for Rust
pub struct QualityAnalyzer;

impl QualityAnalyzer {
    /// Check code quality issues in a Rust project
    pub fn analyze(&self, project_path: &str) -> Result<Vec<QualityIssue>> {
        let mut issues = Vec::new();

        let path = Path::new(project_path);

        // Check for common issues
        if !path.join("clippy.toml").exists() {
            issues.push(QualityIssue {
                severity: Severity::Medium,
                category: IssueCategory::Tooling,
                message: "No clippy.toml found. Add it for lint configuration.".to_string(),
            });
        }

        if !path.join("src/docs.rs").exists() {
            issues.push(QualityIssue {
                severity: Severity::Low,
                category: IssueCategory::Documentation,
                message: "No src/docs.rs found. Add module documentation.".to_string(),
            });
        }

        // Check for unwrap() usage (potential panic)
        let src_dir = path.join("src");
        if src_dir.exists() {
            let unwrap_count = self.count_unwraps(&src_dir)?;
            if unwrap_count > 10 {
                issues.push(QualityIssue {
                    severity: Severity::Medium,
                    category: IssueCategory::Safety,
                    message: format!("Found {} unwrap() calls. Consider using proper error handling.", unwrap_count),
                });
            }
        }

        Ok(issues)
    }

    fn count_unwraps(&self, dir: &Path) -> Result<usize> {
        let mut count = 0;
        let re = Regex::new(r"\.unwrap\(\)").unwrap();

        for entry in walkdir::WalkDir::new(dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension() == "rs")
        {
            let content = std::fs::read_to_string(entry.path())?;
            count += re.find_iter(&content).count();
        }

        Ok(count)
    }
}

#[derive(Debug, Clone)]
pub struct QualityIssue {
    pub severity: Severity,
    pub category: IssueCategory,
    pub message: String,
}

#[derive(Debug, Clone)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone)]
pub enum IssueCategory {
    Safety,
    Performance,
    Style,
    Documentation,
    Tooling,
}
