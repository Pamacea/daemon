# Daemon - Testing Tools Container
# Build time: ~5-7 minutes with optimizations

FROM node:20-slim

LABEL maintainer="Yanis"
LABEL description="Daemon v0.7.5 - AI-powered testing toolkit with optimized build"
LABEL version="0.7.5"

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=development \
    TZ=Europe/Paris

# ============================================================================
# OPTIMIZATION 1: Install system deps in ONE layer with better caching
# ============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gcc g++ make wget build-essential pkg-config libssl-dev \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# ============================================================================
# OPTIMIZATION 2: Use cargo-binstall for pre-built Rust binaries (2 min → 30s)
# ============================================================================
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH="/usr/local/cargo/bin:${PATH}"

# Install minimal Rust + cargo-binstall, then use binstall for pre-built binaries
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal && \
    rustup component add rustfmt clippy && \
    curl -L --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh | bash && \
    cargo binstall -y cargo-nextest cargo-audit cargo-watch --secure && \
    chmod -R a+w $RUSTUP_HOME $CARGO_HOME

# ============================================================================
# OPTIMIZATION 3: Install Playwright browsers (chromium only, smaller)
# ============================================================================
RUN npx playwright install --with-deps chromium

# ============================================================================
# OPTIMIZATION 4: Single npm install with ALL packages (better caching)
# ============================================================================
RUN npm install -g \
    vitest @vitest/ui @playwright/test @vitejs/plugin-react \
    @testing-library/react @testing-library/jest-dom @testing-library/user-event \
    @testing-library/vue @testing-library/svelte @solidjs/testing-library \
    @vue/test-utils happy-dom \
    eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
    eslint-config-prettier eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-vue \
    prettier prettier-plugin-tailwindcss \
    snyk @npmcli/arborist \
    clinic lighthouse \
    pa11y pa11y-ci @axe-core/cli \
    supertest msw axios got \
    prisma @prisma/client \
    cli-table3 chalk ora listr2 boxen \
    rimraf cross-env nodemon tsx ts-node typescript

# ============================================================================
# OPTIMIZATION 5: k6 binary download
# ============================================================================
ARG TARGETARCH=amd64
RUN ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "arm64" || echo "amd64") && \
    wget -q "https://github.com/grafana/k6/releases/download/v1.5.0/k6-v1.5.0-linux-${ARCH}.tar.gz" -O /tmp/k6.tar.gz && \
    tar -xzf /tmp/k6.tar.gz -C /tmp && \
    mv /tmp/k6-v1.5.0-linux-${ARCH}/k6 /usr/local/bin/ && \
    rm -rf /tmp/k6.tar.gz /tmp/k6-v1.5.0-linux-${ARCH}

# Clean up npm cache
RUN npm cache clean --force

# ============================================================================
# USER SETUP
# ============================================================================
RUN useradd -m -u 1001 -s /bin/bash daemon && \
    mkdir -p /app /home/daemon/.local/bin && \
    chown -R daemon:daemon /app /home/daemon

WORKDIR /app
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER daemon
EXPOSE 9323 3000 5173 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sleep", "infinity"]
