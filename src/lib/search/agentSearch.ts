import { BaseMessage } from '@langchain/core/messages';
import { EventEmitter } from 'events';
import { SimplifiedAgent } from './simplifiedAgent';
import { CachedEmbeddings } from '../utils/cachedEmbeddings';
import { PersonalizationContext } from './metaSearchAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Agent Search class — runs SimplifiedAgent directly with tool-based subagent support.
 *
 * The main agent has access to a `deep_research` tool that it can invoke on demand
 * when it discovers a query requires deeper investigation. This replaces the previous
 * front-loaded supervisor pattern that added an LLM call to every query.
 */
export class AgentSearch {
  private emitter: EventEmitter;
  private agentMode: string;
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
   * Execute the agent search workflow.
   * The agent can invoke deep_research as a tool when it determines
   * a sub-problem needs comprehensive investigation.
   */
  async searchAndAnswer(
    query: string,
    history: BaseMessage[] = [],
    fileIds: string[] = [],
  ) {
    console.log('AgentSearch: Running SimplifiedAgent with deep_research tool');

    await this.simplifiedAgent.searchAndAnswer(
      query,
      history,
      fileIds,
      this.agentMode,
    );
  }
}
