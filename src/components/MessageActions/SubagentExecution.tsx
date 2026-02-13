import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  Bot,
  Search,
  FileText,
  Globe,
} from 'lucide-react';
import { decodeHtmlEntities } from '@/lib/utils/html';
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx';
import { cn } from '@/lib/utils';

interface SubagentExecutionProps {
  id?: string;
  name?: string;
  task?: string;
  status?: string; // running | success | error
  summary?: string;
  error?: string;
  responseText?: string; // Accumulated response tokens
  children?: React.ReactNode; // ToolCall markup will be in children
}

// Markdown options for subagent responses
const responseMarkdownOptions: MarkdownToJSX.Options = {
  overrides: {
    code: {
      component: ({ className, children }) => {
        if (className) {
          // Fenced code block
          return (
            <pre className="bg-surface-2 rounded p-2 overflow-x-auto my-2">
              <code className={className}>{children}</code>
            </pre>
          );
        }
        // Inline code
        return (
          <code className="px-1.5 py-0.5 rounded bg-surface-2 font-mono text-sm">
            {children}
          </code>
        );
      },
    },
    pre: {
      component: ({ children }) => children,
    },
    a: {
      component: (props) => (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        />
      ),
    },
    // Security: prevent rendering of potentially dangerous elements
    iframe: () => null,
    script: () => null,
    object: () => null,
    style: () => null,
  },
};

/**
 * SubagentExecution component displays the status and results of a subagent execution
 * with expandable nested content showing tool calls and other activities
 */
export const SubagentExecution: React.FC<SubagentExecutionProps> = ({
  id: _id,
  name,
  task,
  status = 'running',
  summary,
  error,
  responseText,
  children,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [responseExpanded, setResponseExpanded] = useState(false);

  // Children contains the ToolCall markup
  const hasActivity = children && React.Children.count(children) > 0;
  const decodedResponse = responseText ? decodeHtmlEntities(responseText) : '';
  const decodedSummary = summary ? decodeHtmlEntities(summary) : '';

  // Unified response content: prefer summary (final) over responseText (streaming)
  const responseContent = decodedSummary || decodedResponse;

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 size={16} className="animate-spin text-accent" />;
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'error':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return <Loader2 size={16} className="animate-spin text-accent" />;
    }
  };

  const getSubagentIcon = (subagentName: string) => {
    switch (subagentName) {
      case 'Deep Research':
        return <Search size={16} className="text-accent" />;
      case 'File Analyzer':
        return <FileText size={16} className="text-green-600" />;
      case 'Content Synthesizer':
        return <Globe size={16} className="text-purple-600" />;
      default:
        return <Bot size={16} className="text-fg/70" />;
    }
  };

  return (
    <div className="my-3 border border-surface-2 rounded-lg bg-surface overflow-hidden">
      {/* Main header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-2/50 transition-colors"
      >
        {/* Status icon */}
        <div className="shrink-0">{getStatusIcon()}</div>

        {/* Subagent info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            {name && getSubagentIcon(name)}
            <span className="font-semibold text-sm">{name || 'Subagent'}</span>
          </div>
          {task && (
            <div
              className={cn('text-xs text-fg/70 mt-1', !expanded && 'truncate')}
            >
              {decodeHtmlEntities(task)}
            </div>
          )}
        </div>

        {/* Expand icon */}
        <div className="shrink-0">
          <ChevronDown
            size={16}
            className={`text-fg/70 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-surface-2 space-y-3 max-h-[33vh] overflow-y-auto">
          {/* Show tool calls - always visible when present */}
          {hasActivity && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-fg/70 uppercase tracking-wide">
                Activity
              </div>
              <div className="space-y-1">{children}</div>
            </div>
          )}

          {/* Unified response display - shows streaming response or final summary */}
          {responseContent && responseContent.trim() && (
            <div className="space-y-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setResponseExpanded(!responseExpanded);
                }}
                className="flex items-center gap-2 text-xs font-semibold text-fg/70 uppercase tracking-wide hover:text-fg/90 transition-colors"
              >
                {responseExpanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                Response
              </button>
              {responseExpanded && (
                <div
                  className={cn(
                    'prose prose-sm prose-invert dark:prose-invert max-w-none',
                    'prose-p:leading-relaxed prose-p:my-2',
                    'prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm',
                    'prose-ul:my-2 prose-ol:my-2 prose-li:my-1',
                    'prose-strong:font-bold prose-em:italic',
                    'prose-code:bg-surface-2 prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
                    'prose-a:text-accent prose-a:no-underline hover:prose-a:underline',
                    'wrap-break-word',
                  )}
                >
                  <Markdown options={responseMarkdownOptions}>
                    {responseContent}
                  </Markdown>
                </div>
              )}
            </div>
          )}

          {/* Show error if error status */}
          {status === 'error' && error && (
            <div>
              <div className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">
                Error
              </div>
              <div className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                {decodeHtmlEntities(error)}
              </div>
            </div>
          )}

          {/* Show "no activity" if running with no nested data or response */}
          {status === 'running' && !hasActivity && !responseContent && (
            <div className="text-xs text-fg/50 italic">Starting...</div>
          )}
        </div>
      )}
    </div>
  );
};
