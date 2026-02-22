---
name: streaming-events
description: Real-time streaming event system for tool calls, todo updates, and subagent execution. Use when working on tool call lifecycle events, streaming responses, event handling in SimplifiedAgent, ChatWindow event processing, MarkdownRenderer ToolCall component, TodoWidget, or debugging missing/broken streaming output.
---

# Streaming Events System

The `SimplifiedAgent` emits granular lifecycle events for tool execution, todo updates, and subagent activity so the UI can reflect real-time status.

## Tool Call Lifecycle Events

| Event Type          | When Emitted                                                     | Payload                                                                                                                      | UI Behavior                                                                                                    |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `tool_call_started` | Immediately when a tool run begins (LangChain `handleToolStart`) | `{ data: { content: "<ToolCall … status=\"running\" toolCallId=\"RUN_ID\" …></ToolCall>", toolCallId, status: "running" } }` | Appends a ToolCall widget with spinner                                                                         |
| `tool_call_success` | On successful completion (`handleToolEnd`)                       | `{ data: { toolCallId, status: "success", extra?: { [k: string]: string } } }`                                               | Replaces the widget status icon with green check; merges any `extra` attributes into existing `<ToolCall>` tag |
| `tool_call_error`   | On exception (`handleToolError`)                                 | `{ data: { toolCallId, status: "error", error: "message" } }`                                                                | Replaces spinner with red X and shows error text                                                               |

## Todo List Events

The `todo_list` tool emits `todo_update` events for research progress tracking. Unlike other tools, `todo_list` skips generic `tool_call_started/success/error` events and uses its own rendering via the `TodoWidget` component.

| Event Type    | When Emitted                          | Payload                                      | UI Behavior                                                          |
| ------------- | ------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `todo_update` | Each time the agent calls `todo_list` | `{ data: { todos: [{ content, status }] } }` | Updates the TodoWidget above the message input with current progress |

- The TodoWidget (`src/components/TodoWidget.tsx`) is a collapsible bar above the message input
- Collapsed: shows "Tasks: X/Y complete - [current task]"
- Expanded: shows all items with status icons (pending/in_progress/completed)
- Transient: the widget clears when the response completes (not persisted in message content)
- Only used for thorough/complex research, not simple queries

## Implementation Details

### Backend (Event Emission)

- Emission logic lives in `simplifiedAgent.ts` where callbacks (`handleToolStart`, `handleToolEnd`, `handleToolError`) serialize events to the streaming emitter.
- The API layer (`/src/app/api/chat/route.ts`) transparently forwards these event types to the client with the active assistant `messageId`.

### Frontend (Event Handling)

The frontend (`ChatWindow.tsx`) handles:

- `tool_call_started`: appends the received `<ToolCall …>` markup to the in-progress assistant message.
- `tool_call_success` / `tool_call_error`: regex-rewrites the existing `<ToolCall … toolCallId="RUN_ID" …>` tag, updating `status`, adding `error` (if present) and merging any key/value pairs under `extra` (e.g. `{ videoId }`) as attributes.

### Markdown Rendering

The `ToolCall` component (`MarkdownRenderer.tsx`) accepts `status` + `error` attributes and renders:

- `running`: inline spinner
- `success`: green check
- `error`: red X + error message (truncated, sanitized)

## Markup Mutation

A shared helper (`updateToolCallMarkup` in `src/lib/utils/toolCallMarkup.ts`) is used by both backend and frontend to guarantee identical attribute mutation logic.

## Notes & Constraints

- Tool attributes (`query`, `count`, `url`) are lightly extracted on start and truncated to avoid large payloads.
- `toolCallId` is the LangChain run ID ensuring uniqueness across concurrent tool executions.
- For persistence, the start markup is appended to the stored assistant message content; on `tool_call_success` / `tool_call_error` the backend rewrites the original `<ToolCall …>` tag in the accumulated message with the final `status` (and `error` attribute if present).
- A synthetic Firefox AI detection event is represented as a single `tool_call_started` with `status="success"` and `type="firefoxAI"` (no actual external tool execution).
