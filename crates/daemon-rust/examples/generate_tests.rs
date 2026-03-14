//! Generate tests for a Rust project
//!
//! Run with: cargo run --example generate_tests

use daemon_rust::{DaemonCli, Result};
use std::fs;

#[tokio::main]
async fn main() -> Result<()> {
    let cli = DaemonCli::new()?;

    println!("🧪 Generating tests...\n");

    // First analyze the project
    let report = cli.analyze(".")?;

    println!("Found framework: {:?}", report.framework);
    println!("Existing tests: {}\n", report.existing_tests);

    // Generate test plan
    let test_plan = cli.generate_tests(".", &report)?;

    println!("┌────────────────────────────────────────────────────┐");
    println!("│  TEST PLAN                                         │");
    println!("├────────────────────────────────────────────────────┤");
    println!("│  Unit tests: {}", test_plan.unit_tests.len());
    for (i, test) in test_plan.unit_tests.iter().enumerate() {
        println!("│    {}. {}", i + 1, test.description);
    }
    println!("│                                                    │");
    println!("│  Integration tests: {}", test_plan.integration_tests.len());
    for (i, test) in test_plan.integration_tests.iter().enumerate() {
        println!("│    {}. {}", i + 1, test.description);
    }
    println!("└────────────────────────────────────────────────────┘");

    // Write tests to files (dry run)
    println!("\n📝 Files that would be created:");
    for test in test_plan.unit_tests.iter().chain(test_plan.integration_tests.iter()) {
        println!("  ✓ {}", test.path);
    }

    Ok(())
}
