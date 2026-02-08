/**
 * Supervisor Agent for Subagent Orchestration
 *
 * Determines when to use subagents and coordinates their parallel execution
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { EventEmitter } from 'events';
import { Document } from 'langchain/document';
import { SubagentExecutor } from './executor';
import {
  SUBAGENT_DEFINITIONS,
  getSubagentDefinition,
} from './definitions';
import { buildDecompositionPrompt } from '@/lib/prompts/subagents/decomposer';
import { CachedEmbeddings } from '@/lib/utils/cachedEmbeddings';
import { SimplifiedAgent } from '@/lib/search/simplifiedAgent';

/**
 * Subtask assignment from decomposition
 */
interface Subtask {
  subagent: string;
  task: string;
}

/**
 * Decomposition result from LLM
 */
interface DecompositionResult {
  needsDecomposition: boolean;
  reasoning: string;
  subtasks: Subtask[];
}

/**
 * Result from supervisor execution
 */
export interface SupervisorResult {
  answer: string;
  relevantDocuments: Document[];
  usedSubagents: boolean;
  subtasks?: Subtask[];
}

/**
 * Determine if query should be decomposed and execute subagents if needed
 */
export async function executeWithSubagents(
  query: string,
  history: BaseMessage[],
  chatLlm: BaseChatModel,
  systemLlm: BaseChatModel,
  embeddings: CachedEmbeddings,
  emitter: EventEmitter,
  signal: AbortSignal,
  messageId: string,
  fileIds: string[],
  focusMode: string,
  personaInstructions: string = '',
  retrievalSignal?: AbortSignal,
  userLocation?: string,
  userProfile?: string,
): Promise<SupervisorResult> {
  console.log('Supervisor: Analyzing query for subagent decomposition');

  try {
    // Step 1: Determine if query needs decomposition
    const decomposition = await analyzeForDecomposition(
      query,
      fileIds.length > 0,
      systemLlm,
    );

    console.log('Supervisor: Decomposition analysis:', decomposition);

    // Step 2: If no decomposition needed, fall back to standard SimplifiedAgent
    if (!decomposition.needsDecomposition || decomposition.subtasks.length === 0) {
      console.log('Supervisor: No decomposition needed, using standard agent');

      return executeStandardAgent(
        query,
        history,
        chatLlm,
        systemLlm,
        embeddings,
        emitter,
        signal,
        messageId,
        fileIds,
        focusMode,
        personaInstructions,
        retrievalSignal,
        userLocation,
        userProfile,
      );
    }

    // Step 3: Execute subagents in parallel
    console.log(
      `Supervisor: Executing ${decomposition.subtasks.length} subagents in parallel`,
    );

    const subagentExecutions = await Promise.all(
      decomposition.subtasks.map(async (subtask) => {
        const definition = getSubagentDefinition(subtask.subagent);

        if (!definition) {
          console.warn(
            `Supervisor: Unknown subagent "${subtask.subagent}", skipping`,
          );
          return null;
        }

        const executor = new SubagentExecutor(
          definition,
          chatLlm,
          systemLlm,
          embeddings,
          emitter,
          signal,
          messageId,
        );

        return executor.execute(subtask.task, history, fileIds);
      }),
    );

    // Filter out null executions
    const validExecutions = subagentExecutions.filter((e) => e !== null);

    console.log(
      `Supervisor: ${validExecutions.length} subagents completed successfully`,
    );

    // Step 4: Aggregate results
    const allDocuments = validExecutions.flatMap((e) => e!.documents);
    const subagentSummaries = validExecutions
      .map(
        (e) =>
          `## ${e!.name}\n**Task**: ${e!.task}\n\n${e!.summary}\n`,
      )
      .join('\n');

    // Step 5: Synthesize final response using chat model
    console.log('Supervisor: Synthesizing final response from subagent results');

    const synthesisPrompt = buildSynthesisPrompt(
      query,
      decomposition.subtasks,
      validExecutions.map((e) => e!),
    );

    // Emit synthesis start
    emitter.emit(
      'data',
      JSON.stringify({
        type: 'synthesis_started',
        subtaskCount: validExecutions.length,
      }),
    );

    // Stream the synthesis response
    let synthesizedAnswer = '';

    const stream = await chatLlm.stream([
      new SystemMessage(synthesisPrompt),
      ...history,
      new HumanMessage(query),
    ]);

    for await (const chunk of stream) {
      const content = chunk.content?.toString() || '';
      synthesizedAnswer += content;

      // Stream to user
      emitter.emit(
        'data',
        JSON.stringify({
          type: 'response',
          data: content,
        }),
      );
    }

    console.log('Supervisor: Synthesis complete');

    // Emit end event to signal completion
    emitter.emit('end');

    return {
      answer: synthesizedAnswer,
      relevantDocuments: allDocuments,
      usedSubagents: true,
      subtasks: decomposition.subtasks,
    };
  } catch (error) {
    console.error('Supervisor: Error during subagent execution:', error);

    // Fall back to standard agent on error
    console.log('Supervisor: Falling back to standard agent due to error');

    return executeStandardAgent(
      query,
      history,
      chatLlm,
      systemLlm,
      embeddings,
      emitter,
      signal,
      messageId,
      fileIds,
      focusMode,
      personaInstructions,
      retrievalSignal,
      userLocation,
      userProfile,
    );
  }
}

