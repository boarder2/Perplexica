/**
 * Subagent Executor
 *
 * Wraps SimplifiedAgent execution with subagent-specific configuration
 * including tool restrictions, model selection, and event isolation.
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { EventEmitter } from 'events';
import { Document } from 'langchain/document';
import { SubagentExecution } from '@/lib/state/chatAgentState';
import { SimplifiedAgent } from '@/lib/search/simplifiedAgent';
import { SubagentDefinition } from './definitions';
import { CachedEmbeddings } from '@/lib/utils/cachedEmbeddings';
import { allAgentTools } from '@/lib/tools/agents';

/**
 * SubagentExecutor runs a SimplifiedAgent with subagent-specific constraints
 */
export class SubagentExecutor {
  private definition: SubagentDefinition;
  private chatLlm: BaseChatModel;
  private systemLlm: BaseChatModel;
  private embeddings: CachedEmbeddings;
  private parentEmitter: EventEmitter;
  private signal: AbortSignal;
  private messageId: string;

  constructor(
    definition: SubagentDefinition,
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: CachedEmbeddings,
    parentEmitter: EventEmitter,
    signal: AbortSignal,
    messageId: string,
  ) {
    this.definition = definition;
    this.chatLlm = chatLlm;
    this.systemLlm = systemLlm;
    this.embeddings = embeddings;
    this.parentEmitter = parentEmitter;
    this.signal = signal;
    this.messageId = messageId;
  }

  /**
   * Execute the subagent with a specific task
   */
  async execute(
    task: string,
    context: BaseMessage[],
    fileIds: string[],
  ): Promise<SubagentExecution> {
    const executionId = `subagent_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();

    console.log(`SubagentExecutor: Starting ${this.definition.name}`, {
      executionId,
      task,
      allowedTools: this.definition.allowedTools,
    });

    // Emit start event to parent
    this.emitSubagentEvent('subagent_started', {
      executionId,
      name: this.definition.name,
      task,
    });

    try {
      // Create isolated emitter to capture subagent events
      const isolatedEmitter = this.createIsolatedEmitter(executionId);

      // Collect documents and response text from isolated emitter
      const collectedData = {
        documents: [] as Document[],
        responseText: '',
      };

      // Listen for data from the isolated emitter
      isolatedEmitter.on('data', (data: string) => {
        const parsed = JSON.parse(data);

        // Collect response text
        if (parsed.type === 'response') {
          collectedData.responseText += parsed.data || '';
        }

        // Note: Documents are accumulated in SimplifiedAgentState
        // We'll extract them from the final state if possible
      });

      // Select the appropriate model based on subagent configuration
      const selectedLlm = this.definition.useSystemModel
        ? this.systemLlm
        : this.chatLlm;

      // Create SimplifiedAgent with subagent system prompt
      const subagent = new SimplifiedAgent(
        selectedLlm, // Use configured model
        this.systemLlm, // Always use system model for internal operations
        this.embeddings,
        isolatedEmitter,
        this.definition.systemPrompt, // Custom system prompt
        this.signal,
        `${this.messageId}_${executionId}`,
        this.signal, // Reuse for retrieval signal
      );

      // Limit context to avoid token bloat
      const limitedContext = context.slice(-5);

      // Filter tools based on subagent's allowed tools
      const filteredTools = this.getFilteredTools();

      // Execute the subagent with custom tools and system prompt
      // Note: searchAndAnswer returns void and streams via emitter
      await subagent.searchAndAnswer(
        task,
        limitedContext,
        fileIds,
        'webSearch', // Focus mode (tools are already filtered)
        filteredTools,
        this.definition.systemPrompt,
      );

      // Wait a bit for all events to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      const endTime = Date.now();

      const execution: SubagentExecution = {
        id: executionId,
        name: this.definition.name,
        task,
        status: 'success',
        startTime,
        endTime,
        documents: collectedData.documents,
        summary: collectedData.responseText.trim(),
      };

      console.log(
        `SubagentExecutor: Completed ${this.definition.name} in ${endTime - startTime}ms`,
      );

      this.emitSubagentEvent('subagent_completed', execution);
      return execution;
    } catch (error: any) {
      console.error(
        `SubagentExecutor: Error in ${this.definition.name}:`,
        error,
      );

      const endTime = Date.now();

      const execution: SubagentExecution = {
        id: executionId,
        name: this.definition.name,
        task,
        status: 'error',
        startTime,
        endTime,
        documents: [],
        summary: '',
        error: error.message || 'Unknown error',
      };

      this.emitSubagentEvent('subagent_error', execution);
      return execution;
    }
  }

  /**
   * Filter available tools based on subagent's allowed tools list
   */
  private getFilteredTools(): any[] {
    // Get all available tools
    const availableTools = [...allAgentTools];

    // Filter by allowed tools whitelist
    if (this.definition.allowedTools.length > 0) {
      return availableTools.filter((tool) =>
        this.definition.allowedTools.includes(tool.name),
      );
    }

    // If no allowed tools specified, return all tools
    return availableTools;
  }

  /**
   *  return execution;
    }
  }

  /**
   * Create an isolated event emitter that forwards events to parent with subagent context
   */
  private createIsolatedEmitter(executionId: string): EventEmitter {
    const isolated = new EventEmitter();

    // Forward all events to parent emitter with subagent context wrapper
    isolated.on('data', (data: string) => {
      try {
        const parsed = JSON.parse(data);

        // Wrap in subagent_data envelope
        this.parentEmitter.emit(
          'data',
          JSON.stringify({
            type: 'subagent_data',
            subagentId: executionId,
            subagentName: this.definition.name,
            data: parsed,
          }),
        );
      } catch (error) {
        console.error('SubagentExecutor: Error forwarding event:', error);
      }
    });

    return isolated;
  }

  /**
   * Emit a subagent-specific event to the parent emitter
   */
  private emitSubagentEvent(type: string, data: any): void {
    this.parentEmitter.emit(
      'data',
      JSON.stringify({
        type,
        ...data,
      }),
    );
  }
}
