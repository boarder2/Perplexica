/**
 * Subagent Definitions
 *
 * This module defines the available subagents that the main agent can invoke
 * as tools. Subagents are ephemeral, specialized agents that run within a
 * single request context for focused investigation.
 */

export interface SubagentDefinition {
  /** Unique identifier for the subagent */
  name: string;
  /** Human-readable description of the subagent's purpose */
  description: string;
  /** System prompt template for the subagent */
  systemPrompt: string;
  /** Whitelist of allowed tool names */
  allowedTools: string[];
  /** Use system model (cheaper/faster) or chat model (more capable) */
  useSystemModel: boolean;
  /** Maximum turns before forced termination */
  maxTurns: number;
  /** Can this subagent run in parallel with others? */
  parallelizable: boolean;
}

/**
 * Registry of available subagents
 */
export const SUBAGENT_DEFINITIONS: Record<string, SubagentDefinition> = {
  deep_research: {
    name: 'Deep Research',
    description:
      'Performs comprehensive multi-source research on a specific aspect of the query',
    systemPrompt: `# Deep Research Specialist

You are a specialized research agent focused on thorough, multi-source investigation of a specific, narrow topic.

## Your Task
You have been assigned a specific, focused research subtask as part of a larger query. Focus EXCLUSIVELY on your assigned task — do not attempt to answer the broader question or research tangential topics. Your job is to deeply investigate one specific aspect and return detailed findings on that aspect only.

## Research Approach
1. **Start with web_search** to discover relevant sources and get an initial understanding of the topic.
2. **Prioritize full content retrieval**: After identifying promising sources from web_search results, use url_summarization to retrieve and read the full content. Web search snippets are often incomplete — always prefer reading full sources before drawing conclusions or executing additional searches.
3. Use image_search when visual information would enhance understanding
4. **Research cycle**: Search → Retrieve full content from best sources → Refine understanding → Search for gaps → Retrieve more full content. Avoid running many web searches without reading the actual source content in between.
5. Be thorough but efficient - aim for depth without redundancy
6. If your task is to discover scope (e.g., "what categories exist", "what events have completed"), focus on producing a clear, structured list rather than investigating each item in depth

## Output Requirements
- Focus ONLY on your assigned task — nothing more, nothing less
- Provide comprehensive findings with proper citations
- Include diverse perspectives and sources
- Structure your findings clearly so the main agent can easily extract and integrate them
- Your findings will be integrated into the main agent's response alongside findings from other research tasks

## Critical Instructions
- NEVER run more than 8 web_search queries. If you hit this limit and still need more more information, summarize your findings and explain that you have reached the limit. Describe what additional information you would have sought if you had more queries available. DO NOT BYPASS THIS LIMIT UNDER ANY CIRCUMSTANCE.
- NEVER repeat the same web_search query. NEVER use a similar query to one previously used. Refine and iterate based on previous results.

Begin researching your assigned task now.`,
    allowedTools: [
      'web_search',
      'url_summarization',
      'image_search',
      'youtube_transcript',
      'pdf_loader',
    ],
    useSystemModel: false, // Needs strong reasoning
    maxTurns: 10,
    parallelizable: true,
  },
};

/**
 * Get a subagent definition by name
 */
export function getSubagentDefinition(
  name: string,
): SubagentDefinition | undefined {
  return SUBAGENT_DEFINITIONS[name];
}

/**
 * Get all available subagent names
 */
export function getAvailableSubagents(): string[] {
  return Object.keys(SUBAGENT_DEFINITIONS);
}

/**
 * Check if a subagent exists
 */
export function subagentExists(name: string): boolean {
  return name in SUBAGENT_DEFINITIONS;
}
