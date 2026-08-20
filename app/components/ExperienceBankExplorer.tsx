"use client";

import { useMemo } from "react";
import { type ExperienceBullet } from "@/lib/experience";

type ExperienceBankExplorerProps = {
  experienceBank: ExperienceBullet[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  onDeleteBullet: (id: string) => void;
  onClearAll: () => void;
};

export function ExperienceBankExplorer({
  experienceBank,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategorySelect,
  onDeleteBullet,
  onClearAll,
}: ExperienceBankExplorerProps) {
  const categories = useMemo(() => {
    const cats = Array.from(new Set(experienceBank.map((b) => b.category)));
    return ["all", ...cats];
  }, [experienceBank]);

  const filteredBullets = useMemo(() => {
    return experienceBank.filter((bullet) => {
      const matchesCategory =
        selectedCategory === "all" || bullet.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        bullet.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bullet.context.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bullet.context.org.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bullet.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [experienceBank, selectedCategory, searchQuery]);

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase flex items-center gap-2">
            <svg
              className="h-4 w-4 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Experience Bank
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {experienceBank.length} structured bullets extracted
          </p>
        </div>

        {experienceBank.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {experienceBank.length > 0 ? (
        <div className="space-y-3">
          {/* Search & Filter */}
          <div className="space-y-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search keywords, roles, tags..."
              className="w-full rounded-lg bg-zinc-950/80 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60"
            />

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategorySelect(cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-md capitalize font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Bullet Cards Scroll Area */}
          <div className="max-h-[520px] overflow-y-auto pr-1 space-y-2.5">
            {filteredBullets.map((bullet) => (
              <div
                key={bullet.id}
                className="group relative rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 hover:border-zinc-700 transition-all text-xs"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium capitalize text-[10px]">
                      {bullet.category}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        bullet.strength === "high"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : bullet.strength === "medium"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                      }`}
                    >
                      {bullet.strength}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteBullet(bullet.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all text-[11px] p-1 cursor-pointer"
                    title="Delete bullet"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-zinc-200 leading-relaxed font-normal">
                  {bullet.text}
                </p>

                <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                  <span className="truncate max-w-[200px]">
                    {bullet.context.role} • {bullet.context.org}
                  </span>
                  {bullet.metrics && (
                    <span className="text-emerald-400/90 font-medium truncate max-w-[140px]">
                      📈 {bullet.metrics}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {filteredBullets.length === 0 && (
              <p className="text-center py-6 text-xs text-zinc-500">
                No bullets match the filter query.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 px-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
          <div className="h-10 w-10 mx-auto rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-600 mb-2">
            📁
          </div>
          <p className="text-xs text-zinc-400 font-medium">
            No experience bullets in bank yet
          </p>
          <p className="text-[11px] text-zinc-600 mt-1">
            Upload your CV above to automatically extract tailored bullet points.
          </p>
        </div>
      )}
    </section>
  );
}