/**
 * Analyze query to determine if it should be decomposed
 */
async function analyzeForDecomposition(
  query: string,
  hasFiles: boolean,
  systemLlm: BaseChatModel,
): Promise<DecompositionResult> {
  const prompt = buildDecompositionPrompt(query, hasFiles);

  try {
    const response = await systemLlm.invoke([new HumanMessage(prompt)]);

    const content = response.content?.toString() || '{}';

    // Strip markdown code blocks if present
    const jsonContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(jsonContent);

    return {
      needsDecomposition:
        parsed.needsDecomposition === true && parsed.subtasks?.length > 0,
      reasoning: parsed.reasoning || '',
      subtasks: parsed.subtasks || [],
    };
  } catch (error) {
    console.error('Supervisor: Error analyzing decomposition:', error);

    // Default to no decomposition on error
    return {
      needsDecomposition: false,
      reasoning: 'Error during analysis',
      subtasks: [],
    };
  }
}

/**
 * Execute standard SimplifiedAgent (fallback)
 */
async function executeStandardAgent(
  query: string,
  history: BaseMessage[],
  chatLlm: BaseChatModel,
  systemLlm: BaseChatModel,
  embeddings: CachedEmbeddings,
  emitter: EventEmitter,
  signal: AbortSignal,
  messageId: string,
  fileIds: string[],
  focusMode: string,
  personaInstructions: string,
  retrievalSignal?: AbortSignal,
  userLocation?: string,
  userProfile?: string,
): Promise<SupervisorResult> {
  const agent = new SimplifiedAgent(
    chatLlm,
    systemLlm,
    embeddings,
    emitter,
    personaInstructions,
    signal,
    messageId,
    retrievalSignal,
    userLocation,
    userProfile,
  );

  await agent.searchAndAnswer(query, history, fileIds, focusMode);

  // SimplifiedAgent streams via emitter, we don't capture return value
  return {
    answer: '', // Already streamed
    relevantDocuments: [], // Already included in stream
    usedSubagents: false,
  };
}

/**
 * Build synthesis prompt from subagent results
 */
function buildSynthesisPrompt(
  originalQuery: string,
  subtasks: Subtask[],
  executions: any[],
): string {
  const subagentSummaries = executions
    .map((exec, i) => {
      const subtask = subtasks[i];
      return `### Subagent ${i + 1}: ${exec.name}
**Assigned Task**: ${subtask.task}

**Findings**:
${exec.summary}

**Documents Found**: ${exec.documents.length}
`;
    })
    .join('\n\n');

  return `# Content Synthesis Specialist

You are synthesizing research from multiple specialized subagents into a comprehensive answer.

## Original User Query
"${originalQuery}"

## Subagent Results
${subagentSummaries}

## Your Task
Provide a comprehensive, well-structured answer that:
1. Directly addresses the user's original query
2. Integrates findings from all subagents
3. Maintains proper citations from the documents found
4. Resolves any contradictions between subagent findings
5. Presents information in a clear, organized manner

**Important**: Do not mention subagents or the synthesis process in your response. Present the information naturally as if you researched it yourself.

Begin your synthesis now:`;
}
