import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { EventEmitter } from 'events';
import { SimplifiedAgent } from './simplifiedAgent';
import { CachedEmbeddings } from '../utils/cachedEmbeddings';
import { PersonalizationContext } from './metaSearchAgent';

/**
 * Agent Search class implementing LangGraph Supervisor pattern
 */
export class AgentSearch {
  private emitter: EventEmitter;
  private agentMode: string;

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
   * Execute the agent search workflow
   */
  async searchAndAnswer(
    query: string,
    history: BaseMessage[] = [],
    fileIds: string[] = [],
  ) {
    console.log('AgentSearch: Using simplified agent implementation');

    // Delegate to simplified agent with agentMode
    await this.simplifiedAgent.searchAndAnswer(
      query,
      history,
      fileIds,
      this.agentMode,
    );
  }
}
