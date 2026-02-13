import { SimplifiedAgentStateType } from '@/lib/state/chatAgentState';
import { ToolMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { tool } from '@langchain/core/tools';
import { Command, getCurrentTaskInput } from '@langchain/langgraph';
import { z } from 'zod';
import { SubagentExecutor } from '@/lib/search/subagents/executor';
import { getSubagentDefinition } from '@/lib/search/subagents/definitions';

// Schema for deep research tool input
const DeepResearchToolSchema = z.object({
  task: z
    .string()
    .describe(
      'A specific, focused research task to investigate in depth. Should describe exactly what to research and what kind of information to gather.',
    ),
});

/**
 * DeepResearchTool - Spawns a focused research subagent for comprehensive investigation
 *
 * This tool creates a SubagentExecutor that runs an independent SimplifiedAgent
 * instance with web research tools (web_search, url_summarization, image_search,
 * youtube_transcript, pdf_loader). The subagent does NOT have access to deep_research
 * itself, preventing recursion.
 *
 * Use this when the main agent discovers that a sub-problem requires significantly
 * more investigation than a single web search can provide.
 */
export const deepResearchTool = tool(
  async (
    input: z.infer<typeof DeepResearchToolSchema>,
    config?: RunnableConfig,
  ) => {
    try {
      const { task } = input;

      // Get current state for conversation history context
      const currentState = getCurrentTaskInput() as SimplifiedAgentStateType;

      // Extract infrastructure from config.configurable
      const chatLlm = config?.configurable?.llm;
      const systemLlm = config?.configurable?.systemLlm;
      const embeddings = config?.configurable?.embeddings;
      const emitter = config?.configurable?.emitter;
      const signal = config?.signal;
      const retrievalSignal = config?.configurable?.retrievalSignal;
      const messageId = config?.configurable?.messageId || 'unknown';
      const fileIds = config?.configurable?.fileIds || [];

      // Validate required config
      if (!chatLlm || !systemLlm || !embeddings || !emitter) {
        throw new Error(
          'Required configuration not available for deep_research',
        );
      }

      // Get the deep_research subagent definition
      const definition = getSubagentDefinition('deep_research');
      if (!definition) {
        throw new Error('deep_research subagent definition not found');
      }

      console.log(`DeepResearchTool: Spawning subagent for task: "${task}"`);

      // Create SubagentExecutor (reuses existing infrastructure)
      const executor = new SubagentExecutor(
        definition,
        chatLlm,
        systemLlm,
        embeddings,
        emitter, // parent emitter - executor creates isolated child
        signal!,
        messageId,
        retrievalSignal, // Pass retrievalSignal for cancellation support
      );

      // Execute subagent with conversation history
      // SubagentExecutor already slices to last 5 messages internally
      const execution = await executor.execute(
        task,
        currentState.messages,
        fileIds,
      );

      console.log(
        `DeepResearchTool: Subagent completed with status: ${execution.status}`,
      );

      // Return results via Command pattern
      // Documents flow back into main agent's relevantDocuments state
      // Summary goes into a ToolMessage so the agent can reason about findings
      return new Command({
        update: {
          relevantDocuments: execution.documents,
          messages: [
            new ToolMessage({
              content:
                execution.status === 'success'
                  ? `Deep research completed. Findings:\n\n${execution.summary}`
                  : `Deep research encountered an error: ${execution.error || 'Unknown error'}`,
              tool_call_id: (config as unknown as { toolCall: { id: string } })?.toolCall.id,
            }),
          ],
        },
      });
    } catch (error: unknown) {
      console.error('DeepResearchTool: Error:', error);

      return new Command({
        update: {
          relevantDocuments: [],
          messages: [
            new ToolMessage({
              content:
                'Error during deep research: ' +
                (error instanceof Error ? error.message : 'Unknown error'),
              tool_call_id: (config as unknown as { toolCall: { id: string } })?.toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: 'deep_research',
    description:
      'Spawns a focused research subagent to perform comprehensive, multi-source investigation on a specific aspect of the query. Use when a sub-problem requires deeper investigation than a single web search can provide. The subagent independently performs multiple searches, retrieves sources, and synthesizes findings.',
    schema: DeepResearchToolSchema,
  },
);
