'use client';

import { cn } from '@/lib/utils';
import {
  CheckCheck,
  Copy as CopyIcon,
  Search,
  FileText,
  Globe,
  Settings,
  Image as ImageIcon,
  BotIcon,
  TvIcon,
  X,
  Loader2,
} from 'lucide-react';
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';
import ThinkBox from './ThinkBox';
import { Document } from '@langchain/core/documents';
import CitationLink from './CitationLink';
import { decodeHtmlEntities } from '@/lib/utils/html';
import { SubagentExecution } from './MessageActions/SubagentExecution';

/**
 * Pattern matching known custom element closing tags (ToolCall, SubagentExecution).
 * Used as boundaries to distinguish markdown content from orphaned think text.
 * Must NOT match arbitrary HTML-like tags that models may produce in their
 * thinking output (e.g. </parameter>, </tool>, </result>).
 */
const KNOWN_CLOSING_TAG = '<\\/(?:ToolCall|SubagentExecution)\\s*>';

/**
 * Remove think-tag content, handling both properly paired <think>...</think>
 * and orphaned </think> (no opening tag) from providers like LM Studio.
 */
const removeThinkTags = (content: string): string => {
  // Remove properly paired <think>...</think>
  let result = content.replace(/<think[^>]*>[\s\S]*?<\/think>/g, '');
  // Remove orphaned </think> and text preceding them (think content without opening tag).
  // Only treats known custom element closing tags as boundaries; arbitrary HTML-like
  // tags in model thinking output (e.g. </parameter>) are treated as think content.
  if (result.includes('</think>')) {
    result = result.replace(
      new RegExp(`(^|${KNOWN_CLOSING_TAG})([\\s\\S]*?)<\\/think>`, 'g'),
      '$1',
    );
  }
  return result.trim();
};

// Split content into alternating markdown and think segments.
// This must happen before markdown-to-jsx sees the content because the library
// only treats standard HTML5 block elements as block HTML; <think> is unknown
// and treated as inline, causing blank lines inside it to end the HTML block
// and spill the remaining thinking text as plain markdown.
interface ContentSegment {
  type: 'markdown' | 'think';
  content: string;
  id: string;
}

/**
 * Split content by think blocks, handling both:
 * 1. Properly paired <think>...</think>
 * 2. Orphaned </think> (no opening <think>) from providers like LM Studio
 *    that stream thinking content as regular text.
 */
const splitByThinkBlocks = (content: string): ContentSegment[] => {
  const segments: ContentSegment[] = [];
  // Match either a proper <think>...</think> pair (group 1) or a standalone </think>
  const regex = /<think(?:\s[^>]*)?>([\s\S]*?)<\/think>|<\/think>/g;
  let lastIndex = 0;
  let thinkCounter = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match[1] !== undefined) {
      // Properly paired <think>...</think>
      if (match.index > lastIndex) {
        segments.push({
          type: 'markdown',
          content: content.slice(lastIndex, match.index),
          id: `md-${segments.length}`,
        });
      }
      segments.push({
        type: 'think',
        content: match[1].trim(),
        id: `think-${thinkCounter++}`,
      });
    } else {
      // Orphaned </think> — content since lastIndex is a mix of
      // possible HTML tags (ToolCall, etc.) followed by think text.
      const chunk = content.slice(lastIndex, match.index);

      if (chunk.trim()) {
        // Find the boundary: everything up to and including the last
        // known custom element closing tag is markdown; everything after is think text.
        // Only ToolCall and SubagentExecution are treated as boundaries — arbitrary
        // HTML-like tags in model output (e.g. </parameter>) are think content.
        const boundary = chunk.match(
          new RegExp(`^([\\s\\S]*${KNOWN_CLOSING_TAG})([\\s\\S]*)$`),
        );

        if (boundary) {
          const [, markdownPart, thinkPart] = boundary;
          if (markdownPart.trim()) {
            segments.push({
              type: 'markdown',
              content: markdownPart,
              id: `md-${segments.length}`,
            });
          }
          if (thinkPart.trim()) {
            segments.push({
              type: 'think',
              content: thinkPart.trim(),
              id: `think-${thinkCounter++}`,
            });
          }
        } else {
          // No HTML tags in chunk — entire chunk is think content
          segments.push({
            type: 'think',
            content: chunk.trim(),
            id: `think-${thinkCounter++}`,
          });
        }
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'markdown',
      content: content.slice(lastIndex),
      id: `md-${segments.length}`,
    });
  }

  return segments;
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showThinking?: boolean;
  messageId?: string;
  expandedThinkBoxes?: Set<string>;
  onThinkBoxToggle?: (
    messageId: string,
    thinkBoxId: string,
    expanded: boolean,
  ) => void;
  sources?: Document[];
}

