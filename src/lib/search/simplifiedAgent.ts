import { buildChatPrompt } from '@/lib/prompts/simplifiedAgent/chat';
import { buildFirefoxAIPrompt } from '@/lib/prompts/simplifiedAgent/firefoxAI';
import { buildLocalResearchPrompt } from '@/lib/prompts/simplifiedAgent/localResearch';
import { buildWebSearchPrompt } from '@/lib/prompts/simplifiedAgent/webSearch';
import { formattingAndCitationsWeb } from '@/lib/prompts/templates';
import { SimplifiedAgentState } from '@/lib/state/chatAgentState';
import {
  allAgentTools,
  coreTools,
  fileSearchTools,
  webSearchTools,
} from '@/lib/tools/agents';
// import {
//   getLangfuseCallbacks,
//   getLangfuseHandler,
// } from '@/lib/tracing/langfuse';
import { encodeHtmlAttribute } from '@/lib/utils/html';
import { isSoftStop } from '@/lib/utils/runControl';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { buildMultimodalHumanMessage } from '@/lib/utils/images';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableConfig, RunnableSequence } from '@langchain/core/runnables';
import { createAgent } from 'langchain';
import { EventEmitter } from 'events';
import { Document } from '@langchain/core/documents';
import { webSearchResponsePrompt } from '../prompts/webSearch';
import { formatDateForLLM } from '../utils';
import { removeThinkingBlocksFromMessages } from '../utils/contentUtils';
import { getModelName } from '../utils/modelUtils';
import { CachedEmbeddings } from '../utils/cachedEmbeddings';
import { buildPersonalizationSection } from '../utils/personalization';

/**
 * Normalize usage metadata from different LLM providers
 */
function normalizeUsageMetadata(usageData: Record<string, number>): {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
} {
  if (!usageData) return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

  // Handle different provider formats
  const inputTokens =
    usageData.input_tokens ||
    usageData.prompt_tokens ||
    usageData.promptTokens ||
    usageData.usedTokens ||
    0;

  const outputTokens =
    usageData.output_tokens ||
    usageData.completion_tokens ||
    usageData.completionTokens ||
    0;

  const totalTokens =
    usageData.total_tokens ||
    usageData.totalTokens ||
    usageData.usedTokens ||
    inputTokens + outputTokens;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  };
}

/**
 * Extract text content from LLM message content (handles both string and array formats)
 * OpenAI returns string, Anthropic returns array of content blocks.
 * Thinking/reasoning blocks are wrapped in <think> tags so the frontend ThinkBox renders them.
 */
function extractTextContent(
  content:
    | string
    | Array<{
        type?: string;
        text?: string;
        thinking?: string;
        reasoning?: string;
      }>
    | null
    | undefined,
): string {
  if (!content) return '';

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    let text = '';
    for (const block of content) {
      if (typeof block !== 'object' || block === null) continue;

      if (
        (block.type === 'text' || block.type === 'text_delta') &&
        block.text
      ) {
        // Regular text output
        text += block.text;
      } else if (
        (block.type === 'thinking' || block.type === 'thinking_delta') &&
        block.thinking
      ) {
        // Anthropic extended thinking blocks — wrap so ThinkBox renders them
        text += `<think>${block.thinking}</think>`;
      } else if (block.type === 'reasoning' && block.reasoning) {
        // LangChain normalized reasoning block — wrap so ThinkBox renders them
        text += `<think>${block.reasoning}</think>`;
      }
    }
    return text;
  }

  return '';
}

/**
 * SimplifiedAgent class that provides a streamlined interface for creating and managing an AI agent
 * with customizable focus modes and tools.
 */
export class SimplifiedAgent {
  private chatLlm: BaseChatModel;
  private systemLlm: BaseChatModel;
  private embeddings: CachedEmbeddings;
  private emitter: EventEmitter;
  private personaInstructions: string;
  private signal: AbortSignal;
  private currentToolNames: string[] = [];
  private messageId?: string;
  private retrievalSignal?: AbortSignal;
  private userLocation?: string;
  private userProfile?: string;

  constructor(
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: CachedEmbeddings,
    emitter: EventEmitter,
    personaInstructions: string = '',
    signal: AbortSignal,
    messageId?: string,
    retrievalSignal?: AbortSignal,
    userLocation?: string,
    userProfile?: string,
  ) {
    this.chatLlm = chatLlm;
    this.systemLlm = systemLlm;
    this.embeddings = embeddings;
    this.emitter = emitter;
    this.personaInstructions = personaInstructions;
    this.signal = signal;
    this.messageId = messageId;
    this.retrievalSignal = retrievalSignal;
    this.userLocation = userLocation;
    this.userProfile = userProfile;
  }

