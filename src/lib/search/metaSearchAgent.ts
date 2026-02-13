import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import eventEmitter from 'events';
import { AgentSearch } from './agentSearch';
import { CachedEmbeddings } from '../utils/cachedEmbeddings';

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    chatId: string,
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: CachedEmbeddings,
    fileIds: string[],
    signal: AbortSignal,
    personaInstructions?: string,
    focusMode?: string,
    messageId?: string,
    retrievalSignal?: AbortSignal,
    personalization?: PersonalizationContext,
  ) => Promise<eventEmitter>;
}

export type PersonalizationContext = {
  location?: string;
  profile?: string;
};

interface Config {
  searchWeb: boolean;
  rerank: boolean;
  summarizer: boolean;
  rerankThreshold: number;
  queryGeneratorPrompt: string;
  responsePrompt: string;
  activeEngines: string[];
  additionalSearchCriteria?: string;
}

class MetaSearchAgent implements MetaSearchAgentType {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Execute agent workflow asynchronously with proper streaming support
   */
  private async executeAgentWorkflow(
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: CachedEmbeddings,
    emitter: eventEmitter,
    message: string,
    history: BaseMessage[],
    chatId: string,
    fileIds: string[],
    personaInstructions: string,
    signal: AbortSignal,
    focusMode: string,
    messageId?: string,
    retrievalSignal?: AbortSignal,
    personalization?: PersonalizationContext,
  ) {
    try {
      const agentSearch = new AgentSearch(
        chatLlm,
        systemLlm,
        embeddings,
        emitter,
        personaInstructions,
        signal,
        focusMode,
        chatId,
        messageId,
        retrievalSignal,
        personalization,
      );

      // Execute the agent workflow
      await agentSearch.searchAndAnswer(message, history, fileIds);

      // No need to emit end signals here since synthesizerAgent
      // is now streaming in real-time and emits them
    } catch (error) {
      console.error('Agent search error:', error);
      emitter.emit(
        'error',
        JSON.stringify({
          data: `Agent search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }),
      );
      emitter.emit('end');
    }
  }

  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    chatId: string,
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: CachedEmbeddings,
    fileIds: string[],
    signal: AbortSignal,
    personaInstructions?: string,
    focusMode?: string,
    messageId?: string,
    retrievalSignal?: AbortSignal,
    personalization?: PersonalizationContext,
  ) {
    const emitter = new eventEmitter();

    // Execute agent workflow
    this.executeAgentWorkflow(
      chatLlm,
      systemLlm,
      embeddings,
      emitter,
      message,
      history,
      chatId,
      fileIds,
      personaInstructions || '',
      signal,
      focusMode || 'webSearch',
      messageId || '',
      retrievalSignal || signal,
      personalization,
    );

    return emitter;
  }
}

export default MetaSearchAgent;