// Custom ToolCall component for markdown
const ToolCall = ({
  type,
  query,
  urls: _urls,
  url,
  videoId,
  count,
  status,
  error,
  children,
}: {
  type?: string;
  query?: string;
  urls?: string;
  url?: string;
  videoId?: string;
  count?: string;
  status?: string; // running | success | error
  error?: string;
  children?: React.ReactNode;
}) => {
  const getIcon = (toolType: string) => {
    switch (toolType) {
      case 'search':
      case 'web_search':
        return <Search size={16} className="text-accent" />;
      case 'file':
      case 'file_search':
        return <FileText size={16} className="text-green-600" />;
      case 'url':
      case 'url_summarization':
        return <Globe size={16} className="text-purple-600" />;
      case 'image':
      case 'image_search':
        return <ImageIcon size={16} className="text-blue-600" />;
      case 'firefoxAI':
        return <BotIcon size={16} className="text-indigo-600" />;
      case 'youtube_transcript':
        return <TvIcon size={16} className="text-red-600" />;
      case 'pdf_loader':
        return <FileText size={16} className="text-red-600" />;
      default:
        return <Settings size={16} className="text-fg/70" />;
    }
  };

  const formatToolMessage = () => {
    if (type === 'search' || type === 'web_search') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>Web search:</span>
          <span className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm">
            {decodeHtmlEntities(query || (children as string))}
          </span>
        </>
      );
    }

    if (type === 'file' || type === 'file_search') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>File search:</span>
          <span className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm">
            {decodeHtmlEntities(query || (children as string))}
          </span>
        </>
      );
    }

    if (type === 'url' || type === 'url_summarization') {
      const urlCount = count ? parseInt(count) : 1;
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>
            Analyzing {urlCount} web page{urlCount === 1 ? '' : 's'} for
            additional details
          </span>
        </>
      );
    }

    if (type === 'pdf_loader' && url) {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>Loading PDF document:</span>
          <a
            target="_blank"
            href={decodeHtmlEntities(url)}
            className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm"
          >
            {decodeHtmlEntities(url)}
          </a>
        </>
      );
    }

    if (type === 'image' || type === 'image_search') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>Image search:</span>
          <span className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm">
            {decodeHtmlEntities(query || (children as string))}
          </span>
        </>
      );
    }

    if (type === 'firefoxAI') {
      return (
        <>
          <span className="mr-2">{getIcon(type)}</span>
          <span>Firefox AI detected, tools disabled</span>
        </>
      );
    }

    if (type === 'youtube_transcript' && videoId) {
      return (
        <div className="w-full">
          <div className="flex items-center mb-2">
            <span className="mr-2">{getIcon(type)}</span>
            <span>Retrieved YouTube Transcript</span>
          </div>
          <div className="mt-2 rounded">
            <div className="w-full">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                className="w-full aspect-video rounded-2xl"
                allowFullScreen
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </div>
        </div>
      );
    }

    // Fallback for unknown tool types
    return (
      <>
        <span className="mr-2">{getIcon(type || 'default')}</span>
        <span>Using tool:</span>
        <span className="ml-2 px-2 py-0.5 bg-fg/5 rounded font-mono text-sm border border-surface-2">
          {type || 'unknown'}
        </span>
      </>
    );
  };

  return (
    <div className="my-3 px-4 py-3 bg-surface border border-surface-2 rounded-lg">
      <div className="flex items-start justify-between gap-2 text-sm font-medium">
        <div className="flex items-center flex-wrap gap-1">
          {formatToolMessage()}
        </div>
        <div className="flex items-center h-5">
          {status === 'running' && (
            <div className="w-4 h-4">
              <Loader2 className="animate-spin text-fg/70" />
            </div>
          )}
          {status === 'success' && (
            <CheckCheck size={16} className="text-green-500" />
          )}
          {status === 'error' && <X size={16} className="text-red-500" />}
        </div>
      </div>
      {status === 'error' && error && (
        <div className="mt-2 text-xs text-red-400 break-words font-mono whitespace-pre-wrap">
          {decodeHtmlEntities(error)}
        </div>
      )}
    </div>
  );
};

