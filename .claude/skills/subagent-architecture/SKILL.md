---
name: subagent-architecture
description: Deep research subagent system including SubagentExecutor, tool restrictions, event flow, definitions, and UI integration. Use when working on deep_research tool, subagents, SubagentExecutor, subagent UI components, or the SubagentExecution component.
---

# Subagent Architecture

The main `SimplifiedAgent` has access to a `deep_research` tool that it can invoke on demand when it discovers a query requires deeper investigation. Subagents are not pre-routed — the main agent decides when to use them based on what it learns during research.

## Design Principles

- **No front-loaded overhead**: Simple queries go directly to the main agent without any decomposition LLM call
- **Agent-driven invocation**: The main agent calls `deep_research` as a tool when it discovers complexity mid-research
- **Progressive discovery**: The agent can research first with basic tools, then spawn subagents when it identifies sub-problems needing deeper investigation

## Available Subagents

1. **Deep Research** (`deep_research`)
   - Purpose: Focused investigation of a specific, narrow aspect of a larger question
   - Tools: `web_search`, `url_summarization`, `image_search`, `youtube_transcript`, `pdf_loader`
   - Model: Chat Model (needs reasoning capability)
   - Invoked by: Main agent via `deep_research` tool
   - **Key Principle**: Each call should research ONE specific aspect, not try to answer the entire user question
   - Use Cases:
     - Iterative research: discover scope first, then research specific items in follow-up calls
     - Multi-part queries with 2+ distinct questions (each aspect gets its own subagent call)
     - Comparative analysis ("compare X and Y" → separate subagents for X and Y)
     - Comprehensive queries asking about multiple aspects ("tell me everything about X including Y, Z, W")
     - Complex research topics where user explicitly requests detailed research
   - Iterative Pattern:
     1. Use an initial deep_research (or web_search) to discover the scope/landscape
     2. Based on findings, launch targeted deep_research calls for specific items or groups — task descriptions MUST include the specific entities/items discovered (e.g., name the actual sports, providers, or categories found), never use generic references like "remaining items" or "all finished sports"
     3. Synthesize all findings into a comprehensive final answer

## Architecture

```
User Query → SimplifiedAgent (with all tools including deep_research)
                    ↓
              [Agent researches using web_search, url_summarization, etc.]
                    ↓
              [Discovers complexity?]
               ↓              ↓
             No              Yes
              ↓               ↓
         Respond         Call deep_research tool
                              ↓
                        SubagentExecutor
                              ↓
                        Child SimplifiedAgent (without deep_research)
                              ↓
                        Results flow back to main agent
                              ↓
                         Respond with integrated findings
```

### Key Components

- **Deep Research Tool** (`src/lib/tools/agents/deepResearchTool.ts`)
  - LangGraph tool wrapping SubagentExecutor
  - Returns documents and summary via Command pattern
  - Prevents recursion: subagent's allowedTools excludes `deep_research`

- **SubagentExecutor** (`src/lib/search/subagents/executor.ts`)
  - Wraps SimplifiedAgent with subagent-specific configuration
  - Enforces tool restrictions via allowedTools whitelist
  - Provides isolated event streaming with subagent context
  - Passes empty `personaInstructions` to SimplifiedAgent — subagent behavior is controlled entirely by `customSystemPrompt` from the subagent definition, NOT by persona/formatting instructions
  - Forwards `userLocation`/`userProfile` from the parent agent for location-aware research

- **Definitions** (`src/lib/search/subagents/definitions.ts`)
  - Subagent configurations (system prompt, allowed tools, model selection)
  - Currently defines only `deep_research`

## Execution Flow

1. Main agent receives query and begins research with standard tools
2. Agent determines a sub-problem needs deeper investigation
3. Agent calls `deep_research` tool with a specific task description
4. `deepResearchTool` creates a `SubagentExecutor` with the `deep_research` definition
5. SubagentExecutor spawns a child `SimplifiedAgent` with:
   - Isolated EventEmitter (forwards events to parent as `subagent_data`)
   - Filtered tools (web_search, url_summarization, image_search, youtube_transcript, pdf_loader — no deep_research)
   - Limited context (last 5 messages)
   - Chat Model for reasoning
6. Child agent researches independently and streams tool events
7. Results (documents + summary) return to the main agent via Command pattern
8. Main agent integrates findings into its final response

## UI Integration

Subagent activity is displayed in real-time via the `SubagentExecution` component (`src/components/MessageActions/SubagentExecution.tsx`):

- **Collapsed State**: Shows subagent name, task (truncated), and status icon (spinner/check/X)
- **Expanded State**: Shows full task instructions (not truncated), nested tool calls, collapsible response, and error (if any)
- **Tool Calls**: Always visible when present, regardless of subagent status (running, success, or error). Tool calls are persisted in the message content so they survive page reloads and history loading.
- **Response**: A single unified "Response" section (collapsible) that shows the subagent's markdown output. Uses the final summary when available, falls back to the streaming response text during execution. There is no separate "Result" display — it's all one consistent section.
- **Status Indicators**:
  - `running`: Animated spinner
  - `success`: Green checkmark
  - `error`: Red X + error message

Streaming events:

- `subagent_started`: Appends `<SubagentExecution>` markup with running status
- `subagent_data`: Nested events (tool calls, response tokens) forwarded to parent with subagent context; tool call markup is persisted in both client state and server-side `recievedMessage` for history
- `subagent_completed`/`subagent_error`: Updates markup with final status and results

## Tool Restrictions

The deep_research subagent has a whitelist of allowed tools enforced at execution time:

```typescript
allowedTools: [
  'web_search',
  'url_summarization',
  'image_search',
  'youtube_transcript',
  'pdf_loader',
];
```

Tools are filtered in `SubagentExecutor.getFilteredTools()` before passing to SimplifiedAgent. The `deep_research` tool itself is excluded, preventing recursive subagent spawning.

## Configuration

Subagent definitions are in `src/lib/search/subagents/definitions.ts`:

```typescript
export interface SubagentDefinition {
  name: string; // Display name
  description: string; // Purpose description
  systemPrompt: string; // Custom system prompt
  allowedTools: string[]; // Whitelist of tool names
  useSystemModel: boolean; // true = System Model, false = Chat Model
  maxTurns: number; // Max iterations before forced stop
  parallelizable: boolean; // Can run concurrently with others
}
```

## Integration Points

The `deep_research` tool is registered in `src/lib/tools/agents/index.ts` and included in the `webSearchTools` and `allAgentTools` arrays. It is available to the main agent in web search mode.

`AgentSearch` (`src/lib/search/agentSearch.ts`) runs `SimplifiedAgent` directly — no supervisor or pre-routing.

## Event Flow

```
API Route → AgentSearch → SimplifiedAgent
                              ↓
                    [Agent calls deep_research tool]
                              ↓
                    SubagentExecutor (isolated EventEmitter)
                              ↓
                    Child SimplifiedAgent → tool events
                              ↓
                    Isolated emitter forwards as subagent_data
                              ↓
                    Parent emitter → API Route → ChatWindow
                              ↓
                    MarkdownRenderer (SubagentExecution component)
```

## Constraints

- Each subagent sees only last 5 messages (limited context window)
- Max turns configurable per subagent definition to prevent runaway execution
- No recursive subagents — flat hierarchy only (deep_research excluded from child tools)
- Subagent executions are ephemeral (not stored in database)
- deep_research tool only available in web search mode
- Subagent definitions are hardcoded (no UI for custom subagents)
