"use client";

import { FormEvent, useState } from "react";

const EXPERIENCE_BULLETS = [
  {
    id: "exp-1",
    text: "Led a cross-functional team of 6 to ship a customer-facing dashboard that reduced support tickets by 28%.",
    category: "leadership",
  },
  {
    id: "exp-2",
    text: "Built TypeScript APIs and React frontends for a hiring workflow tool used by 40+ recruiters.",
    category: "engineering",
  },
  {
    id: "exp-3",
    text: "Partnered with hiring managers to rewrite job posts and screening rubrics, improving qualified applicant rate by 19%.",
    category: "product",
  },
] as const;

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

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCopied(false);

    if (!jobDescription.trim()) {
      setError("Paste a job description first.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim() }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 429) {
        throw new Error(
          "You've reached the limit of 10 requests per hour. Please try again later."
        );
      }

      if (!response.ok) {
        throw new Error("We couldn't tailor your application. Please try again.");
      }

      setResult(parseTailorResponse(payload));
    } catch (err) {
      setResult(null);
      const message =
        err instanceof Error && err.message.includes("10 requests per hour")
          ? err.message
          : err instanceof Error && err.message === "Paste a job description first."
            ? err.message
            : "We couldn't tailor your application. Please try again.";
      setError(message);
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
    ? EXPERIENCE_BULLETS.filter((bullet) =>
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
            Paste a job description to generate a CV summary and cover email.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="job-description" className="sr-only">
            Job description
          </label>
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the job description here..."
            rows={12}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base leading-relaxed shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
          />
          <button
            type="submit"
            disabled={isLoading}
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
