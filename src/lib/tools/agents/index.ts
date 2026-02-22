/**
 * Agent Tools for Simplified Chat Agent
 *
 * This module exports all the tools that reimplement the functionality of the
 * existing LangGraph agents for use with createAgent. Each tool encapsulates
 * the core logic of its corresponding agent and follows the Command pattern for
 * state management.
 */

import { simpleWebSearchTool } from './simpleWebSearchTool';
import { fileSearchTool } from './fileSearchTool';
import { imageSearchTool } from './imageSearchTool';
import { urlSummarizationTool } from './urlSummarizationTool';
import { youtubeTranscriptTool } from './youtubeTranscriptTool';
import { pdfLoaderTool } from './pdfLoaderTool';
import { deepResearchTool } from './deepResearchTool';
import { todoListTool } from './todoListTool';
import { imageAnalysisTool } from './imageAnalysisTool';

export { simpleWebSearchTool };
export { fileSearchTool };
export { imageSearchTool };
export { imageAnalysisTool };
export { youtubeTranscriptTool };
export { pdfLoaderTool };
export { deepResearchTool };
export { todoListTool };

// Array containing all available agent tools for the simplified chat agent
// This will be used by the createAgent implementation
export const allAgentTools = [
  simpleWebSearchTool,
  fileSearchTool,
  urlSummarizationTool,
  imageSearchTool,
  imageAnalysisTool,
  youtubeTranscriptTool,
  pdfLoaderTool,
  deepResearchTool,
  todoListTool,
];

// Export tool categories for selective tool loading based on focus mode
export const webSearchTools = [
  simpleWebSearchTool,
  urlSummarizationTool,
  imageSearchTool,
  imageAnalysisTool,
  youtubeTranscriptTool,
  pdfLoaderTool,
  deepResearchTool,
  todoListTool,
];

export const fileSearchTools = [fileSearchTool];

// Core tools that are always available
export const coreTools: typeof allAgentTools = [];
