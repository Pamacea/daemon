//! Analyze a Rust project and print the report
//!
//! Run with: cargo run --example analyze

use daemon_rust::{DaemonCli, Result};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize the CLI
    let cli = DaemonCli::new()?;

    // Analyze the current directory
    println!("🔍 Analyzing project...\n");

    let report = cli.analyze(".")?;

    println!("╔══════════════════════════════════════════════════════════╗");
    println!("║                    PROJECT ANALYSIS                      ║");
    println!("╠══════════════════════════════════════════════════════════╣");
    println!("║                                                          ║");
    println!("║  Name: {}", report.project_name);
    println!("║  Framework: {:?}", report.framework);
    println!("║  Test Runner: {:?}", report.test_runner);
    println!("║  Existing Tests: {}", report.existing_tests);
    println!("║                                                          ║");

    if let Some(coverage) = &report.coverage {
        println!("║  Coverage: {:.1}% lines, {:.1}% branches",
            coverage.line_percentage,
            coverage.branch_percentage
        );
    }

    println!("║  Dependencies: {}", report.dependencies.len());
    println!("║  Recommendations: {}", report.recommendations.len());
    println!("║                                                          ║");
    println!("╚══════════════════════════════════════════════════════════╝");

    // Print recommendations
    if !report.recommendations.is_empty() {
        println!("\n📋 Recommendations:");
        for rec in &report.recommendations {
            let icon = match rec.priority {
                daemon_rust::Priority::P0 => "🔴",
                daemon_rust::Priority::P1 => "🟠",
                daemon_rust::Priority::P2 => "🟡",
            };
            println!("  {} {:?} - {}", icon, rec.priority, rec.description);
        }
    }

    Ok(())
}
