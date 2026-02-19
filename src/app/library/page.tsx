'use client';

import DeleteChat from '@/components/DeleteChat';
import { cn, formatTimeDifference } from '@/lib/utils';
import { BookOpenText, ClockIcon, Search, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  focusMode: string;
  matchExcerpt?: string | null;
}

const HighlightedExcerpt = ({
  text,
  terms,
}: {
  text: string;
  terms: string[];
}) => {
  for (const term of terms) {
    if (!term) continue;
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx !== -1) {
      return (
        <>
          {text.slice(0, idx)}
          <span className="font-medium text-accent">
            {text.slice(idx, idx + term.length)}
          </span>
          {text.slice(idx + term.length)}
        </>
      );
    }
  }
  return <>{text}</>;
};

const Page = () => {
  // Paginated chats (normal mode)
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Chat[]>([]);
  const [isTextSearching, setIsTextSearching] = useState(false);
  const [isLlmSearching, setIsLlmSearching] = useState(false);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<'text' | 'llm'>('text');

  const isSearchMode = debouncedQuery.trim().length > 0;
  const displayedChats = isSearchMode ? searchResults : chats;
  const isSearching = isTextSearching || isLlmSearching;

  const fetchPage = async (nextOffset: number) => {
    if (nextOffset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const res = await fetch(`/api/chats?limit=${limit}&offset=${nextOffset}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();

    setChats((prev) =>
      nextOffset === 0 ? data.chats : [...prev, ...data.chats],
    );
    setHasMore(data.hasMore);
    setOffset(nextOffset + data.chats.length);

    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchPage(0);
  }, []);

  // Infinite scroll (only active when not in search mode)
  useEffect(() => {
    if (isSearchMode) return;

    let observer: IntersectionObserver | null = null;
    let cleanup: (() => void) | undefined;

    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchPage(offset);
        }
      });
      if (sentinelRef.current) {
        observer.observe(sentinelRef.current);
      }
      cleanup = () => {
        if (observer && sentinelRef.current) {
          observer.unobserve(sentinelRef.current);
          observer.disconnect();
        }
      };
    } else if (typeof window !== 'undefined') {
      const onScroll = () => {
        if (
          hasMore &&
          !loadingMore &&
          !loading &&
          typeof document !== 'undefined' &&
          window.innerHeight + window.scrollY >=
            document.body.offsetHeight - 200
        ) {
          fetchPage(offset);
        }
      };
      (window as unknown as Window).addEventListener('scroll', onScroll);
      cleanup = () => {
        (window as unknown as Window).removeEventListener('scroll', onScroll);
      };
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [hasMore, loading, loadingMore, offset, isSearchMode]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Run text search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      setSearchTerms([]);
      return;
    }

    const doTextSearch = async () => {
      setIsTextSearching(true);
      setSearchMode('text');
      setSearchTerms([]);
      try {
        const res = await fetch(
          `/api/chats?q=${encodeURIComponent(debouncedQuery)}&limit=200`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          },
        );
        const data = await res.json();
        setSearchResults(data.chats || []);
      } catch (err) {
        console.error('Text search error:', err);
        setSearchResults([]);
      } finally {
        setIsTextSearching(false);
      }
    };

    doTextSearch();
  }, [debouncedQuery]);

  const handleLlmSearch = async () => {
    if (!searchQuery.trim() || isLlmSearching) return;

    const provider =
      typeof window !== 'undefined'
        ? localStorage.getItem('chatModelProvider')
        : null;
    const model =
      typeof window !== 'undefined'
        ? localStorage.getItem('chatModel')
        : null;

    setIsLlmSearching(true);
    setSearchMode('llm');
    setSearchTerms([]);
    // Commit current query immediately so results are shown
    setDebouncedQuery(searchQuery);

    try {
      const res = await fetch('/api/chats/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          chatModel:
            provider && model ? { provider, model } : undefined,
        }),
      });
      const data = await res.json();
      setSearchResults(data.chats || []);
      setSearchTerms(data.terms || []);
    } catch (err) {
      console.error('LLM search error:', err);
      setSearchResults([]);
    } finally {
      setIsLlmSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setSearchResults([]);
    setSearchTerms([]);
    setSearchMode('text');
  };

  const Spinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const cls =
      size === 'sm'
        ? 'w-4 h-4'
        : size === 'lg'
          ? 'w-8 h-8'
          : 'w-6 h-6';
    return (
      <svg
        aria-hidden="true"
        className={cn(cls, 'text-fg/20 fill-fg/30 animate-spin')}
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
    );
  };

  return loading ? (
    <div className="flex flex-row items-center justify-center min-h-screen">
      <Spinner size="lg" />
    </div>
  ) : (
    <div>
      <div className="flex flex-col pt-4">
        <div className="flex items-center">
          <BookOpenText />
          <h1 className="text-3xl font-medium p-2">Library</h1>
        </div>
        <hr className="border-t border-surface-2 my-4 w-full" />

        {/* Search bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-fg/40 pointer-events-none"
              size={15}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLlmSearch();
              }}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-9 py-2 bg-surface border border-surface-2 rounded-lg text-sm focus:outline-none focus:border-fg/30 placeholder:text-fg/40"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/40 hover:text-fg transition-colors"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={handleLlmSearch}
            disabled={!searchQuery.trim() || isLlmSearching}
            title="Search with AI"
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors',
              'border-surface-2 bg-surface text-fg/70 hover:text-fg hover:border-fg/30',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {isLlmSearching ? (
              <Spinner size="sm" />
            ) : (
              <Sparkles size={15} />
            )}
            <span className="hidden sm:inline">AI</span>
          </button>
        </div>

        {/* Search status */}
        {isSearchMode && (
          <div className="mb-3 text-xs text-fg/50">
            {isSearching ? (
              <span className="flex items-center gap-1.5">
                <Spinner size="sm" />
                {isLlmSearching ? 'Searching with AI...' : 'Searching...'}
              </span>
            ) : (
              <>
                <span>
                  {searchResults.length === 0
                    ? 'No matching conversations'
                    : `${searchResults.length} conversation${searchResults.length === 1 ? '' : 's'} found`}
                  {searchMode === 'llm' ? ' (AI search)' : ''}
                </span>
                {searchTerms.length > 0 && (
                  <span className="ml-1 text-fg/40">
                    — searched for{' '}
                    {searchTerms.map((t, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        &ldquo;{t}&rdquo;
                      </span>
                    ))}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {!isSearchMode && chats.length === 0 && (
        <div className="flex flex-row items-center justify-center min-h-[50vh]">
          <p className="text-fg/70 text-sm">No chats found.</p>
        </div>
      )}

      {isSearchMode && !isSearching && searchResults.length === 0 && (
        <div className="flex flex-row items-center justify-center min-h-[50vh]">
          <p className="text-fg/70 text-sm">No matching conversations found.</p>
        </div>
      )}

      {displayedChats.length > 0 && (
        <div className="flex flex-col pb-20 lg:pb-2">
          {displayedChats.map((chat, i) => (
            <div
              className={cn(
                'flex flex-col space-y-4 py-6',
                i !== displayedChats.length - 1
                  ? 'border-b border-surface-2'
                  : '',
              )}
              key={chat.id}
            >
              <Link
                href={`/c/${chat.id}`}
                className="lg:text-xl font-medium truncate transition duration-200 cursor-pointer"
              >
                {chat.title}
              </Link>
              {isSearchMode && chat.matchExcerpt && (
                <p className="text-sm text-fg/60 line-clamp-2 -mt-1">
                  <HighlightedExcerpt
                    text={chat.matchExcerpt}
                    terms={
                      searchTerms.length > 0 ? searchTerms : [debouncedQuery]
                    }
                  />
                </p>
              )}
              <div className="flex flex-row items-center justify-between w-full">
                <div className="flex flex-row items-center space-x-1 lg:space-x-1.5 opacity-70">
                  <ClockIcon size={15} />
                  <p className="text-xs">
                    {formatTimeDifference(new Date(), chat.createdAt)} Ago
                  </p>
                </div>
                <DeleteChat
                  chatId={chat.id}
                  chats={isSearchMode ? searchResults : chats}
                  setChats={(newChats) => {
                    if (isSearchMode) {
                      setSearchResults(newChats);
                    } else {
                      setChats(newChats);
                      setOffset((prev) => Math.max(prev - 1, 0));
                    }
                  }}
                />
              </div>
            </div>
          ))}
          {loadingMore && !isSearchMode && (
            <div className="flex flex-row items-center justify-center py-4">
              <Spinner />
            </div>
          )}
          {!isSearchMode && <div ref={sentinelRef} className="h-1" />}
        </div>
      )}
    </div>
  );
};

export default Page;
