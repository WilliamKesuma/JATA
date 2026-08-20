"use client";

import { useState } from "react";
import { type ExperienceBullet } from "@/lib/experience";
import { type ActiveTab, type TailorResult } from "./types";

type TailorOutputCardProps = {
  result: TailorResult | null;
  experienceBank: ExperienceBullet[];
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onError: (msg: string) => void;
};

export function TailorOutputCard({
  result,
  experienceBank,
  activeTab,
  onTabChange,
  onError,
}: TailorOutputCardProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!result) {
    return (
      <div className="rounded-2xl border border-zinc-800/40 bg-zinc-950/30 p-8 text-center">
        <div className="h-12 w-12 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3 text-lg">
          🎯
        </div>
        <h3 className="text-sm font-semibold text-zinc-300">Ready to Tailor</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
          Paste the job description above and hit Tailor to generate a tailored CV
          summary, cover email, and prioritized key qualifications.
        </p>
      </div>
    );
  }

  const selectedBullets = experienceBank.filter((bullet) =>
    result.selectedBulletIds.includes(bullet.id)
  );

  async function copyToClipboard(text: string, type: "email" | "summary") {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "email") {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2000);
      }
    } catch {
      onError("Could not access clipboard. Please copy manually.");
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-500/30 bg-zinc-900/90 p-5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="font-semibold text-sm text-zinc-200">
            Tailored Studio Output
          </h3>
        </div>

        {/* Tabs Switcher */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => onTabChange("summary")}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === "summary"
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            CV Summary
          </button>
          <button
            type="button"
            onClick={() => onTabChange("email")}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === "email"
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Cover Email
          </button>
          <button
            type="button"
            onClick={() => onTabChange("bullets")}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === "bullets"
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Selected Bullets ({selectedBullets.length})
          </button>
        </div>
      </div>

      {/* Tab: CV Summary */}
      {activeTab === "summary" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-400">
              Tailored 3-4 sentence CV executive profile:
            </p>
            <button
              type="button"
              onClick={() => copyToClipboard(result.summary, "summary")}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
            >
              {copiedSummary ? "✓ Copied" : "📋 Copy Summary"}
            </button>
          </div>
          <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 p-4 text-sm text-zinc-200 leading-relaxed font-sans">
            {result.summary}
          </div>
        </div>
      )}

      {/* Tab: Cover Email */}
      {activeTab === "email" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-400">
              High-impact concise cover email (&lt;150 words):
            </p>
            <button
              type="button"
              onClick={() => copyToClipboard(result.coverEmail, "email")}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
            >
              {copiedEmail ? "✓ Copied" : "📋 Copy Email"}
            </button>
          </div>
          <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 p-4 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-mono text-[13px]">
            {result.coverEmail}
          </div>
        </div>
      )}

      {/* Tab: Selected Experience Bullets */}
      {activeTab === "bullets" && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-400">
            Ranked experience bullets matched to the job requirements:
          </p>
          {selectedBullets.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {selectedBullets.map((bullet) => (
                <div
                  key={bullet.id}
                  className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3.5 text-xs text-zinc-200 leading-relaxed"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-medium text-[10px]">
                      {bullet.category}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {bullet.context.role} • {bullet.context.org}
                    </span>
                  </div>
                  <p>{bullet.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-4 text-center">
              No specific bullet IDs were highlighted.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
