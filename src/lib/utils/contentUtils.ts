import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';

/**
 * Removes all content within <think>...</think> blocks, including content
 * before orphaned </think> tags (from providers that don't send opening <think>).
 * @param text The input text containing thinking blocks
 * @returns The text with all thinking blocks removed
 */
export const removeThinkingBlocks = (text: string): string => {
  // First remove properly paired <think>...</think> blocks
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, '');

  // Then handle orphaned </think> (no opening <think>).
  // Remove text between the last closing HTML tag (or start of string) and </think>.
  if (result.includes('</think>')) {
    result = result.replace(
      /(^|<\/[a-zA-Z][a-zA-Z0-9]*\s*>)[\s\S]*?<\/think>/g,
      '$1',
    );
  }

  return result.trim();
};

/**
 * Removes thinking blocks from the content of an array of BaseMessage objects
 * @param messages Array of BaseMessage objects
 * @returns New array with thinking blocks removed from each message's content
 */
export const removeThinkingBlocksFromMessages = (
  messages: BaseMessage[],
): BaseMessage[] => {
  return messages.map((message) => {
    // Only process string content, leave complex content as-is
    if (typeof message.content !== 'string') {
      return message;
    }

    const cleanedContent = removeThinkingBlocks(message.content);

    // Create new instance of the same message type with cleaned content
    if (message instanceof AIMessage) {
      return new AIMessage(cleanedContent);
    } else if (message instanceof HumanMessage) {
      return new HumanMessage(cleanedContent);
    } else if (message instanceof SystemMessage) {
      return new SystemMessage(cleanedContent);
    } else if (message instanceof ToolMessage) {
      return new ToolMessage({
        content: cleanedContent,
        tool_call_id: message.tool_call_id,
      });
    } else {
      // For any other message types, return the original message unchanged
      // This is a safe fallback for custom message types
      return message;
    }
  });
};
