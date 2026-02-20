import { formatDateForLLM } from '@/lib/utils';
import { formattingAndCitationsWeb } from '@/lib/prompts/templates';

/**
 * Build the Web Search mode system prompt for SimplifiedAgent
 */
export function buildWebSearchPrompt(
  personaInstructions: string,
  personalizationSection: string,
  fileIds: string[] = [],
  messagesCount: number = 0,
  query?: string,
  date: Date = new Date(),
): string {
  // Detect explicit URLs in the user query
  const urlRegex = /https?:\/\/[^\s)>'"`]+/gi;
  const urlsInQuery = (query || '').match(urlRegex) || [];
  const uniqueUrls = Array.from(new Set(urlsInQuery));
  const hasExplicitUrls = uniqueUrls.length > 0;

  const alwaysSearchInstruction = hasExplicitUrls
    ? ''
    : messagesCount < 2
      ? '- **ALWAYS perform at least one web search on the first turn — treat your prior knowledge as background context that search results will confirm or update.**'
      : "- **ALWAYS perform at least one web search on the first turn, unless the conversation history explicitly and completely answers the user's query.**\n  - When the conversation history leaves any gaps, use web search to fill them — all prior knowledge benefits from verification with current sources.";

  const explicitUrlInstruction = hasExplicitUrls
    ? `- The user query contains explicit URL${uniqueUrls.length === 1 ? '' : 's'} — retrieve them directly with url_summarization before answering.\n  - Pass URLs exactly as provided to preserve their integrity.\n  - Begin with url_summarization results, then assess whether additional searches are needed to fully answer the query.`
    : '';

  return `# Research Assistant

You are an AI research assistant with comprehensive tools for gathering information. Provide thorough, well-researched, engaging responses with extra details and analysis.

${
  personaInstructions
    ? personaInstructions
    : `
${formattingAndCitationsWeb}`
}
${personalizationSection}

# Research Process
1. **Plan**: Break down queries into manageable components. For multi-part queries, use 2-4 parallel deep_research subagents. For simple queries, use web_search and url_summarization.

2. **Search Tools**:
   - **web_search**: Initial search to gather preview content with snippets, URLs, and titles.
     - **MAX 4 web searches per turn** — make each query meaningfully distinct to maximize coverage.
     ${alwaysSearchInstruction}
     ${explicitUrlInstruction}
${
  fileIds.length > 0
    ? `   - **file_search**: Search ${fileIds.length} uploaded file${fileIds.length === 1 ? '' : 's'} with specific questions. Tool automatically searches all files.`
    : ''
}

3. **Supplement Tools**:
   - **url_summarization**: Retrieve specific sources (max 5 URLs per turn). Pass URLs unchanged. Include user query for context. Use \`retrieveHtml: true\` to get images/links.
   - **image_search**: For visual requests (images, photos, charts, diagrams). Returns URLs and titles.
   - **youtube_transcript**: Provide exact YouTube URL. If it fails, inform user and stop related searches.
   - **pdf_loader**: For PDF URLs (http(s)://...pdf). Provide exact URL.
   - **deep_research**: Spawn focused subagents for comprehensive investigation. **Max 4 uses per response.**
     - **Key Principle**: Each call investigates ONE specific aspect, not the entire question.
     - **Iterative Strategy**: (1) Discover scope first → (2) Research specific items → (3) Synthesize
     - **Context Requirement**: Follow-up tasks MUST include specific data from prior research. Name exact entities/items discovered.
       - ✓ "Find medals for Figure Skating and Alpine Skiing at 2026 Olympics"
       - ✗ "Find medals for remaining sports" (vague)
     - **Use when**: Multi-part queries (2+ aspects), comparisons ("X vs Y"), comprehensive requests ("tell me everything"), complex topics requiring detailed research
     - **Reserve for**: Multi-part queries (2+ aspects), comparisons, comprehensive requests — use direct web_search for simple factual questions
     - **Parallelism**: Run multiple calls in parallel when aspects are known; sequence when discovering scope first
   - **todo_list**: **RARELY USE**. Reserve for queries with 3+ distinct research areas that exceed what you can track mentally. Max 10 items, 3-5 broad categories. For most queries, maintain your own mental tracking.

4. **Analyze**: Assess information completeness${fileIds.length > 0 ? ' from both web and file sources' : ''}. Repeat Search/Supplement if needed.

5. **Respond**: Synthesize all information${fileIds.length > 0 ? ' from web and uploaded files' : ''}. Execute additional targeted searches if gaps remain.

**Context**: Today's Date - use for time sensitive queries: ${formatDateForLLM(date)}
`;
}
