"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PostModal } from "@/components/social/PostModal";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { SearchPost } from "@/app/api/search/posts/route";

const PAGE_SIZE = 30;

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
};

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
}

export function SearchModal({ open, onClose, initialQuery = "" }: Props) {
  const { t } = useTranslation();

  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset + focus when modal opens
  useEffect(() => {
    if (!open) return;
    setInput(initialQuery);
    setQuery(initialQuery.trim());
    setSelectedPostId(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open, initialQuery]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounce input → query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(input.trim()), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  // Fetch on query change
  useEffect(() => {
    if (!open) return;
    if (!query) {
      setPosts([]);
      setHasMore(false);
      setOffset(0);
      setError(null);
      setLoading(false);
      return;
    }

    const reqId = ++reqRef.current;
    setLoading(true);
    setError(null);

    fetch(`/api/search/posts?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=0`)
      .then(async (r) => {
        const data = await r.json();
        if (reqId !== reqRef.current) return;
        if (!r.ok) {
          setError(data?.error ?? "Search failed");
          setPosts([]);
          setHasMore(false);
          return;
        }
        setPosts(data.posts ?? []);
        setHasMore(!!data.hasMore);
        setOffset((data.posts ?? []).length);
      })
      .catch((e) => {
        if (reqId !== reqRef.current) return;
        setError(e?.message ?? "Search failed");
      })
      .finally(() => {
        if (reqId === reqRef.current) setLoading(false);
      });
  }, [query, open]);

  const loadMore = useCallback(async () => {
    if (!query || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const reqId = reqRef.current;
    try {
      const r = await fetch(
        `/api/search/posts?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${offset}`
      );
      const data = await r.json();
      if (reqId !== reqRef.current) return;
      if (!r.ok) {
        setError(data?.error ?? "Search failed");
        return;
      }
      setPosts((prev) => [...prev, ...(data.posts ?? [])]);
      setHasMore(!!data.hasMore);
      setOffset((prev) => prev + (data.posts?.length ?? 0));
    } finally {
      setLoadingMore(false);
    }
  }, [query, loadingMore, hasMore, offset]);

  const showIntro = !query && !loading;
  const showEmpty = query && !loading && posts.length === 0 && !error;
  const inputActive = input.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="search-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex flex-col bg-[#fafbfc]"
        >
          {/* Header */}
          <header className="border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2 px-3 py-3">
              <button
                onClick={onClose}
                aria-label="Close search"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
              <div className="relative flex-1">
                <Search
                  size={14}
                  className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors",
                    inputActive ? "text-pink-400" : "text-slate-400"
                  )}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("search_placeholder")}
                  className={cn(
                    "w-full rounded-full border bg-gray-50 py-2.5 pl-9 pr-9 text-[14px] text-slate-800 placeholder-slate-300 outline-none transition-all",
                    inputActive ? "border-pink-300 ring-1 ring-pink-200" : "border-gray-200"
                  )}
                />
                {input && (
                  <button
                    onClick={() => setInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {showIntro && (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-sky-100">
                  <Search size={26} className="text-pink-400" />
                </div>
                <h2 className="mt-4 text-[15px] font-semibold text-slate-700">
                  {t("search_intro_title")}
                </h2>
                <p className="mt-1 max-w-xs text-[13px] text-slate-500">
                  {t("search_intro_sub")}
                </p>
              </div>
            )}

            {loading && (
              <div className="grid grid-cols-3 gap-[1px] bg-gray-100">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-100 shimmer" />
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="px-6 py-12 text-center text-[13px] text-red-500">{error}</div>
            )}

            {showEmpty && (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <Search size={26} className="text-slate-400" />
                </div>
                <h2 className="mt-4 text-[15px] font-semibold text-slate-700">
                  {t("search_no_results_title")}
                </h2>
                <p className="mt-1 max-w-xs text-[13px] text-slate-500">
                  {t("search_no_results_sub")}
                </p>
              </div>
            )}

            {!loading && posts.length > 0 && (
              <ResultsGrid posts={posts} onSelect={setSelectedPostId} />
            )}

            {!loading && posts.length > 0 && hasMore && (
              <div className="flex justify-center px-4 py-6">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 rounded-full bg-[rgb(246,51,154)] px-5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t("search_loading")}
                    </>
                  ) : (
                    t("search_load_more")
                  )}
                </button>
              </div>
            )}
          </div>

          <AnimatePresence>
            {selectedPostId && (
              <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Flat results grid (Instagram-style) ────────────────────────────────────

function ResultsGrid({
  posts,
  onSelect,
}: {
  posts: SearchPost[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-[1px] bg-gray-100">
      {posts.map((p) => (
        <button
          key={p.postId}
          onClick={() => onSelect(p.postId)}
          className="group relative aspect-square overflow-hidden bg-gray-50"
        >
          {p.mediaUrl ? (
            <Image
              src={p.mediaUrl}
              alt=""
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 768px) 33vw, 200px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-50">
              <span className="text-[10px] text-slate-300">No image</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-white">
              <Heart size={10} className="fill-white" />
              {formatCount(p.likesCount)}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-white">
              <MessageCircle size={10} className="fill-white" />
              {formatCount(p.commentsCount)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

