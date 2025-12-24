FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    procps \
    python3 \
    pipx \
    make \
    g++ \
    sqlite3 \
  && rm -rf /var/lib/apt/lists/*

# Enable Yarn via Corepack (ships with Node)
RUN corepack enable

# Playwright OS dependencies (Chromium). Browser binaries are installed in postCreateCommand.
RUN npm install -g playwright --no-fund --no-audit \
  && npx playwright install-deps chromium \
  && rm -rf /root/.npm

# Create directories used by the app when DATA_DIR points here
RUN mkdir -p \
    /home/perplexica/data \
    /home/perplexica/uploads \
    /home/perplexica/storage/deep_research \
    /workspaces/Perplexica \
  && chown -R node:node /home/perplexica /workspaces

WORKDIR /workspaces/Perplexica
USER node

# Install uv (Python package manager) and spec-kit (CLI tool)
# RUN pipx install uv && pipx ensurepath && /home/node/.local/bin/uv tool install specify-cli --from git+https://github.com/github/spec-kit.git