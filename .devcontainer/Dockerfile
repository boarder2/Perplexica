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
    ssh \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Enable Yarn via Corepack (ships with Node)
RUN corepack enable

# Playwright OS dependencies (Chromium). Browser binaries are installed in postCreateCommand.
RUN npm install -g playwright @playwright/cli@latest --no-fund --no-audit \
  && npx playwright install --with-deps \
  && npx playwright install chrome --with-deps \
  && apt-get clean && rm -rf /var/lib/apt/lists/* /root/.npm

# Create directories used by the app when DATA_DIR points here
RUN mkdir -p \
    /home/perplexica/data \
    /home/perplexica/uploads \
    /home/perplexica/storage/deep_research \
    /workspaces/Perplexica \
  && chown -R node:node /home/perplexica /workspaces

WORKDIR /workspaces/Perplexica
USER node

RUN curl -fsSL https://claude.ai/install.sh | bash && echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc