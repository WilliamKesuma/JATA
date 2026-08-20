"use client";

import { FormEvent } from "react";

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

type JobDescriptionInputProps = {
  jobDescription: string;
  onJobDescriptionChange: (val: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  isParsing: boolean;
  bulletCount: number;
};

export function JobDescriptionInput({
  jobDescription,
  onJobDescriptionChange,
  onSubmit,
  isLoading,
  isParsing,
  bulletCount,
}: JobDescriptionInputProps) {
  return (
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
            onClick={() => onJobDescriptionChange(SAMPLE_JOB_DESCRIPTION)}
            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
          >
            + Paste Sample Job
          </button>
          {jobDescription && (
            <button
              type="button"
              onClick={() => onJobDescriptionChange("")}
              className="text-[11px] text-zinc-500 hover:text-zinc-400 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={(event) => onJobDescriptionChange(event.target.value)}
            placeholder="Paste the target job description or requirements here..."
            maxLength={8000}
            rows={8}
            className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
          />
          <div className="absolute bottom-3 right-3 text-[10px] text-zinc-600 font-mono">
            {jobDescription.length} / 8000 chars
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col text-xs text-zinc-500 gap-0.5">
            <span>
              {bulletCount === 0
                ? "⚠️ Import a CV first to enable tailoring."
                : `⚡ ${bulletCount} bullets available for matching.`}
            </span>
            <span className="text-[11px] text-zinc-500">
              ℹ️ Public demo allows up to 10 generations per hour.
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading || isParsing || bulletCount === 0}
            className="inline-flex h-11 px-6 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:opacity-90 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50 shrink-0 cursor-pointer"
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
  );
}
