"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  STORAGE_KEY,
  parseExperienceBank,
  type ExperienceBullet,
} from "@/lib/experience";

type TailorResult = {
  summary: string;
  selectedBulletIds: string[];
  coverEmail: string;
};

const SAMPLE_JOB_DESCRIPTION = `Senior Full Stack Engineer
Company: CloudScale AI
Location: Remote (US / Global)

About the Role:
We are seeking an experienced Senior Full Stack Engineer to lead the development of our high-scale generative AI workflows. You will design resilient distributed microservices, craft intuitive real-time frontend interfaces, and optimize API performance for millions of daily active users.

Requirements:
- 4+ years of experience building modern web applications with TypeScript, React, Next.js, and Node.js.
- Demonstrated experience architecting scalable backend APIs, cloud microservices, and database optimization.
- Strong product sense with an emphasis on speed, clean UI design, and user experience.
- Experience collaborating with cross-functional product and engineering teams.`;

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

function isTailorResult(value: unknown): value is TailorResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.summary === "string" &&
    typeof record.coverEmail === "string" &&
    Array.isArray(record.selectedBulletIds) &&
    record.selectedBulletIds.every((id) => typeof id === "string")
  );
}

function parseTailorResponse(payload: unknown): TailorResult {
  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected response structure");
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.result === "string") {
    const parsed: unknown = JSON.parse(stripMarkdownFences(record.result));
    if (!isTailorResult(parsed)) {
      throw new Error("Invalid tailor result structure");
    }
    return parsed;
  }

  if (isTailorResult(record)) {
    return record;
  }

  throw new Error("Invalid tailor result structure");
}

