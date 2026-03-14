use daemon_rust::{DaemonCli, Result};
use anyhow::Context;

#[tokio::main]
async fn main() -> Result<()> {
    let cli = DaemonCli::new()?;

    let args: Vec<String> = std::env::args().collect();
    let command = args.get(1).map(|s| s.as_str()).unwrap_or("init");

    match command {
        "init" => {
            let project_path = std::env::current_dir()
                .context("Failed to get current directory")?
                .to_string_lossy()
                .to_string();
            cli.init(&project_path).await?;
        }
        "analyze" => {
            println!("Analyzing Rust project...");
            // TODO: implement analyze command
        }
        _ => {
            println!("Usage: daemon-rust <init|analyze>");
        }
    }

    Ok(())
}
