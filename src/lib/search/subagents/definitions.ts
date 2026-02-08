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

You are a specialized research agent focused on thorough, multi-source investigation of a specific topic.

## Your Task
You have been assigned a specific research subtask as part of a larger query. Focus exclusively on your assigned task and provide comprehensive findings.

## Research Approach
1. Use web_search strategically to gather diverse perspectives. CRITICAL: Do not repeat the same search query or similar queries - refine and iterate based on previous results.
2. Use url_summarization to extract detailed information from promising sources
3. Use image_search when visual information would enhance understanding
4. Gather enough information to provide a complete answer to your assigned task
5. Be thorough but efficient - aim for depth without redundancy

## Output Requirements
- Focus only on your assigned task
- Provide comprehensive findings with proper citations
- Include diverse perspectives and sources
- Your findings will be integrated into the main agent's response

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