  private emitResponse(text: string) {
    this.emitter.emit('data', JSON.stringify({ type: 'response', data: text }));
  }

  /**
   * Emit model usage statistics to the client
   */
  private emitModelStats(
    usageChat: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    },
    usageSystem: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    },
  ) {
    this.emitter.emit(
      'stats',
      JSON.stringify({
        type: 'modelStats',
        data: {
          modelName: getModelName(this.chatLlm),
          modelNameChat: getModelName(this.chatLlm),
          modelNameSystem: getModelName(this.systemLlm),
          usage: {
            input_tokens: usageChat.input_tokens + usageSystem.input_tokens,
            output_tokens: usageChat.output_tokens + usageSystem.output_tokens,
            total_tokens: usageChat.total_tokens + usageSystem.total_tokens,
          },
          usageChat,
          usageSystem,
        },
      }),
    );
  }

  /**
   * Initialize the createAgent with tools and configuration
   */
  private initializeAgent(
    focusMode: string,
    fileIds: string[] = [],
    messagesCount?: number,
    query?: string,
    firefoxAIDetected?: boolean,
    customTools?: typeof allAgentTools,
    customSystemPrompt?: string,
  ) {
    // Select appropriate tools based on focus mode and available files
    // Special case: Firefox AI detection disables tools for this turn
    // Special case: custom tools override (for subagents)
    const tools = customTools
      ? customTools
      : firefoxAIDetected
        ? []
        : this.getToolsForFocusMode(focusMode, fileIds);

    // Cache tool names for usage attribution heuristics
    this.currentToolNames = tools.map((t) => t.name.toLowerCase());

    const enhancedSystemPrompt = customSystemPrompt
      ? customSystemPrompt
      : this.createEnhancedSystemPrompt(
          focusMode,
          fileIds,
          messagesCount,
          query,
          firefoxAIDetected,
        );

    try {
      // Create the React agent with custom state
      const agent = createAgent({
        model: this.chatLlm,
        tools,
        stateSchema: SimplifiedAgentState,
        systemPrompt: enhancedSystemPrompt,
      });

      console.log(
        `SimplifiedAgent: Initialized with ${tools.length} tools for focus mode: ${focusMode}`,
      );
      if (firefoxAIDetected) {
        console.log(
          'SimplifiedAgent: Firefox AI prompt detected, tools will be disabled for this turn.',
        );
      }
      console.log(
        `SimplifiedAgent: Tools available: ${tools.map((tool) => tool.name).join(', ')}`,
      );
      if (fileIds.length > 0) {
        console.log(
          `SimplifiedAgent: ${fileIds.length} files available for search`,
        );
      }

      return agent;
    } catch (error) {
      console.error('SimplifiedAgent: Error initializing agent:', error);
      throw error;
    }
  }

  /**
   * Get tools based on focus mode
   */
  private getToolsForFocusMode(focusMode: string, fileIds: string[] = []) {
    switch (focusMode) {
      case 'chat':
        // Chat mode: Only core tools for conversational interaction
        return coreTools;
      case 'webSearch':
        // Web search mode: ALL available tools for comprehensive research
        // Include file search tools if files are available
        if (fileIds.length > 0) {
          return [...webSearchTools, ...fileSearchTools];
        }
        return allAgentTools;
      case 'localResearch':
        // Local research mode: File search tools + core tools
        return [...coreTools, ...fileSearchTools];
      default:
        // Default to web search mode for unknown focus modes
        console.warn(
          `SimplifiedAgent: Unknown focus mode "${focusMode}", defaulting to webSearch tools`,
        );
        if (fileIds.length > 0) {
          return [...webSearchTools, ...fileSearchTools];
        }
        return allAgentTools;
    }
  }

  private createEnhancedSystemPrompt(
    focusMode: string,
    fileIds: string[] = [],
    messagesCount?: number,
    query?: string,
    firefoxAIDetected?: boolean,
  ): string {
    const personaInstructions = this.personaInstructions || '';
    const personalizationSection = buildPersonalizationSection({
      location: this.userLocation,
      profile: this.userProfile,
    });

    if (firefoxAIDetected) {
      return buildFirefoxAIPrompt(
        personaInstructions,
        personalizationSection,
        new Date(),
      );
    }

    // Create focus-mode-specific prompts
    switch (focusMode) {
      case 'chat':
        return buildChatPrompt(
          personaInstructions,
          personalizationSection,
          new Date(),
        );
      case 'webSearch':
        return buildWebSearchPrompt(
          personaInstructions,
          personalizationSection,
          fileIds,
          messagesCount ?? 0,
          query,
          new Date(),
        );
      case 'localResearch':
        return buildLocalResearchPrompt(
          personaInstructions,
          personalizationSection,
          new Date(),
        );
      default:
        console.warn(
          `SimplifiedAgent: Unknown focus mode "${focusMode}", using webSearch prompt`,
        );
        return buildWebSearchPrompt(
          personaInstructions,
          personalizationSection,
          fileIds,
          messagesCount ?? 0,
          query,
          new Date(),
        );
    }
  }

  /**
   * Execute the simplified agent workflow
   */
  async searchAndAnswer(
    query: string,
    history: BaseMessage[] = [],
    fileIds: string[] = [],
    focusMode: string = 'webSearch',
    customTools?: typeof allAgentTools,
    customSystemPrompt?: string,
    messageImageIds?: string[],
  ): Promise<void> {
    // Declared outside try so the catch block can clean it up
    let toolLlmUsageHandler: ((data: string) => void) | null = null;

    try {
      console.log(`SimplifiedAgent: Starting search for query: "${query}"`);
      console.log(`SimplifiedAgent: Focus mode: ${focusMode}`);
      console.log(`SimplifiedAgent: File IDs: ${fileIds.join(', ')}`);

      // Write this on a background thread after a delay otherwise the emitter won't be listening
      setTimeout(() => {
        this.emitResponse(''); // Empty response, to give the UI a message to display.
      }, 100);

      const humanMsg =
        messageImageIds && messageImageIds.length > 0
          ? buildMultimodalHumanMessage(query, messageImageIds)
          : new HumanMessage(query);

      const messagesHistory = [
        ...removeThinkingBlocksFromMessages(history),
        humanMsg,
      ];
      // Detect Firefox AI prompt pattern
      const trimmed = query.trim();
      const startsWithAscii = trimmed.startsWith("I'm on page");
      const startsWithCurly = trimmed.startsWith('I’' + 'm on page'); // handle curly apostrophe variant
      const containsSelection = trimmed.includes('<selection>');
      const firefoxAIDetected =
        (startsWithAscii || startsWithCurly) && containsSelection;
      const toolCalls: Record<string, string> = {};

      // Run-ID attribution sets (see AGENTS.md — Run-ID Attribution section)
      // LangChain's AsyncLocalStorage propagates the parent's callback context into child
      // tool executions, so child SimplifiedAgent LLM events also appear in this stream.
      // These sets let us distinguish the parent agent's own events from nested child events.

      // run_id of each active deep_research tool invocation in the parent graph's tools node
      const deepResearchRunIds = new Set<string>();
      // run_id of each 'tools' node chain start that belongs to the parent graph (not a child)
      const parentToolsNodeRunIds = new Set<string>();
      // run_id of each LLM call that belongs to THIS parent agent's 'model_request' node
      const activeAgentLlmRunIds = new Set<string>();

      // Initialize agent with the provided focus mode and file context
      // Pass the number of messages that will be sent to the LLM so prompts can adapt.
      const llmMessagesCount = messagesHistory.length;
      const agent = this.initializeAgent(
        focusMode,
        fileIds,
        llmMessagesCount,
        query,
        firefoxAIDetected,
        customTools,
        customSystemPrompt,
      );

      // Prepare initial state
      const initialState = {
        messages: messagesHistory,
        query,
        focusMode,
        fileIds,
        relevantDocuments: [],
        subagentExecutions: [],
      };

      // Configure the agent run
      const config: RunnableConfig = {
        configurable: {
          thread_id: `simplified_agent_${Date.now()}`,
          llm: this.chatLlm,
          systemLlm: this.systemLlm,
          embeddings: this.embeddings,
          fileIds,
          personaInstructions: this.personaInstructions,
          focusMode,
          emitter: this.emitter,
          firefoxAIDetected,
          // Pass through message and retrieval controls for tools
          messageId: this.messageId,
          retrievalSignal: this.retrievalSignal,
          userLocation: this.userLocation,
          userProfile: this.userProfile,
        },
        recursionLimit: 150, // Increased to handle complex multi-task research with todo_list
        signal: this.retrievalSignal,
        // ...getLangfuseCallbacks(),
      };

      // Use streamEvents to capture both tool calls and token-level streaming
      const eventStream = agent.streamEvents(initialState, {
        ...config,
        version: 'v2',
        callbacks: [
          {
            handleToolStart: (
              tool,
              input,
              runId,
              parentRunId?,
              tags?,
              metadata?,
              runName?,
            ) => {
              console.log('SimplifiedAgent: Tool started:', {
                tool,
                input,
                runId,
                parentRunId,
                tags,
                metadata,
                runName,
              });
              const toolName = runName || tool.name || 'unknown';
              toolCalls[runId] = toolName;

              // Skip generic tool events for deep_research and todo_list (have specialized rendering)
              if (toolName === 'deep_research' || toolName === 'todo_list') {
                return;
              }

              // Skip tool calls from child SimplifiedAgent graphs.
              // parentRunId is the run_id of the invoking 'tools' node; if it isn't in
              // parentToolsNodeRunIds it belongs to a nested child graph, not this agent.
              if (parentRunId && !parentToolsNodeRunIds.has(parentRunId)) {
                delete toolCalls[runId];
                return;
              }

              // Emit a tool_call_started event so UI can display a running state spinner.
              try {
                const type = toolName.trim();
                // We only include lightweight identifying args for now; avoid large payloads.
                let extraAttr = '';
                try {
                  if (input && typeof input === 'string') {
                    // Construct an object from the input json string if possible
                    const trimmed = input.trim();
                    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                      try {
                        input = JSON.parse(trimmed);
                      } catch {
                        // If parsing fails, fall back to original string
                        input = trimmed;
                      }
                    }
                  }
                  if (input && typeof input === 'object') {
                    const inputObj = input as Record<string, unknown>;
                    if (typeof inputObj.query === 'string') {
                      // Encode query as attribute (basic escaping)
                      const q = encodeHtmlAttribute(
                        inputObj.query.slice(0, 200),
                      );
                      extraAttr += ` query="${q}"`;
                    }
                    if (Array.isArray(inputObj.urls)) {
                      const count = inputObj.urls.length;
                      extraAttr += ` count="${count}"`;
                    }
                    if (typeof inputObj.url === 'string') {
                      const u = encodeHtmlAttribute(inputObj.url.slice(0, 300));
                      extraAttr += ` url="${u}"`;
                    }
                    if (typeof inputObj.pdfUrl === 'string') {
                      const u = encodeHtmlAttribute(
                        inputObj.pdfUrl.slice(0, 300),
                      );
                      extraAttr += ` url="${u}"`;
                    }
                  }
                } catch (_attrErr) {
                  // Ignore attribute extraction errors
                }

                this.emitter.emit(
                  'data',
                  JSON.stringify({
                    type: 'tool_call_started',
                    data: {
                      // Provide initial markup with status running; toolCallId used for later update.
                      content: `<ToolCall type="${encodeHtmlAttribute(type)}" status="running" toolCallId="${encodeHtmlAttribute(runId)}"${extraAttr}></ToolCall>`,
                      toolCallId: runId,
                      status: 'running',
                    },
                  }),
                );
              } catch (emitErr) {
                console.warn('Failed to emit tool_call_started event', emitErr);
              }
            },
            handleToolEnd: (output, runId, parentRunId, tags) => {
              console.log('SimplifiedAgent: Tool completed:', {
                output,
                runId,
                parentRunId,
                tags,
              });

              const toolName = toolCalls[runId];

              // Skip if the tool was never registered (e.g. filtered out as a child-graph call)
              if (!toolName) return;

              // Skip generic tool events for deep_research and todo_list (have specialized rendering)
              if (toolName === 'deep_research' || toolName === 'todo_list') {
                delete toolCalls[runId];
                return;
              }

              // If youtube transcript tool, capture videoId for potential future UI enhancements
              let extra: Record<string, string> | undefined;
              if (toolName === 'youtube_transcript') {
                const videoId =
                  output?.update?.relevantDocuments?.[0]?.metadata?.source;
                if (videoId) {
                  extra = { videoId: String(videoId) };
                }
              }
              if (toolCalls[runId]) delete toolCalls[runId];

              // Emit success update so UI can swap spinner for checkmark
              try {
                this.emitter.emit(
                  'data',
                  JSON.stringify({
                    type: 'tool_call_success',
                    data: {
                      toolCallId: runId,
                      status: 'success',
                      ...(extra ? { extra } : {}),
                    },
                  }),
                );
              } catch (emitErr) {
                console.warn('Failed to emit tool_call_success event', emitErr);
              }
            },
            handleToolError: (err, runId, parentRunId, tags) => {
              console.error('SimplifiedAgent: Tool error:', {
                error: err,
                runId,
                parentRunId,
                tags,
              });

              const toolName = toolCalls[runId];

              // Skip if the tool was never registered (e.g. filtered out as a child-graph call)
              if (!toolName) return;

              // Skip generic tool events for deep_research and todo_list (have specialized rendering)
              if (toolName === 'deep_research' || toolName === 'todo_list') {
                delete toolCalls[runId];
                return;
              }

              const message =
                (err && (err.message || err.toString())) ||
                'Unknown tool error';
              // Emit error update to UI
              try {
                this.emitter.emit(
                  'data',
                  JSON.stringify({
                    type: 'tool_call_error',
                    data: {
                      toolCallId: runId,
                      status: 'error',
                      error: message.substring(0, 500),
                    },
                  }),
                );
              } catch (emitErr) {
                console.warn('Failed to emit tool_call_error event', emitErr);
              }
            },
          },
          // getLangfuseHandler() || {},
        ],
      });

      let finalResult: {
        messages?: BaseMessage[];
        relevantDocuments?: Document[];
      } | null = null;
      const collectedDocuments: Document[] = [];
      let currentResponseBuffer = '';
      // Separate usage trackers for chat (final answer) and system (tools/internal chains)
      const usageChat = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      const usageSystem = {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };

      let initialMessageSent = false;

      // Listen for token usage emitted by tools (url_summarization, deep_research)
      // that make their own LLM calls outside the agent's streamEvents chain.
      toolLlmUsageHandler = (data: string) => {
        try {
          const usage = JSON.parse(data);
          // Route to the correct accumulator based on which model was used
          const accumulator = usage.target === 'chat' ? usageChat : usageSystem;
          accumulator.input_tokens += usage.input_tokens || 0;
          accumulator.output_tokens += usage.output_tokens || 0;
          accumulator.total_tokens += usage.total_tokens || 0;
          // Emit updated stats to client
          this.emitModelStats(usageChat, usageSystem);
        } catch (error) {
          console.error(
            'SimplifiedAgent: Error processing tool_llm_usage:',
            error,
          );
        }
      };
      this.emitter.on('tool_llm_usage', toolLlmUsageHandler);

      try {
        // Process the event stream
        for await (const event of eventStream) {
          // Check if the operation has been aborted (e.g., client disconnected)
          if (this.signal.aborted) {
            console.log(
              'SimplifiedAgent: Abort signal received, stopping event processing',
            );
            break;
          }

          if (!initialMessageSent) {
            initialMessageSent = true;
            // If Firefox AI was detected, emit synthetic lifecycle events so UI can show a completed pseudo-tool
            if (firefoxAIDetected) {
              const syntheticId = `firefoxAI-${Date.now()}`;
              try {
                // Emit single started event already marked success to avoid double UI churn
                this.emitter.emit(
                  'data',
                  JSON.stringify({
                    type: 'tool_call_started',
                    data: {
                      content: `<ToolCall type="firefoxAI" status="success" toolCallId="${syntheticId}"></ToolCall>`,
                      toolCallId: syntheticId,
                      status: 'success',
                    },
                  }),
                );
              } catch (e) {
                console.warn(
                  'Failed to emit firefoxAI synthetic tool event',
                  e,
                );
              }
            }
          }

          const emitNewDocs = (newDocs: Document[]) => {
            //Group by metadata.searchQuery and emit separate source blocks for each
            const groupedBySearchQuery = newDocs.reduce(
              (acc, doc) => {
                const searchQuery = doc.metadata?.searchQuery || 'Agent Search';
                if (!acc[searchQuery]) {
                  acc[searchQuery] = [];
                }
                acc[searchQuery].push(doc);
                return acc;
              },
              {} as Record<string, Document[]>,
            );

            for (const [searchQuery, docs] of Object.entries(
              groupedBySearchQuery,
            )) {
              this.emitter.emit(
                'data',
                JSON.stringify({
                  type: 'sources_added',
                  data: docs,
                  searchQuery,
                  searchUrl: '',
                }),
              );
            }
          };

          // --- Run-ID attribution tracking (Steps 2-4) ---
          // Step 2: Track deep_research tool execution run IDs.
          // Any on_chat_model_start / on_chain_start with a parent_id in this set
          // belongs to a child SimplifiedAgent, not the parent graph.
          if (
            event.event === 'on_tool_start' &&
            event.name === 'deep_research'
          ) {
            deepResearchRunIds.add(event.run_id);
          }
          if (
            (event.event === 'on_tool_end' ||
              event.event === 'on_tool_error') &&
            event.name === 'deep_research'
          ) {
            deepResearchRunIds.delete(event.run_id);
          }

          // Step 3: Track parent-graph 'tools' node run IDs.
          // handleToolStart callbacks receive parentRunId; we compare it against this set
          // to skip tool call lifecycle events that come from child agent tool executions.
          if (
            event.event === 'on_chain_start' &&
            event.metadata?.langgraph_node === 'tools' &&
            !(event as unknown as { parent_ids?: string[] }).parent_ids?.some(
              (id: string) => deepResearchRunIds.has(id),
            )
          ) {
            parentToolsNodeRunIds.add(event.run_id);
          }
          if (
            (event.event === 'on_chain_end' ||
              event.event === 'on_chain_error') &&
            event.metadata?.langgraph_node === 'tools'
          ) {
            parentToolsNodeRunIds.delete(event.run_id);
          }

          // Step 4: Register parent-agent LLM run IDs.
          // Drain happens later in the on_chat_model_end handler (after token counting)
          // to avoid a use-after-delete race on the same event.
          if (
            event.event === 'on_chat_model_start' &&
            event.metadata?.langgraph_node === 'model_request' &&
            !(event as unknown as { parent_ids?: string[] }).parent_ids?.some(
              (id: string) => deepResearchRunIds.has(id),
            )
          ) {
            activeAgentLlmRunIds.add(event.run_id);
          }

          // --- End attribution tracking ---

          // Handle different event types
          if (
            event.event === 'on_chain_end' &&
            event.name === 'RunnableSequence'
          ) {
            finalResult = event.data.output;
            // Collect relevant documents from the final result
            if (finalResult && finalResult.relevantDocuments) {
              collectedDocuments.push(...finalResult.relevantDocuments);
              emitNewDocs(finalResult.relevantDocuments);
            }
          }

          // Collect sources from tool results
          if (
            event.event === 'on_chain_end' &&
            (event.name.includes('search') ||
              event.name.includes('Search') ||
              event.name.includes('tool') ||
              event.name.includes('Tool'))
          ) {
            // Handle LangGraph state updates with relevantDocuments
            if (event.data?.output && Array.isArray(event.data.output)) {
              for (const item of event.data.output) {
                if (
                  item.update &&
                  item.update.relevantDocuments &&
                  Array.isArray(item.update.relevantDocuments)
                ) {
                  collectedDocuments.push(...item.update.relevantDocuments);
                  emitNewDocs(item.update.relevantDocuments);

                  // Log for deep_research to verify sources are being emitted
                  if (event.name === 'deep_research') {
                    console.log(
                      `SimplifiedAgent: deep_research returned ${item.update.relevantDocuments.length} documents`,
                    );
                  }
                }
              }
            }
          }

          // Handle streaming tool calls (for thought messages)
          // Only count events from the 'model_request' node (createAgent's LLM node).
          // In LangChain/LangGraph v1.x, AsyncLocalStorage propagates parent callbacks into
          // tool executions, so system model llm.invoke() calls inside tools also fire
          // on_chat_model_end in this stream. Those events have langgraph_node === 'tools'
          // and must be excluded — their tokens are reported via tool_llm_usage instead.
          // Additionally guard by activeAgentLlmRunIds to exclude child SimplifiedAgent
          // LLM calls (which also have langgraph_node === 'model_request' from the child's graph).
          if (
            event.event === 'on_chat_model_end' &&
            event.data.output &&
            event.metadata?.langgraph_node === 'model_request' &&
            activeAgentLlmRunIds.has(event.run_id)
          ) {
            const output = event.data.output;

            if (output.usage_metadata) {
              const normalized = normalizeUsageMetadata(output.usage_metadata);
              usageChat.input_tokens += normalized.input_tokens;
              usageChat.output_tokens += normalized.output_tokens;
              usageChat.total_tokens += normalized.total_tokens;
              console.log(
                'SimplifiedAgent: Collected usage from usage_metadata:',
                normalized,
              );
              // Emit live snapshot
              this.emitModelStats(usageChat, usageSystem);
            } else if (output.response_metadata?.usage) {
              // Fallback to response_metadata for different model providers
              const normalized = normalizeUsageMetadata(
                output.response_metadata.usage,
              );
              usageChat.input_tokens += normalized.input_tokens;
              usageChat.output_tokens += normalized.output_tokens;
              usageChat.total_tokens += normalized.total_tokens;
              console.log(
                'SimplifiedAgent: Collected usage from response_metadata:',
                normalized,
              );
              this.emitModelStats(usageChat, usageSystem);
            }
          }
          // Drain activeAgentLlmRunIds AFTER the token-counting check above so the
          // has() test doesn't evaluate against an already-deleted entry.
          if (event.event === 'on_chat_model_end') {
            activeAgentLlmRunIds.delete(event.run_id);
          }

          // Handle LLM end events for token usage tracking (completion models only; same
          // node filter as on_chat_model_end to exclude tool-level system LLM calls).
          // Also guarded by activeAgentLlmRunIds for the same child-agent reason above.
          if (
            event.event === 'on_llm_end' &&
            event.data.output &&
            event.metadata?.langgraph_node === 'model_request' &&
            activeAgentLlmRunIds.has(event.run_id)
          ) {
            const output = event.data.output;

            // Only count tokens from the agent node. System model calls inside tools
            // report via tool_llm_usage and have langgraph_node === 'tools'.
            if (output.llmOutput?.tokenUsage) {
              const normalized = normalizeUsageMetadata(
                output.llmOutput.tokenUsage,
              );
              usageChat.input_tokens += normalized.input_tokens;
              usageChat.output_tokens += normalized.output_tokens;
              usageChat.total_tokens += normalized.total_tokens;
              console.log(
                'SimplifiedAgent: Collected usage from llmOutput:',
                normalized,
              );
              this.emitModelStats(usageChat, usageSystem);
            }
          }

          // Handle token-level streaming for the final response.
          // Guard by activeAgentLlmRunIds so that tokens from child SimplifiedAgent
          // instances (spawned by deep_research) — which bubble up via AsyncLocalStorage
          // callback propagation — are not emitted as parent response tokens.
          if (
            event.event === 'on_chat_model_stream' &&
            event.data.chunk &&
            activeAgentLlmRunIds.has(event.run_id)
          ) {
            const chunk = event.data.chunk;
            const textContent = extractTextContent(chunk.content);

            if (textContent) {
              currentResponseBuffer += textContent;
              this.emitResponse(textContent);
            }
          }
        }
      } catch (err: unknown) {
        if (
          this.retrievalSignal &&
          this.retrievalSignal.aborted &&
          isSoftStop(this.messageId || '')
        ) {
          // If respond-now was triggered, run a quick synthesis from collected context before finalization

          const docsString = collectedDocuments
            .map((doc, idx: number) => {
              const meta = doc?.metadata || {};
              const title = meta.title || meta.url || `Source ${idx + 1}`;
              const url = meta.url || '';
              const snippet = doc?.pageContent || '';
              return `<${idx + 1}>
<title>${title}</title>
${url ? `<url>${url}</url>` : ''}
<content>\n${snippet}\n</content>
</${idx + 1}>`;
            })
            .join('\n\n');

          // Build the respond-now prompt based on whether a custom system prompt is active.
          // When customSystemPrompt is provided (e.g. deep research subagent), use it
          // instead of the default webSearchResponsePrompt to stay consistent with
          // the agent's original role.
          let respondNowPrompt: ChatPromptTemplate;
          if (customSystemPrompt) {
            const synthesisSystemPrompt = `${customSystemPrompt}\n\n## Early Synthesis\nYou were interrupted before completing your full research. Synthesize a response from the documents gathered so far.\n\n<context>\n${docsString || 'No context documents available.'}\n</context>\n\nCurrent date: ${formatDateForLLM(new Date())}`;
            respondNowPrompt = ChatPromptTemplate.fromMessages([
              ['system', synthesisSystemPrompt],
              ['user', query],
            ]);
          } else {
            respondNowPrompt = await ChatPromptTemplate.fromMessages([
              ['system', webSearchResponsePrompt],
              ['user', query],
            ]).partial({
              formattingAndCitations: this.personaInstructions
                ? this.personaInstructions
                : formattingAndCitationsWeb.content,
              personalizationDirectives: buildPersonalizationSection({
                location: this.userLocation,
                profile: this.userProfile,
              }),
              context: docsString || 'No context documents available.',
              date: formatDateForLLM(new Date()),
            });
          }

          const chain = RunnableSequence.from([
            respondNowPrompt,
            this.chatLlm,
          ]).withConfig({
            runName: 'SimplifiedRespondNowSynthesis',
            // ...getLangfuseCallbacks(),
            signal: this.signal,
          });

          const eventStream2 = chain.streamEvents(
            { query },
            { version: 'v2' /* ...getLangfuseCallbacks() */ },
          );

          this.emitResponse(
            `## ⚠︎ Early response triggered by budget or user request. ⚠︎\nResponse may be incomplete, lack citations, or omit important content.\n\n---\n\n`,
          );

          for await (const event of eventStream2) {
            if (this.signal.aborted) break;
            if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
              const chunk = event.data.chunk;
              const textContent = extractTextContent(chunk.content);

              if (textContent) {
                currentResponseBuffer += textContent;
                this.emitResponse(textContent);
              }
            }
            if (event.event === 'on_chat_model_end' && event.data?.output) {
              const meta =
                event.data.output.usage_metadata ||
                event.data.output.response_metadata?.usage;
              if (meta) {
                const normalized = normalizeUsageMetadata(meta);
                usageChat.input_tokens += normalized.input_tokens;
                usageChat.output_tokens += normalized.output_tokens;
                usageChat.total_tokens += normalized.total_tokens;
              }
            }
            if (
              event.event === 'on_llm_end' &&
              (event.data?.output?.llmOutput?.tokenUsage ||
                event.data?.output?.estimatedTokenUsage)
            ) {
              const t =
                event.data.output.llmOutput?.tokenUsage ||
                event.data.output.estimatedTokenUsage;
              const normalized = normalizeUsageMetadata(t);
              usageChat.input_tokens += normalized.input_tokens;
              usageChat.output_tokens += normalized.output_tokens;
              usageChat.total_tokens += normalized.total_tokens;
            }
          }
        } else {
          throw err;
        }
      }

      // Emit the final sources used for the response
      if (collectedDocuments.length > 0) {
        this.emitter.emit(
          'data',
          JSON.stringify({
            type: 'sources',
            data: collectedDocuments,
            searchQuery: '',
            searchUrl: '',
          }),
        );
      }

      // If we didn't get any streamed tokens but have a final result, emit it
      if (
        currentResponseBuffer === '' &&
        finalResult &&
        finalResult.messages &&
        finalResult.messages.length > 0
      ) {
        const finalMessage =
          finalResult.messages[finalResult.messages.length - 1];

        if (finalMessage && finalMessage.content) {
          console.log('SimplifiedAgent: Emitting complete response (fallback)');

          const text = extractTextContent(finalMessage.content);
          if (text) {
            this.emitResponse(text);
          }
        }
      }

      // If we still have no response, emit a fallback message
      if (
        currentResponseBuffer === '' &&
        (!finalResult ||
          !finalResult.messages ||
          finalResult.messages.length === 0)
      ) {
        console.warn('SimplifiedAgent: No valid response found');
        this.emitResponse(
          'I apologize, but I was unable to generate a complete response to your query. Please try rephrasing your question or providing more specific details.',
        );
      }

      // Clean up tool_llm_usage listener before final emission
      this.emitter.removeListener('tool_llm_usage', toolLlmUsageHandler);

      // Emit model stats and end signal after streaming is complete
      console.log(
        'SimplifiedAgent: Usage collected — chat:',
        usageChat,
        'system:',
        usageSystem,
      );
      this.emitModelStats(usageChat, usageSystem);

      this.emitter.emit('end');
    } catch (error: unknown) {
      // Clean up tool_llm_usage listener on error
      if (toolLlmUsageHandler) {
        this.emitter.removeListener('tool_llm_usage', toolLlmUsageHandler);
      }

      console.error('SimplifiedAgent: Error during search and answer:', error);

      // Handle specific error types
      if (this.signal.aborted) {
        console.warn('SimplifiedAgent: Operation was aborted');
        this.emitResponse('The search operation was cancelled.');
      } else {
        // General error handling
        this.emitResponse(
          'I encountered an error while processing your request. Please try rephrasing your query or contact support if the issue persists.',
        );
      }

      this.emitter.emit('end');
    }
  }

  /**
   * Get current configuration info
   */
  getInfo(): object {
    return {
      personaInstructions: !!this.personaInstructions,
    };
  }
}
