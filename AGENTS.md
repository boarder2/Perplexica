# Project Overview

Perplexica is an open-source AI-powered search engine that uses advanced machine learning to provide intelligent search results. It combines web search capabilities with LLM-based processing to understand and answer user questions, similar to Perplexity AI but fully open source.

## Architecture

User submits a query → API route → `MetaSearchAgent` routes to focus mode handler → `SimplifiedAgent` (LangGraph React Agent) uses tools to research → streams response with cited sources.

- **Chat Model**: Agent reasoning, final answer generation, streamed user-facing output
- **System Model**: Tools and internal chains (URL summarization, query generation, task breakdown)

### Technology Stack

- **Frontend**: React 19, Next.js (App Router), Tailwind CSS 4, Headless UI
- **Backend**: Node.js, LangChain + LangGraph
- **Database**: SQLite with Drizzle ORM (`src/lib/db/schema.ts`, tables: `messages`, `chats`, `systemPrompts`)
- **Search**: SearXNG integration (`src/lib/searxng.ts`)
- **Content Processing**: Mozilla Readability, Cheerio, Playwright
- **LLM Providers**: OpenAI, Anthropic, Groq, Ollama, Gemini, DeepSeek, LM Studio
- **Embeddings**: Xenova Transformers (cosine/dot product similarity)
- **Tracing**: LangFuse integration (optional, `src/lib/tracing/`)
- **Configuration**: TOML-based (`config.toml` from `sample.config.toml`)

## Project Structure

- `/src/app` — Next.js pages and API routes (`/src/app/api`)
- `/src/components` — React UI components (see **frontend-architecture** skill)
- `/src/lib/search` — `SimplifiedAgent`, `MetaSearchAgent` router, focus-mode handlers
- `/src/lib/providers` — LLM and embedding model integrations (see **adding-features** skill)
- `/src/lib/prompts` — Prompt templates including `prompts/simplifiedAgent/*` (see **prompt-system** skill)
- `/src/lib/tools/agents` — Agent tools (`web_search`, `file_search`, `url_summarization`, `image_search`, `image_analysis`, `deep_research`, `todo_list`, etc.)
- `/src/lib/db` — Database schema and operations
- `/src/lib/chains` — Specialized chains (image/video search helpers)
- `/src/lib/state` — LangGraph agent state annotations
- `/src/lib/utils` — Utility functions, web content retrieval, personalization
- `/src/app/dashboard` — Dashboard page with configurable widgets

## Focus Modes

- **Web Search**: General web search with all tools (default)
- **Local Research**: Research local files with citations (file_search tool)
- **Chat**: Creative conversation, no tools
- **Firefox AI**: Auto-detected; tools disabled, conversational response

## Core Commands

- **Development**: `npm run dev` (Turbopack)
- **Build**: `npm run build` (includes DB push)
- **Production**: `npm run start`
- **Linting**: `npm run lint`
- **Formatting**: `npm run format:write` (Prettier)
- **Database**: `npm run db:push` (Drizzle migrations)

## Configuration

`config.toml` configures API keys, database settings, search engine, and similarity measures. The Settings page also exposes:

- Chat Model selector
- System Model selector (localStorage: `systemModelProvider`, `systemModel`)
- Link System to Chat toggle (`linkSystemToChat`, default ON — system mirrors chat model)

## Code Style & Standards

- **TypeScript**: Strict mode, ES2017 target, path aliases `@/*` → `src/*`
- **Formatting**: Prettier (`npm run format:write` before commits), ESLint (Next.js core web vitals)
- **Imports**: Use `@/` prefix for internal imports
- **Components**: React functional components with TypeScript, one per file
- **Naming**: camelCase functions/variables, PascalCase components
- **Error handling**: try/catch for async, structured error responses from API routes
- **API routes**: Next.js App Router pattern (`src/app/api/`)

## AI Behavior Guidelines

- Focus on factual, technical responses without unnecessary pleasantries
- Avoid conciliatory language and apologies
- Ask for clarification when requirements are unclear
- Do not add dependencies unless explicitly requested
- Only make changes relevant to the specific task
- **Do not create test files or run the application unless requested**
- **Do not run a build to check for errors unless requested**
- Prioritize existing patterns and architectural decisions
- Always update documentation and comments to reflect code changes
- Always update `AGENTS.md` to reflect relevant changes to AI guidelines. This file should **only** reflect the **current** state of the project and should not be used as a historical log.
- When personalization is active, honor the guardrails: location may bias retrieval; About Me is for tone/context only, never sent to external tools verbatim.

## Subsystem References

Detailed documentation lives in skills — loaded on demand when relevant:

- **api-endpoints** — Request/response schemas, payload formats, data flow, model routing details
- **streaming-events** — Tool call lifecycle events, todo updates, subagent events, markup mutation
- **subagent-architecture** — Deep research subagent design, SubagentExecutor, event flow, tool restrictions
- **image-attachments** — Upload/serving endpoints, multimodal LLM messages, clipboard paste, security
- **adding-features** — Step-by-step patterns for adding tools, LLM providers, API routes, focus modes
- **frontend-architecture** — Component hierarchy, ChatWindow state, streaming dispatch, styling conventions
- **prompt-system** — Focus mode prompts, citation templates, personalization injection, system prompt management
- **test-automation** — Static analysis, curl API testing, playwright-cli browser automation
- **playwright-cli** — Browser interaction tool reference

## Available Tools and Help

- Use the context7 tool with these library identifiers:
  - `/quantizor/markdown-to-jsx` for Markdown to JSX conversion
  - `/context7/headlessui_com` for Headless UI components
  - `/tailwindlabs/tailwindcss.com` for Tailwind CSS documentation
  - `/vercel/next.js` for Next.js documentation

- Use the `docs-langchain` tool to query documentation for LangChain or LangGraph when implementing or modifying agents and chains.
