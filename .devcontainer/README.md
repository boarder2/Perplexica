# Dev Container

This project includes a VS Code Dev Container configuration that runs Perplexica + SearXNG via Docker Compose.

## How to use

1. Install **Docker Desktop**.
2. In VS Code, run: **Dev Containers: Reopen in Container**.
3. Once the container is ready, start the dev server inside the container:
   - `yarn dev`

Then open:

- Perplexica: http://localhost:3000
- SearXNG: http://localhost:4000

## Notes

- The repo is mounted into the container at `/workspaces/Perplexica` for live editing.
- SQLite + uploads + deep research artifacts are persisted in Docker volumes (not written into your git workspace).
- `config.toml` is read from the workspace root (it is gitignored).
