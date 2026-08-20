"use client";

import { FormEvent } from "react";

type CvUploadCardProps = {
  cvFile: File | null;
  onFileChange: (file: File | null) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isParsing: boolean;
};

export function CvUploadCard({
  cvFile,
  onFileChange,
  onSubmit,
  isParsing,
}: CvUploadCardProps) {
  return (
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

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="relative border-2 border-dashed border-zinc-700/80 hover:border-indigo-500/60 rounded-xl p-4 transition-colors bg-zinc-950/40 text-center">
          <input
            id="cv-file"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
            <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
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
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-all shadow-md shadow-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
  );
}
