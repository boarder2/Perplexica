import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { EventEmitter } from 'events';
import { SimplifiedAgent } from './simplifiedAgent';
import { CachedEmbeddings } from '../utils/cachedEmbeddings';
import { PersonalizationContext } from './metaSearchAgent';
import { executeWithSubagents } from './subagents/supervisor';

/**
 * Agent Search class implementing LangGraph Supervisor pattern with subagent support
 */
export class AgentSearch {
  private emitter: EventEmitter;
  private agentMode: string;
  private chatLlm: BaseChatModel;
  private systemLlm: BaseChatModel;
  private embeddings: CachedEmbeddings;
  private personaInstructions: string;
  private signal: AbortSignal;

  // Simplified agent experimental implementation
  private simplifiedAgent: SimplifiedAgent;

  constructor(
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: CachedEmbeddings,
    emitter: EventEmitter,
    personaInstructions: string = '',
    signal: AbortSignal,
    agentMode: string = 'webSearch',
    private chatId?: string,
    private messageId?: string,
    private retrievalSignal?: AbortSignal,
    private personalization?: PersonalizationContext,
  ) {
    this.emitter = emitter;
    this.agentMode = agentMode;
    this.chatLlm = chatLlm;
    this.systemLlm = systemLlm;
    this.embeddings = embeddings;
    this.personaInstructions = personaInstructions;
    this.signal = signal;

    // Initialize simplified agent (experimental)
    this.simplifiedAgent = new SimplifiedAgent(
      chatLlm,
      systemLlm,
      embeddings,
      emitter,
      personaInstructions,
      signal,
      this.messageId,
      this.retrievalSignal,
      this.personalization?.location,
      this.personalization?.profile,
    );
  }

  /**
   * Execute the agent search workflow with subagent support
   */
  async searchAndAnswer(
    query: string,
    history: BaseMessage[] = [],
    fileIds: string[] = [],
  ) {
    console.log('AgentSearch: Using supervisor with subagent support');

    // Use supervisor to determine if subagents should be used
    // Falls back to standard SimplifiedAgent if not needed
    await executeWithSubagents(
      query,
      history,
      this.chatLlm,
      this.systemLlm,
      this.embeddings,
      this.emitter,
      this.signal,
      this.messageId || 'unknown',
      fileIds,
      this.agentMode,
      this.personaInstructions,
      this.retrievalSignal,
      this.personalization?.location,
      this.personalization?.profile,
    );
  }
}
