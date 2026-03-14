//! Configuration management for daemon-rust

use crate::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Daemon configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub project_path: PathBuf,
    pub test_runner: TestRunnerChoice,
    pub generate_e2e: bool,
    pub include_benchmarks: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum TestRunnerChoice {
    #[serde(rename = "auto")]
    Auto,
    #[serde(rename = "cargo")]
    Cargo,
    #[serde(rename = "nextest")]
    Nextest,
}

impl Config {
    /// Load configuration from .daemon/config.json or create default
    pub fn load() -> Result<Self> {
        // For now, return default config
        Ok(Self {
            project_path: std::env::current_dir()
                .context("Failed to get current directory")?,
            test_runner: TestRunnerChoice::Auto,
            generate_e2e: false,
            include_benchmarks: false,
        })
    }

    /// Save configuration to .daemon/config.json
    pub fn save(&self) -> Result<()> {
        let daemon_dir = std::env::current_dir()
            .context("Failed to get current directory")?
            .join(".daemon");

        std::fs::create_dir_all(&daemon_dir)
            .context("Failed to create .daemon directory")?;

        let config_path = daemon_dir.join("config.json");
        let json = serde_json::to_string_pretty(self, Default::default())
            .context("Failed to serialize config")?;

        std::fs::write(&config_path, json)
            .context("Failed to write config")?;

        Ok(())
    }
}