const ThinkTagProcessor = ({
  children,
  id,
  isExpanded,
  onToggle,
}: {
  children: React.ReactNode;
  id?: string;
  isExpanded?: boolean;
  onToggle?: (thinkBoxId: string, expanded: boolean) => void;
}) => {
  return (
    <ThinkBox
      content={children}
      expanded={isExpanded}
      onToggle={() => {
        if (id && onToggle) {
          onToggle(id, !isExpanded);
        }
      }}
    />
  );
};
const CodeBlock = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  // Extract language from className (format could be "language-javascript" or "lang-javascript")
  let language = '';
  if (className) {
    if (className.startsWith('language-')) {
      language = className.replace('language-', '');
    } else if (className.startsWith('lang-')) {
      language = className.replace('lang-', '');
    }
  }

  const content = children as string;
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const root = document.documentElement;
  const isDark = root.classList.contains('dark');

  const syntaxStyle = isDark ? oneDark : oneLight;
  const backgroundStyle = isDark ? '#1c1c1c' : '#fafafa';

  return (
    <div className="rounded-md overflow-hidden my-4 relative group border border-surface-2">
      <div className="flex justify-between items-center px-4 py-2 bg-surface-2 border-b border-surface-2 text-xs text-fg/70 font-mono">
        <span>{language}</span>
        <button
          onClick={handleCopyCode}
          className="p-1 rounded-md hover:bg-surface transition duration-200"
          aria-label="Copy code to clipboard"
        >
          {isCopied ? (
            <CheckCheck size={14} className="text-green-500" />
          ) : (
            <CopyIcon size={14} className="text-fg" />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={syntaxStyle}
        customStyle={{
          margin: 0,
          padding: '1rem',
          borderRadius: 0,
          backgroundColor: backgroundStyle,
        }}
        wrapLines
        wrapLongLines
        showLineNumbers={language !== '' && content.split('\n').length > 1}
        useInlineStyles
        PreTag="div"
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownRenderer = ({
  content,
  className,
  showThinking = true,
  messageId,
  expandedThinkBoxes,
  onThinkBoxToggle,
  sources,
}: MarkdownRendererProps) => {
  // Check if a think box is expanded
  const isThinkBoxExpanded = (thinkBoxId: string) => {
    return expandedThinkBoxes?.has(thinkBoxId) || false;
  };

  // Handle think box toggle
  const handleThinkBoxToggle = (thinkBoxId: string, expanded: boolean) => {
    if (messageId && onThinkBoxToggle) {
      onThinkBoxToggle(messageId, thinkBoxId, expanded);
    }
  };

  // Markdown formatting options — <think> is intentionally absent; handled pre-render
  const markdownOverrides: MarkdownToJSX.Options = {
    overrides: {
      ToolCall: {
        component: ToolCall,
      },
      SubagentExecution: {
        component: SubagentExecution,
      },
      code: {
        component: ({ className, children }) => {
          // Check if it's an inline code block or a fenced code block
          if (className) {
            // This is a fenced code block (```code```)
            return <CodeBlock className={className}>{children}</CodeBlock>;
          }
          // This is an inline code block (`code`)
          return (
            <code className="px-1.5 py-0.5 rounded bg-surface-2 font-mono text-sm">
              {children}
            </code>
          );
        },
      },
      strong: {
        component: ({ children }) => (
          <strong className="font-bold">{children}</strong>
        ),
      },
      pre: {
        component: ({ children }) => children,
      },
      a: {
        component: (props) => {
          // Check if this is a citation link with data-citation attribute
          const citationNumber = props['data-citation'];

          if (sources && citationNumber) {
            const number = parseInt(citationNumber);
            const source = sources[number - 1];

            if (source) {
              return (
                <CitationLink
                  number={number.toString()}
                  source={source}
                  url={props.href}
                />
              );
            }
          }

          // Default link behavior
          return <a {...props} target="_blank" rel="noopener noreferrer" />;
        },
      },
      // Prevent rendering of certain HTML elements for security
      iframe: () => null, // Don't render iframes
      script: () => null, // Don't render scripts
      object: () => null, // Don't render objects
      style: () => null, // Don't render styles
    },
  };

  if (!content || content.length === 0) return null;

  const proseClassName = cn(
    'prose prose-theme dark:prose-invert prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] prose-p:leading-relaxed prose-pre:p-0 font-[400]',
    'prose-code:bg-transparent prose-code:p-0 prose-code:text-inherit prose-code:font-normal prose-code:before:content-none prose-code:after:content-none',
    'prose-pre:bg-transparent prose-pre:border-0 prose-pre:m-0 prose-pre:p-0',
    'prose-strong:font-bold',
    'break-words max-w-full',
    className,
  );

  // For showThinking=false, strip think blocks entirely and render as plain markdown
  if (!showThinking) {
    const stripped = removeThinkTags(content);
    if (!stripped || stripped.length === 0) return null;
    return (
      <div className="relative">
        <Markdown className={proseClassName} options={markdownOverrides}>
          {stripped}
        </Markdown>
      </div>
    );
  }

  // Split content into segments so <think> blocks are extracted before markdown-to-jsx
  // processes them (the library would mis-parse multi-paragraph think blocks as plain text).
  const segments = splitByThinkBlocks(content);

  // Fast path: no think blocks present — render content directly
  if (segments.length === 0) return null;
  if (segments.length === 1 && segments[0].type === 'markdown') {
    return (
      <div className="relative">
        <Markdown className={proseClassName} options={markdownOverrides}>
          {content}
        </Markdown>
      </div>
    );
  }

  // Segment rendering: think blocks become ThinkBox components, markdown renders normally
  return (
    <div className="relative">
      {segments.map((segment) => {
        if (segment.type === 'think') {
          if (!segment.content) return null;
          return (
            <ThinkTagProcessor
              key={segment.id}
              id={segment.id}
              isExpanded={isThinkBoxExpanded(segment.id)}
              onToggle={handleThinkBoxToggle}
            >
              <MarkdownRenderer
                content={segment.content}
                showThinking={false}
                sources={sources}
              />
            </ThinkTagProcessor>
          );
        }

        const trimmed = segment.content.trim();
        if (!trimmed) return null;
        return (
          <Markdown
            key={segment.id}
            className={proseClassName}
            options={markdownOverrides}
          >
            {segment.content}
          </Markdown>
        );
      })}
    </div>
  );
};

export default MarkdownRenderer;
