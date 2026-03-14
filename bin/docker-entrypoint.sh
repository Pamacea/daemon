#!/usr/bin/env bash
# Daemon Docker Container Entrypoint v0.7.0
# This script handles container initialization, environment setup, and cleanup

set -e

# ============================================================================
# COLORS FOR OUTPUT
# ============================================================================
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export PURPLE='\033[0;35m'
export CYAN='\033[0;36m'
export NC='\033[0m' # No Color

# ============================================================================
# BANNER
# ============================================================================
print_banner() {
    cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗            ║
║   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝            ║
║   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗            ║
║   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║            ║
║   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║            ║
║   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝            ║
║                                                           ║
║                    v0.7.0 - Testing Suite                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
}

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_tool() {
    echo -e "${CYAN}[TOOL]${NC} $1"
}

# ============================================================================
# ENVIRONMENT SETUP
# ============================================================================
setup_environment() {
    log_info "Setting up environment..."

    # Set timezone if specified
    if [ -n "${TZ}" ]; then
        export TZ="${TZ}"
        log_info "Timezone set to ${TZ}"
    fi

    # Ensure Rust is in PATH
    if [ -d "/usr/local/cargo/bin" ]; then
        export PATH="/usr/local/cargo/bin:${PATH}"
        log_success "Rust toolchain configured"
    fi

    # Create working directory if it doesn't exist
    mkdir -p /app/{logs,reports,temp}

    # Set Node environment
    export NODE_ENV="${NODE_ENV:-development}"

    log_success "Environment setup complete"
}

# ============================================================================
# TOOL VERSION DISPLAY
# ============================================================================
show_versions() {
    log_info "Installed tools:"
    echo ""

    # Node.js
    log_tool "Node.js: $(node --version 2>/dev/null || echo 'not installed')"

    # Rust
    log_tool "Rust: $(rustc --version 2>/dev/null || echo 'not installed')"
    log_tool "Cargo: $(cargo --version 2>/dev/null || echo 'not installed')"

    # Testing frameworks
    log_tool "Vitest: $(vitest --version 2>/dev/null || echo 'not installed')"
    log_tool "Playwright: $(playwright --version 2>/dev/null || echo 'not installed')"

    # Performance tools
    log_tool "k6: $(k6 version 2>/dev/null | head -1 || echo 'not installed')"
    log_tool "Lighthouse: $(lighthouse --version 2>/dev/null || echo 'not installed')"

    # Security tools
    log_tool "Snyk: $(snyk --version 2>/dev/null || echo 'not installed')"

    # Code quality
    log_tool "ESLint: $(eslint --version 2>/dev/null || echo 'not installed')"
    log_tool "Prettier: $(prettier --version 2>/dev/null || echo 'not installed')"

    # Database
    log_tool "Prisma: $(prisma --version 2>/dev/null || echo 'not installed')"

    # Accessibility
    log_tool "Pa11y: $(pa11y --version 2>/dev/null || echo 'not installed')"

    # TypeScript
    log_tool "TypeScript: $(tsc --version 2>/dev/null || echo 'not installed')"

    echo ""
}

# ============================================================================
# AVAILABLE COMMANDS HELP
# ============================================================================
show_help() {
    cat << EOF
${CYAN}Daemon v0.7.0 - Available Commands${NC}

${YELLOW}Testing Commands:${NC}
  vitest              Run Vitest unit tests
  playwright          Run Playwright E2E tests
  k6 run <script>     Run k6 performance test
  lighthouse <url>    Run Lighthouse audit

${YELLOW}Code Quality:${NC}
  eslint <files>      Run ESLint
  prettier <files>    Run Prettier
  rustfmt <files>     Format Rust code
  clippy              Run Rust linter

${YELLOW}Security:${NC}
  snyk test           Run Snyk security scan
  npm audit           Audit npm dependencies
  cargo audit         Audit Rust dependencies

${YELLOW}Accessibility:${NC}
  pa11y <url>         Run accessibility test
  axe <url>           Run axe-core test

${YELLOW}Database:${NC}
  prisma <command>    Run Prisma CLI

${YELLOW}Utilities:${NC}
  versions            Show all tool versions
  help                Show this help message
  shell               Start bash shell

${YELLOW}Examples:${NC}
  vitest run --coverage
  playwright test --project=chromium
  k6 run performance/test.js
  lighthouse https://example.com --output html
  snyk test --json

EOF
}

# ============================================================================
# CLEANUP FUNCTION
# ============================================================================
cleanup() {
    log_info "Cleaning up before exit..."

    # Remove temporary files
    rm -rf /app/temp/*

    # Clean npm cache
    npm cache clean --force 2>/dev/null || true

    log_success "Cleanup complete"
}

# ============================================================================
# SIGNAL HANDLERS
# ============================================================================
trap cleanup EXIT INT TERM

# ============================================================================
# COMMAND ROUTING
# ============================================================================
route_command() {
    local cmd="$1"

    case "${cmd}" in
        versions|--version|-v)
            show_versions
            exit 0
            ;;
        help|--help|-h)
            show_help
            exit 0
            ;;
        shell)
            exec /bin/bash
            ;;
        vitest)
            shift
            exec vitest "$@"
            ;;
        playwright)
            shift
            exec playwright "$@"
            ;;
        eslint)
            shift
            exec eslint "$@"
            ;;
        prettier)
            shift
            exec prettier "$@"
            ;;
        k6)
            shift
            exec k6 "$@"
            ;;
        lighthouse)
            shift
            exec lighthouse "$@"
            ;;
        snyk)
            shift
            exec snyk "$@"
            ;;
        pa11y)
            shift
            exec pa11y "$@"
            ;;
        prisma)
            shift
            exec prisma "$@"
            ;;
        cargo)
            shift
            exec cargo "$@"
            ;;
        rustc)
            shift
            exec rustc "$@"
            ;;
        "")
            # No command specified, keep container alive
            log_info "No command specified. Container running..."
            log_info "Use 'docker exec -it <container> help' for available commands"
            exec sleep infinity
            ;;
        *)
            # Pass through unknown commands
            log_info "Executing: $@"
            exec "$@"
            ;;
    esac
}

# ============================================================================
# MAIN ENTRYPOINT
# ============================================================================
main() {
    print_banner
    setup_environment

    # If no arguments, show versions and keep alive
    if [ $# -eq 0 ]; then
        echo ""
        show_versions
        echo ""
        log_info "Container ready. Use 'docker exec -it <container> <command>' to run commands"
        echo ""
        exec sleep infinity
    fi

    # Route the command
    route_command "$@"
}

# Run main function
main "$@"
