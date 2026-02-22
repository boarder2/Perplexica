---
name: frontend-architecture
description: React component architecture, state management, streaming event handling, styling patterns, and UI conventions. Use when modifying UI components, working on ChatWindow, MessageBox, MarkdownRenderer, handling streaming events in the frontend, or debugging UI rendering issues.
---

# Frontend Architecture

The frontend is a Next.js App Router application using React 19, Tailwind CSS 4, and Headless UI.

## Component Hierarchy

```
Layout (src/components/Layout.tsx)
├── Sidebar (chat history, new chat)
├── Navbar (title, theme switcher)
└── Page content
    ├── EmptyChat (initial state — focus selector + input)
    └── Chat (active conversation)
        ├── MessageBox[] (one per message)
        │   ├── MarkdownRenderer (assistant messages)
        │   │   ├── ToolCall components (inline tool status)
        │   │   ├── SubagentExecution (deep research blocks)
        │   │   ├── ThinkBox (reasoning/thinking blocks)
        │   │   └── CodeBlock (syntax-highlighted code)
        │   └── Image gallery (user messages with attachments)
        ├── TodoWidget (above input, research progress)
        └── MessageInput
            ├── Focus mode selector
            ├── Attach button (images + files)
            ├── ModelConfigurator (inline model picker)
            ├── SystemPromptSelector
            ├── ToolSelector
            └── PersonalizationPicker (location/about-me toggles)
```

## State Management

There is **no global state library**. All state lives in `ChatWindow.tsx` (~900 lines), the main orchestrator component.

### Key state in ChatWindow

| State              | Type                 | Purpose                                                   |
| ------------------ | -------------------- | --------------------------------------------------------- |
| `messages`         | `Message[]`          | Full message history (user + assistant)                   |
| `chatHistory`      | `[string, string][]` | Simplified history tuples for API payload                 |
| `focusMode`        | `string`             | Current focus mode (`webSearch`, `chat`, `localResearch`) |
| `loading`          | `boolean`            | Whether a response is in progress                         |
| `pendingImages`    | `ImageAttachment[]`  | Images attached but not yet sent                          |
| `todoItems`        | `TodoItem[]`         | Current research task list (transient)                    |
| `liveModelStats`   | `ModelStats`         | Token counts during streaming                             |
| `gatheringSources` | `boolean`            | Whether sources are still being collected                 |

### Model preferences (localStorage)

Model selections are stored in `localStorage`, not React state:

- `chatModel`, `chatModelProvider` — Chat model selection
- `systemModel`, `systemModelProvider` — System model selection
- `embeddingModel`, `embeddingModelProvider` — Embedding model
- `linkSystemToChat` — When `"true"`, system model mirrors chat model
- `sendLocation`, `sendProfile` — Personalization toggle states

These are read at send time in `sendMessage()`, not bound to reactive state.

## Streaming Event Handling

`ChatWindow.sendMessage()` POSTs to `/api/chat` and reads the response as a stream:

```typescript
const reader = res.body!.getReader();
// Read loop: decode chunks → split by newlines → parse JSON → dispatch
```

The `messageHandler()` function dispatches by event `type`:

| Event Type                  | Handler Action                                                                   |
| --------------------------- | -------------------------------------------------------------------------------- |
| `response`                  | Append tokens to assistant message content (5-token buffer for smooth rendering) |
| `sources` / `sources_added` | Set/append to message sources array                                              |
| `tool_call_started`         | Append `<ToolCall>` markup to message content                                    |
| `tool_call_success/error`   | Regex-rewrite existing `<ToolCall>` tag attributes                               |
| `subagent_started`          | Append `<SubagentExecution>` markup                                              |
| `subagent_data`             | Forward nested tool/response events to subagent context                          |
| `subagent_completed/error`  | Update SubagentExecution markup with final status                                |
| `todo_update`               | Update `todoItems` state (renders in TodoWidget)                                 |
| `stats`                     | Update `liveModelStats` for token display                                        |
| `messageEnd`                | Finalize assistant message, trigger auto-suggestions                             |
| `ping`                      | No-op keep-alive                                                                 |

## Markdown Rendering

`MarkdownRenderer.tsx` uses `markdown-to-jsx` with custom component overrides:

### Custom elements

- **`<ToolCall>`**: Renders tool execution status widgets (spinner/check/X) with tool-specific icons. Attributes: `type`, `status`, `toolCallId`, `query`, `url`, `error`, etc.
- **`<SubagentExecution>`**: Collapsible deep research panel. Attributes: `name`, `task`, `status`, `response`, `error`.
- **`<a>` links**: Citation links (`[N]`) get special styling with `CitationLink` component.
- **Security blocks**: `iframe`, `script`, `object`, `style` tags render as `null`.

### Think block handling

Before markdown parsing, the renderer extracts `<think>...</think>` blocks (and orphaned `</think>` tags) from LLM output. These render as collapsible `ThinkBox` components above the main content.

## Styling Conventions

### Theme system

- CSS custom properties in `globals.css` define theme tokens
- `theme/Provider.tsx` wraps the app with theme context
- `theme/Switcher.tsx` provides the dark/light toggle

### Key Tailwind patterns

```
bg-surface      — primary background
bg-surface-2    — secondary/card background
text-fg         — primary text
text-fg/70      — muted text (70% opacity)
text-accent     — accent color (links, active items)
border-surface-2 — borders
```

- Use `cn()` utility (from `src/lib/utils.ts`, wraps `clsx` + `tailwind-merge`) for conditional class merging
- Headless UI (`@headlessui/react`) for dropdowns, selects, dialogs
- Lucide React for icons
- `prose prose-theme dark:prose-invert` for markdown content typography

### Component file conventions

- One component per file in `src/components/`
- Sub-components grouped in directories (`MessageActions/`, `MessageInputActions/`, `theme/`, `ui/`)
- Functional components with TypeScript interfaces for props
- No CSS modules — all Tailwind utility classes

## Key Files Reference

| File                                                       | Purpose                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `src/components/ChatWindow.tsx`                            | Main orchestrator — state, streaming, message send |
| `src/components/Chat.tsx`                                  | Message list rendering, scroll management          |
| `src/components/MessageBox.tsx`                            | Individual message display (user + assistant)      |
| `src/components/MessageInput.tsx`                          | Text input, image paste, file attach               |
| `src/components/MarkdownRenderer.tsx`                      | Markdown→JSX with ToolCall/SubagentExecution       |
| `src/components/EmptyChat.tsx`                             | Initial empty state with focus mode                |
| `src/components/TodoWidget.tsx`                            | Research progress bar (transient)                  |
| `src/components/ThinkBox.tsx`                              | Collapsible reasoning/thinking block               |
| `src/components/Sidebar.tsx`                               | Chat history navigation                            |
| `src/components/MessageInputActions/Focus.tsx`             | Focus mode selector buttons                        |
| `src/components/MessageInputActions/ModelConfigurator.tsx` | Inline model picker                                |
| `src/components/MessageActions/SubagentExecution.tsx`      | Deep research UI panel                             |
| `src/components/MessageActions/ModelInfo.tsx`              | Per-response model stats display                   |
