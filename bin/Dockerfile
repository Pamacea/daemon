# Daemon - Testing Tools Container v0.7.0
FROM node:20-slim

LABEL maintainer="Yanis"
LABEL description="Daemon v0.7.0 - Automated testing and quality tools for web applications"
LABEL version="0.7.0"

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=development \
    TZ=Europe/Paris

# Rust environment variables
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH="/usr/local/cargo/bin:${PATH}"

# ============================================================================
# SYSTEM DEPENDENCIES
# ============================================================================
# Install system dependencies for Playwright, Rust, and general utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gcc \
    g++ \
    make \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    wget \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# ============================================================================
# RUST TOOLCHAIN
# ============================================================================
# Install Rust with rustup for Rust project testing and compilation
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && \
    rustup component add rustfmt clippy rust-analyzer && \
    cargo install cargo-nextest && \
    cargo install cargo-audit && \
    cargo install cargo-watch && \
    chmod -R a+w $RUSTUP_HOME $CARGO_HOME

# ============================================================================
# PLAYWRIGHT BROWSERS
# ============================================================================
# Install Playwright browsers for E2E testing
RUN npx playwright install --with-deps chromium && \
    npx playwright install --with-deps firefox

# ============================================================================
# TESTING FRAMEWORKS
# ============================================================================
# Core testing frameworks for JavaScript/TypeScript
RUN npm install -g \
    vitest \
    @vitest/ui \
    @playwright/test \
    @vitejs/plugin-react

# Testing libraries for multiple frameworks
RUN npm install -g \
    @testing-library/react \
    @testing-library/jest-dom \
    @testing-library/user-event \
    @testing-library/vue \
    @testing-library/svelte \
    @solidjs/testing-library \
    @vue/test-utils \
    happy-dom

# ============================================================================
# CODE QUALITY TOOLS
# ============================================================================
# ESLint for code linting
RUN npm install -g \
    eslint \
    @typescript-eslint/parser \
    @typescript-eslint/eslint-plugin \
    eslint-config-prettier \
    eslint-plugin-react \
    eslint-plugin-react-hooks \
    eslint-plugin-vue

# Prettier for code formatting
RUN npm install -g prettier prettier-plugin-tailwindcss

# ============================================================================
# SECURITY TOOLS
# ============================================================================
# Security scanning for Node.js dependencies
RUN npm install -g \
    snyk \
    npm audit \
    @npmcli/arborist

# ============================================================================
# PERFORMANCE TESTING TOOLS
# ============================================================================
# Install k6 for load and performance testing
ARG TARGETARCH=amd64
RUN ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "arm64" || echo "amd64") && \
    wget -q "https://github.com/grafana/k6/releases/download/v1.5.0/k6-v1.5.0-linux-${ARCH}.tar.gz" -O /tmp/k6.tar.gz && \
    tar -xzf /tmp/k6.tar.gz -C /tmp && \
    mv /tmp/k6-v1.5.0-linux-${ARCH}/k6 /usr/local/bin/ && \
    rm -rf /tmp/k6.tar.gz /tmp/k6-v1.5.0-linux-${ARCH}

# Performance analysis tools
RUN npm install -g clinic lighthouse

# ============================================================================
# ACCESSIBILITY TESTING TOOLS
# ============================================================================
# Accessibility testing and validation
RUN npm install -g \
    pa11y \
    pa11y-ci \
    @axe-core/cli

# ============================================================================
# API TESTING AND MOCKING
# ============================================================================
# API testing utilities
RUN npm install -g \
    supertest \
    msw \
    axios \
    got

# ============================================================================
# DATABASE TOOLS
# ============================================================================
# Database ORM and CLI tools
RUN npm install -g \
    prisma \
    @prisma/client

# ============================================================================
# REPORTING AND OUTPUT TOOLS
# ============================================================================
# Report generation utilities
RUN npm install -g \
    cli-table3 \
    chalk \
    ora \
    listr2 \
    boxen

# ============================================================================
# ADDITIONAL UTILITIES
# ============================================================================
# Various development utilities
RUN npm install -g \
    rimraf \
    cross-env \
    nodemon \
    tsx \
    ts-node \
    typescript

# Clean up npm cache to reduce image size
RUN npm cache clean --force

# ============================================================================
# USER SETUP
# ============================================================================
# Create non-root user for security
# Use UID 1001 to avoid conflict with existing node user (UID 1000)
RUN id -u daemon >/dev/null 2>&1 || useradd -m -u 1001 -s /bin/bash daemon && \
    mkdir -p /app /home/daemon/.local/bin && \
    chown -R daemon:daemon /app /home/daemon

# ============================================================================
# WORKING DIRECTORY
# ============================================================================
WORKDIR /app

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER daemon

# Expose common ports
EXPOSE 9323 3000 5173 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]

# Default command - keep container alive
CMD ["sleep", "infinity"]