function readApiError(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [experienceBank, setExperienceBank] = useState<ExperienceBullet[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResult | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"summary" | "email" | "bullets">("summary");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored = parseExperienceBank(JSON.parse(raw));
        if (restored && restored.length > 0) {
          setExperienceBank(restored);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(experienceBank));
  }, [experienceBank, hasHydrated]);

  async function handleImportCv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!cvFile) {
      setError("Please select a PDF, DOCX, or TXT file first.");
      return;
    }

    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append("cv", cvFile);

      const response = await fetch("/api/parse-cv", {
        method: "POST",
        body: formData,
      });
      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 429 || response.status === 503) {
        throw new Error(
          readApiError(
            payload,
            "Service temporarily at capacity. Please try again in a few moments."
          )
        );
      }

      if (!response.ok) {
        throw new Error(
          readApiError(
            payload,
            `Server returned error (${response.status}). Please try again.`
          )
        );
      }

      const bullets =
        payload && typeof payload === "object" && "bullets" in payload
          ? parseExperienceBank(payload.bullets)
          : null;

      if (!bullets || bullets.length === 0) {
        throw new Error("No structured experience bullets could be extracted from that CV.");
      }

      setExperienceBank(bullets);
      setResult(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while parsing the CV."
      );
    } finally {
      setIsParsing(false);
    }
  }

  function deleteBullet(id: string) {
    setExperienceBank((current) => current.filter((bullet) => bullet.id !== id));
  }

  function clearAllBullets() {
    if (confirm("Are you sure you want to clear your experience bank?")) {
      setExperienceBank([]);
      setResult(null);
      setCvFile(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCopiedEmail(false);
    setCopiedSummary(false);

    if (experienceBank.length === 0) {
      setError("Import a CV first so we have your experience bank to tailor from.");
      return;
    }

    const trimmedDescription = jobDescription.trim();
    if (!trimmedDescription) {
      setError("Please paste a job description first.");
      return;
    }

    if (trimmedDescription.length > 8000) {
      setError("Job descriptions are limited to 8,000 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: trimmedDescription,
          experienceBank,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 429 || response.status === 503) {
        throw new Error(
          readApiError(
            payload,
            "Service temporarily at capacity. Please try again shortly."
          )
        );
      }

      if (!response.ok) {
        throw new Error(
          readApiError(
            payload,
            `Failed to tailor application (${response.status}). Please try again.`
          )
        );
      }

      try {
        const tailored = parseTailorResponse(payload);
        setResult(tailored);
        setActiveTab("summary");
      } catch {
        throw new Error("Could not parse tailoring result. Please try again.");
      }
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during tailoring."
      );
    } finally {
      setIsLoading(false);
    }
  }

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
      setError("Could not access clipboard. Please copy manually.");
    }
  }

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

  const categories = useMemo(() => {
    const cats = Array.from(new Set(experienceBank.map((b) => b.category)));
    return ["all", ...cats];
  }, [experienceBank]);

  const selectedBullets = result
    ? experienceBank.filter((bullet) =>
        result.selectedBulletIds.includes(bullet.id)
      )
    : [];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20 font-bold text-white tracking-wider text-base">
              J
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  JATA
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Studio AI
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Intelligent CV Tailoring & Application Studio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {experienceBank.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-zinc-400">Bank:</span>
                <span className="font-semibold text-zinc-200">
                  {experienceBank.length} Bullets
                </span>
              </div>
            )}
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400">
              ⚡ Gemini Powered
            </span>
          </div>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-sm animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center gap-2.5">
              <svg
                className="h-5 w-5 text-red-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300 text-xs uppercase font-medium px-1 py-0.5 rounded"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT PANEL: CV Import & Experience Bank (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            {/* CV Upload Box */}
            <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  CV Document
                </h2>
                <span className="text-[11px] text-zinc-500">PDF, DOCX, TXT (Max 5MB)</span>
              </div>

              <form onSubmit={handleImportCv} className="space-y-4">
                <div className="relative border-2 border-dashed border-zinc-700/80 hover:border-indigo-500/60 rounded-xl p-4 transition-colors bg-zinc-950/40 text-center">
                  <input
                    id="cv-file"
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(event) => setCvFile(event.target.files?.[0] ?? null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-indigo-400">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    {cvFile ? (
                      <div>
                        <p className="text-sm font-medium text-indigo-300 truncate max-w-[260px]">
                          {cvFile.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {(cvFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to parse
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-zinc-300">
                          Click or drag & drop CV file here
                        </p>
                        <p className="text-xs text-zinc-500">
                          Supports PDF with OCR, DOCX, and plain text
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isParsing || !cvFile}
                  className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-all shadow-md shadow-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isParsing ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>Extracting Experience Bullets...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      <span>Extract & Build Bank</span>
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* Experience Bank Explorer */}
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
                    onClick={clearAllBullets}
                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
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
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search keywords, roles, tags..."
                      className="w-full rounded-lg bg-zinc-950/80 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60"
                    />

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`text-[11px] px-2.5 py-1 rounded-md capitalize font-medium whitespace-nowrap transition-colors ${
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
                            onClick={() => deleteBullet(bullet.id)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all text-[11px] p-1"
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
          </div>

          {/* RIGHT PANEL: Job Description & Tailoring Studio (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Job Description Input Canvas */}
            <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-violet-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Target Job Description
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setJobDescription(SAMPLE_JOB_DESCRIPTION)}
                    className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    + Paste Sample Job
                  </button>
                  {jobDescription && (
                    <button
                      type="button"
                      onClick={() => setJobDescription("")}
                      className="text-[11px] text-zinc-500 hover:text-zinc-400"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <textarea
                    id="job-description"
                    value={jobDescription}
                    onChange={(event) => setJobDescription(event.target.value)}
                    placeholder="Paste the target job description or requirements here..."
                    maxLength={8000}
                    rows={8}
                    className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-zinc-600 font-mono">
                    {jobDescription.length} / 8000 chars
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-zinc-500">
                    {experienceBank.length === 0
                      ? "⚠️ Import a CV first to enable tailoring."
                      : `⚡ ${experienceBank.length} bullets available for matching.`}
                  </span>

                  <button
                    type="submit"
                    disabled={isLoading || isParsing || experienceBank.length === 0}
                    className="inline-flex h-11 px-6 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:opacity-90 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Tailoring Application...</span>
                      </>
                    ) : (
                      <>
                        <span>✨ Tailor Application</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* Tailoring Studio Output */}
            {result ? (
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
                      onClick={() => setActiveTab("summary")}
                      className={`px-3 py-1 rounded-md font-medium transition-colors ${
                        activeTab === "summary"
                          ? "bg-indigo-600 text-white"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      CV Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("email")}
                      className={`px-3 py-1 rounded-md font-medium transition-colors ${
                        activeTab === "email"
                          ? "bg-indigo-600 text-white"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Cover Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("bullets")}
                      className={`px-3 py-1 rounded-md font-medium transition-colors ${
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
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
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
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
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
            ) : (
              <div className="rounded-2xl border border-zinc-800/40 bg-zinc-950/30 p-8 text-center">
                <div className="h-12 w-12 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3 text-lg">
                  🎯
                </div>
                <h3 className="text-sm font-semibold text-zinc-300">
                  Ready to Tailor
                </h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Paste the job description above and hit Tailor to generate a tailored CV summary, cover email, and prioritized key qualifications.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
