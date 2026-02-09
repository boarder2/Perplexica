import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';

const TodoItemSchema = z.object({
  content: z.string().describe('Description of the research task'),
  status: z
    .enum(['pending', 'in_progress', 'completed'])
    .describe('Current status of this task'),
});

const TodoListToolSchema = z.object({
  todos: z
    .array(TodoItemSchema)
    .max(10, 'Task list cannot exceed 10 items')
    .min(1, 'Task list must have at least 1 item')
    .describe(
      'The complete todo list state. Each call replaces the entire list. Maximum 10 items.',
    ),
});

/**
 * TodoListTool - Allows the agent to manage a research plan todo list
 *
 * This tool provides direct state management for tracking research progress.
 * The agent sets the full todo list state on each call. The UI renders a
 * collapsible widget above the message input showing current progress.
 *
 * No LLM calls are made — this is pure state management and event emission.
 */
export const todoListTool = tool(
  async (
    input: z.infer<typeof TodoListToolSchema>,
    config?: RunnableConfig,
  ): Promise<string> => {
    const emitter = config?.configurable?.emitter;

    if (!emitter) {
      console.warn('TodoListTool: No emitter available in config');
      return 'Todo list updated (no UI emitter available).';
    }

    const { todos } = input;

    // Enforce maximum of 10 items
    if (todos.length > 10) {
      return `Error: Task list exceeds maximum of 10 items (${todos.length} provided). Please reduce the list to 10 or fewer tasks and try again.`;
    }

    if (todos.length === 0) {
      return 'Error: Task list cannot be empty. Provide at least one task.';
    }

    // Emit todo_update event with structured data
    try {
      emitter.emit(
        'data',
        JSON.stringify({
          type: 'todo_update',
          data: {
            todos: todos.map((t) => ({
              content: t.content,
              status: t.status,
            })),
          },
        }),
      );
    } catch (err) {
      console.warn('TodoListTool: Failed to emit todo_update event', err);
    }

    // Build confirmation message for the agent
    const pending = todos.filter((t) => t.status === 'pending').length;
    const inProgress = todos.filter((t) => t.status === 'in_progress').length;
    const completed = todos.filter((t) => t.status === 'completed').length;

    return `Todo list updated: ${todos.length} items (${completed} completed, ${inProgress} in progress, ${pending} pending).`;
  },
  {
    name: 'todo_list',
    description:
      'Create or update a research plan todo list to track progress on complex, multi-part queries. Call with the complete list state — each call replaces the entire list. Use only for thorough research tasks requiring structured tracking.',
    schema: TodoListToolSchema,
  },
);
