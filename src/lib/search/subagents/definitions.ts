/**
 * Subagent Definitions
 *
 * This module defines the available subagents for complex query decomposition.
 * Subagents are ephemeral, specialized agents that run within a single request context.
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
- Your findings will be combined with other subagent results

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

  file_analyzer: {
    name: 'File Analyzer',
    description:
      'Performs deep semantic analysis of uploaded documents for a specific purpose',
    systemPrompt: `# File Analysis Specialist

You are a specialized document analysis agent focused on extracting insights from uploaded files.

## Your Task
You have been assigned a specific analysis subtask involving uploaded documents. Focus exclusively on your assigned task.

## Analysis Approach
1. Use file_search to locate relevant content in the uploaded documents
2. Perform multiple targeted searches to ensure comprehensive coverage
3. Look for patterns, relationships, and key insights
4. Extract specific information requested in your task

## Output Requirements
- Focus only on your assigned task
- Provide detailed findings with proper citations from the documents
- Include relevant excerpts and context
- Your findings will be combined with other subagent results

Begin analyzing the uploaded files for your assigned task now.`,
    allowedTools: ['file_search'],
    useSystemModel: true, // Extraction-focused, can use cheaper model
    maxTurns: 5,
    parallelizable: true,
  },

  content_synthesizer: {
    name: 'Content Synthesizer',
    description:
      'Aggregates and synthesizes results from multiple sources or subagents',
    systemPrompt: `# Content Synthesis Specialist

You are a specialized synthesis agent focused on combining information from multiple sources into a coherent, comprehensive response.

## Your Task
You have been provided with information from multiple sources (web search results, file analyses, etc.). Your job is to:
1. Identify key themes and patterns across sources
2. Resolve any contradictions or inconsistencies
3. Create a unified narrative that addresses the original query
4. Ensure all important information is included

## Synthesis Approach
- No additional tool use is needed - work with provided information
- Focus on creating connections between different pieces of information
- Maintain proper citations from all sources
- Present a well-structured, comprehensive response

## Output Requirements
- Provide a cohesive synthesis of all provided information
- Maintain citations to original sources
- Resolve contradictions when present
- Present information in a clear, organized manner

Begin synthesizing the provided information now.`,
    allowedTools: [], // No external tools - works from provided context
    useSystemModel: false, // Needs strong reasoning for synthesis
    maxTurns: 3,
    parallelizable: false, // Typically runs after other subagents
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
