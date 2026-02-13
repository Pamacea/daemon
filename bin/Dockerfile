# Daemon - Testing Tools Container
FROM node:20-slim

LABEL maintainer="Yanis"
LABEL description="Daemon - Automated testing tools for web applications"

# Install system dependencies for Playwright and wget with SSL
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
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
    && rm -rf /var/lib/apt/lists/*

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

# Install testing tools globally
RUN npm install -g \
    vitest \
    @vitest/ui \
    @playwright/test \
    @vitejs/plugin-react \
    @testing-library/react \
    @testing-library/jest-dom \
    @testing-library/user-event \
    @testing-library/vue \
    @testing-library/svelte \
    @solidjs/testing-library \
    @vue/test-utils \
    happy-dom

# Install k6 for performance testing
ARG TARGETARCH=amd64
RUN ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "arm64" || echo "amd64") && \
    wget -q "https://github.com/grafana/k6/releases/download/v1.5.0/k6-v1.5.0-linux-${ARCH}.tar.gz" -O /tmp/k6.tar.gz && \
    tar -xzf /tmp/k6.tar.gz -C /tmp && \
    mv /tmp/k6-v1.5.0-linux-${ARCH}/k6 /usr/local/bin/ && \
    rm -rf /tmp/k6.tar.gz /tmp/k6-v1.5.0-linux-${ARCH}

# Install additional tools
RUN npm install -g \
    supertest \
    msw \
    prisma \
    lighthouse

# Create non-root user for security
# Use UID 1001 to avoid conflict with existing node user (UID 1000)
# Check if 'daemon' user exists first (node:20-slim already has it)
RUN id -u daemon >/dev/null 2>&1 || useradd -m -u 1001 -s /bin/bash daemon && \
    mkdir -p /app && \
    chown -R daemon:daemon /app

# Switch to non-root user
USER daemon
WORKDIR /app

# Keep container alive for docker exec
CMD ["sleep", "infinity"]
