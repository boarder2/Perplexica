'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  ChevronDown,
  ListTodo,
} from 'lucide-react';

export interface TodoItemData {
  content: string;
  status: string; // 'pending' | 'in_progress' | 'completed'
}

interface TodoWidgetProps {
  items: TodoItemData[];
}

const TodoWidget = ({ items }: TodoWidgetProps) => {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const completed = items.filter((t) => t.status === 'completed').length;
  const inProgressItem = items.find((t) => t.status === 'in_progress');
  const summary = inProgressItem
    ? inProgressItem.content
    : items.find((t) => t.status === 'pending')?.content || '';

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
      case 'in_progress':
        return (
          <Loader2 size={14} className="animate-spin text-accent shrink-0" />
        );
      case 'pending':
      default:
        return <Circle size={14} className="text-fg/30 shrink-0" />;
    }
  };

  return (
    <div className="mb-2 bg-surface border border-surface-2 rounded-lg overflow-hidden shadow-sm">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-surface-2/50 transition-colors text-sm"
      >
        <ListTodo size={14} className="text-accent shrink-0" />
        <span className="font-medium text-fg/70">Tasks</span>
        <span className="text-fg/50">
          {completed}/{items.length}
        </span>
        {summary && (
          <>
            <span className="text-fg/30">-</span>
            <span className="text-fg/50 truncate text-left flex-1">
              {summary}
            </span>
          </>
        )}
        <ChevronDown
          size={14}
          className={`text-fg/50 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="px-3 pb-2 pt-1 border-t border-surface-2 space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 py-0.5">
              <div className="mt-0.5">{getStatusIcon(item.status)}</div>
              <span
                className={`text-sm ${
                  item.status === 'completed'
                    ? 'text-fg/40 line-through'
                    : 'text-fg/80'
                }`}
              >
                {item.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TodoWidget;
