"use client";

import { FormEvent, useEffect, useState } from "react";
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
    throw new Error("Unexpected response");
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.result === "string") {
    const parsed: unknown = JSON.parse(stripMarkdownFences(record.result));
    if (!isTailorResult(parsed)) {
      throw new Error("Unexpected response");
    }
    return parsed;
  }

  if (isTailorResult(record)) {
    return record;
  }

  throw new Error("Unexpected response");
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
  const [copied, setCopied] = useState(false);

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
      setError("Choose a PDF, DOCX, or TXT file first.");
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
            "This demo is temporarily unavailable. Please try again later."
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
        throw new Error("We couldn't find experience bullets in that CV.");
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCopied(false);

    if (experienceBank.length === 0) {
      setError("Import a CV first so we have experience bullets to tailor from.");
      return;
    }

    const trimmedDescription = jobDescription.trim();
    if (!trimmedDescription) {
      setError("Paste a job description first.");
      return;
    }

    if (trimmedDescription.length > 8000) {
      setError("Job descriptions are limited to 8,000 characters for this demo.");
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
            "This demo is temporarily unavailable. Please try again later."
          )
        );
      }

      if (!response.ok) {
        throw new Error(
          readApiError(payload, "We couldn't tailor your application. Please try again.")
        );
      }

      try {
        setResult(parseTailorResponse(payload));
      } catch {
        throw new Error("We couldn't tailor your application. Please try again.");
      }
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't tailor your application. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyCoverEmail() {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.coverEmail);
      setCopied(true);
    } catch {
      setError("Couldn't copy the email. You can select and copy it manually.");
    }
  }

  const selectedBullets = result
    ? experienceBank.filter((bullet) =>
        result.selectedBulletIds.includes(bullet.id)
      )
    : [];

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-12 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="w-full max-w-2xl">
        <header className="mb-8">
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            JATA
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Tailor your application
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Import your CV, review the extracted bullets, then paste a job
            description. This public demo is rate limited so the Gemini API bill
            stays bounded.
          </p>
        </header>

        <form onSubmit={handleImportCv} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            Your CV
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id="cv-file"
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(event) => setCvFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 dark:file:bg-zinc-800 dark:file:text-zinc-100"
            />
            <button
              type="submit"
              disabled={isParsing}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {isParsing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800 dark:border-zinc-600 dark:border-t-zinc-100" />
                  Parsing...
                </span>
              ) : (
                "Import CV"
              )}
            </button>
          </div>
        </form>

        {experienceBank.length > 0 ? (
          <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
              Extracted experience
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Remove anything that looks wrong before you tailor.
            </p>
            <ul className="mt-4 space-y-3">
              {experienceBank.map((bullet) => (
                <li
                  key={bullet.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-3 dark:border-zinc-800"
                >
                  <div>
                    <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                      {bullet.category}
                    </p>
                    <p className="mt-1 leading-relaxed">{bullet.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteBullet(bullet.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/50"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label htmlFor="job-description" className="sr-only">
            Job description
          </label>
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the job description here..."
            maxLength={8000}
            rows={12}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base leading-relaxed shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
          />
          <button
            type="submit"
            disabled={isLoading || isParsing}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-400 dark:border-t-zinc-900" />
                Generating...
              </span>
            ) : (
              "Tailor My Application"
            )}
          </button>
        </form>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}

        {result ? (
          <section className="mt-8 space-y-4">
            <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
                CV summary
              </h2>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed">
                {result.summary}
              </p>
            </article>

            <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
                  Cover email
                </h2>
                <button
                  type="button"
                  onClick={copyCoverEmail}
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {copied ? "Copied" : "Copy to clipboard"}
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed">
                {result.coverEmail}
              </p>
            </article>

            <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
                Selected experience
              </h2>
              {selectedBullets.length > 0 ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
                  {selectedBullets.map((bullet) => (
                    <li key={bullet.id}>{bullet.text}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-zinc-500">
                  No matching experience bullets were selected.
                </p>
              )}
            </article>
          </section>
        ) : null}
      </main>
    </div>
  );
}
