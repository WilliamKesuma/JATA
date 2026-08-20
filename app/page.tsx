"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  STORAGE_KEY,
  parseExperienceBank,
  type ExperienceBullet,
} from "@/lib/experience";
import { createClient } from "@/lib/supabase/client";
import { Header } from "./components/Header";
import { ErrorBanner } from "./components/ErrorBanner";
import { CvUploadCard } from "./components/CvUploadCard";
import { ExperienceBankExplorer } from "./components/ExperienceBankExplorer";
import { JobDescriptionInput } from "./components/JobDescriptionInput";
import { TailorOutputCard } from "./components/TailorOutputCard";
import { AuthModal } from "./components/AuthModal";
import { type ActiveTab, type TailorResult } from "./components/types";

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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Initialize Auth & Supabase state
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Storage hydration from session/local storage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const sessionRaw = sessionStorage.getItem(STORAGE_KEY);
        const localRaw = localStorage.getItem(STORAGE_KEY);
        const raw = sessionRaw || localRaw;

        if (raw) {
          const restored = parseExperienceBank(JSON.parse(raw));
          if (restored && restored.length > 0) {
            setExperienceBank(restored);
          }
        }

        if (localRaw) {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setHasHydrated(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Sync to sessionStorage
  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(experienceBank));
  }, [experienceBank, hasHydrated]);

  // When user logs in, load cloud saved CVs if available
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) return;

    supabase
      .from("saved_cvs")
      .select("bullets")
      .order("updated_at", { ascending: false })
      .limit(1)
      .then(({ data, error: fetchErr }) => {
        if (!fetchErr && data && data.length > 0 && data[0].bullets) {
          const cloudBullets = parseExperienceBank(data[0].bullets);
          if (cloudBullets && cloudBullets.length > 0) {
            setExperienceBank(cloudBullets);
          }
        }
      });
  }, [user]);

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
        throw new Error(
          "No structured experience bullets could be extracted from that CV."
        );
      }

      setExperienceBank(bullets);
      setResult(null);

      // If logged in, automatically save to cloud
      if (user) {
        const supabase = createClient();
        if (supabase) {
          await supabase.from("saved_cvs").insert({
            user_id: user.id,
            title: cvFile.name.replace(/\.[^/.]+$/, ""),
            bullets,
          });
        }
      }
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
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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

        // If logged in, log to cloud history
        if (user) {
          const supabase = createClient();
          if (supabase) {
            await supabase.from("tailored_history").insert({
              user_id: user.id,
              job_description: trimmedDescription,
              summary: tailored.summary,
              cover_email: tailored.coverEmail,
              selected_bullet_ids: tailored.selectedBulletIds,
            });
          }
        }
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

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Header
        bulletCount={experienceBank.length}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={() => setUser(null)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT PANEL: CV Import & Experience Bank (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            <CvUploadCard
              cvFile={cvFile}
              onFileChange={setCvFile}
              onSubmit={handleImportCv}
              isParsing={isParsing}
            />

            <ExperienceBankExplorer
              experienceBank={experienceBank}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategorySelect={setSelectedCategory}
              onDeleteBullet={deleteBullet}
              onClearAll={clearAllBullets}
            />
          </div>

          {/* RIGHT PANEL: Job Description & Tailoring Output (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            <JobDescriptionInput
              jobDescription={jobDescription}
              onJobDescriptionChange={setJobDescription}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              isParsing={isParsing}
              bulletCount={experienceBank.length}
            />

            <TailorOutputCard
              result={result}
              experienceBank={experienceBank}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onError={setError}
            />
          </div>
        </div>
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          const supabase = createClient();
          if (supabase) {
            supabase.auth.getUser().then(({ data }) => setUser(data.user));
          }
        }}
      />
    </div>
  );
}
