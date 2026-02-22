---
name: prompt-system
description: Prompt template architecture, focus mode prompts, citation formatting templates, personalization context injection, and system prompt management. Use when modifying agent prompts, adding citation styles, working on personalization, changing how the agent responds, or debugging prompt-related behavior.
---

# Prompt System

Perplexica uses a two-layer prompt architecture for the `SimplifiedAgent`, plus a personalization injection system and user-managed system prompts.

## Architecture Overview

```
User-managed system prompts (DB: systemPrompts table)
    ↓ (resolved by ID, prepended as persona instructions)
Focus mode prompt (src/lib/prompts/simplifiedAgent/*.ts)
    ↓ (includes formatting template)
Formatting template (src/lib/prompts/templates.ts)
    ↓
Personalization section (src/lib/utils/personalization.ts)
    ↓
Final system prompt → SimplifiedAgent
```

## Focus Mode Prompts

Located in `src/lib/prompts/simplifiedAgent/`:

| File               | Mode            | Has Tools         | Key Behavior                                                                                                                     |
| ------------------ | --------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `webSearch.ts`     | `webSearch`     | Yes (all tools)   | Research assistant with search limits (max 4 web searches, max 4 deep_research calls), iterative strategy, citation instructions |
| `chat.ts`          | `chat`          | No                | Conversational AI, no tool access, direct response                                                                               |
| `localResearch.ts` | `localResearch` | Yes (file_search) | Document analysis with file citation style                                                                                       |
| `firefoxAI.ts`     | Firefox AI      | No                | Tools disabled, conversational response                                                                                          |

Each prompt imports and includes a formatting template for citation style.

## Formatting & Citation Templates

Located in `src/lib/prompts/templates.ts`. These are `Prompt` objects with a `content` string:

| Template                          | Used By         | Citation Style                                           |
| --------------------------------- | --------------- | -------------------------------------------------------- |
| `formattingAndCitationsWeb`       | `webSearch`     | `[N]` notation linking to source URLs, inline citations  |
| `formattingAndCitationsLocal`     | `localResearch` | Local document citations with file references            |
| `formattingChat`                  | `chat`          | Minimal — no citations, conversational                   |
| `formattingAndCitationsScholarly` | (available)     | Academic format with abstract/intro/methodology sections |

To add a new citation style: create a new `Prompt` in `templates.ts` and import it in the focus mode prompt file.

## Personalization Context

When personalization toggles are enabled in the UI, context is injected into the system prompt via `buildPersonalizationSection()` from `src/lib/utils/personalization.ts`.

### Section structure

The function generates a `## Personalization` block appended to the system prompt with:

- **Privacy directive**: Never share the user's personal information back in responses
- **Relevance directive**: Use personalization only when it's genuinely helpful
- **Safety directive**: Never include personalization data in external tool calls or searches
- **Authority directive**: If user's message conflicts with personalization, the message wins

### Data flow

1. User toggles location/about-me in `PersonalizationPicker` component
2. Preferences stored in localStorage (`sendLocation`, `sendProfile`)
3. `ChatWindow.sendMessage()` reads toggles and includes `userLocation`/`userProfile` in payload
4. API route passes them through to `MetaSearchAgent` → `SimplifiedAgent`
5. `SimplifiedAgent` calls `buildPersonalizationSection(userLocation, userProfile)` and appends to system prompt
6. Subagents receive `userLocation`/`userProfile` for search context but get empty `personaInstructions`

### Guardrails

- Location can influence search queries and tool usage (e.g., local results)
- About Me is for tone and context only — never sent to external tools verbatim
- About Me must never appear in the response output as-is

## User-Managed System Prompts (Personas)

Stored in the `systemPrompts` database table:

```typescript
// Schema: src/lib/db/schema.ts
{
  id: string; // UUID
  name: string; // Display name
  content: string; // Prompt text
  type: string; // "system" or "persona"
  createdAt: string;
  updatedAt: string;
}
```

### How they're applied

1. User selects prompts via `SystemPromptSelector` component
2. Selected IDs sent as `selectedSystemPromptIds` in chat payload
3. API route resolves IDs to content from the database
4. Content is prepended to the focus mode prompt as `personaInstructions`
5. `SimplifiedAgent` receives `personaInstructions` parameter and prepends it to the system prompt

### API endpoints

- `GET /api/system-prompts` — List all system prompts
- `POST /api/system-prompts` — Create a new prompt
- `PUT /api/system-prompts/[id]` — Update a prompt
- `DELETE /api/system-prompts/[id]` — Delete a prompt

## Legacy Prompts

The `src/lib/prompts/` root directory contains older prompt files (`webSearchRetriever`, `webSearchResponse`, `localResearch`, `chat`). These are referenced in `MetaSearchAgent` config but the actual agent uses the `simplifiedAgent/` prompts. The legacy prompts are effectively unused in the current architecture.

## Modifying Prompts

When changing agent behavior:

1. **Change what the agent says/does**: Edit the focus mode prompt in `src/lib/prompts/simplifiedAgent/`
2. **Change citation format**: Edit or add templates in `src/lib/prompts/templates.ts`
3. **Change personalization behavior**: Edit `src/lib/utils/personalization.ts`
4. **Add a new focus mode prompt**: Create a new file in `simplifiedAgent/`, register in `SimplifiedAgent.getToolsForFocusMode()` and `src/lib/search/index.ts`
