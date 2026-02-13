import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Extract the model name from an LLM instance
 * Handles different LLM implementations that may store the model name in different properties
 * @param llm The LLM instance
 * @returns The model name or 'Unknown' if not found
 */
export function getModelName(llm: BaseChatModel): string {
  try {
    // @ts-expect-error -- Different LLM implementations have different properties
    if (llm.modelName) {
      // @ts-expect-error -- accessing dynamic LLM properties
      return llm.modelName;
    }

    // @ts-expect-error -- accessing dynamic LLM properties
    if (llm._llm && llm._llm.modelName) {
      // @ts-expect-error -- accessing dynamic LLM properties
      return llm._llm.modelName;
    }

    // @ts-expect-error -- accessing dynamic LLM properties
    if (llm.model && llm.model.modelName) {
      // @ts-expect-error -- accessing dynamic LLM properties
      return llm.model.modelName;
    }

    if ('model' in llm) {
      const model = llm.model;
      if (typeof model === 'string') {
        return model;
      }
      // @ts-expect-error -- accessing dynamic LLM properties
      if (model && model.modelName) {
        // @ts-expect-error -- accessing dynamic LLM properties
        return model.modelName;
      }
    }

    if (llm.constructor && llm.constructor.name) {
      // Last resort: use the class name
      return llm.constructor.name;
    }

    return 'Unknown';
  } catch (e) {
    console.error('Failed to get model name:', e);
    return 'Unknown';
  }
}

export function setTemperature(llm: BaseChatModel, temperature?: number) {
  try {
    if ('temperature' in llm) {
      (llm as unknown as Record<string, unknown>).temperature = temperature;
    }
  } catch (e) {
    console.error('Failed to set temperature:', e);
  }
}
