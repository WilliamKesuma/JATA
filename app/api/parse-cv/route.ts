import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
import { NextResponse } from "next/server";
import {
  EXPERIENCE_CATEGORIES,
  EXPERIENCE_STRENGTHS,
  MAX_CV_BYTES,
  MAX_CV_CHARS,
  parseExperienceBank,
  type ExperienceBullet,
} from "@/lib/experience";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() as string) : "";
}

function detectKind(
  file: File
): "pdf" | "docx" | "txt" | "unsupported" {
  const name = file.name || "";
  const type = file.type || "";
  const ext = getExtension(name);

  if (ext === "pdf" || type === "application/pdf") {
    return "pdf";
  }

  if (
    ext === "docx" ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  if (ext === "txt" || type === "text/plain") {
    return "txt";
  }

  return "unsupported";
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(unfenced);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "experience";
}

function normalizeBullets(raw: unknown): ExperienceBullet[] {
  const parsed = parseExperienceBank(
    Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && "bullets" in raw
        ? (raw as { bullets: unknown }).bullets
        : null
  );

  if (!parsed) {
    return [];
  }

  const usedIds = new Set<string>();
  return parsed.map((bullet, index) => {
    const fromContext = slugify(`${bullet.context.role}-${bullet.context.org}`);
    let id = bullet.id.trim() || fromContext;
    if (usedIds.has(id)) {
      id = `${id}-${index + 1}`;
    }
    usedIds.add(id);
    return { ...bullet, id };
  });
}

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceRateLimit(request);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: rateLimit.message },
        { status: rateLimit.status }
      );
    }

    const formData = await request.formData();
    const cv = formData.get("cv");

    if (!(cv instanceof File) || cv.size === 0) {
      return NextResponse.json(
        { error: "Upload a CV file in the cv field." },
        { status: 400 }
      );
    }

    if (cv.size > MAX_CV_BYTES) {
      return NextResponse.json(
        { error: "CV files must be 5 MB or smaller." },
        { status: 400 }
      );
    }

    const kind = detectKind(cv);
    if (kind === "unsupported") {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF, DOCX, or TXT file." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await cv.arrayBuffer());

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_key_here") {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in environment variables." },
        { status: 500 }
      );
    }

    const instructions = `You are parsing a CV into structured, high-impact experience bullets for an experience bank.

Instructions:
- Extract all meaningful achievement and impact bullets across ALL sections, including:
  1. Work Experience (engineering, operations, development, analysis).
  2. Leadership & Community Experience (organization coordination, partnerships, team management).
  3. Projects (technical architecture, product roadmaps, stakeholder analysis, full-stack implementations).
  4. Achievements, Keynotes & Speaking (TEDx, workshops, innovation competition awards).
  5. Academic / Thesis achievements (e.g., forecasting models, research pipelines with quantifiable results).
- Use category as one of: ${EXPERIENCE_CATEGORIES.join(", ")}.
- Assign accurate context:
  - role: Job title, project role, coordinator title, or speaker title.
  - org: Company name, institution, project name, or event name.
  - dates: Date range as written in the CV (e.g. "January 2026 - March 2026", "Expected 2026").
- id: Short slug combining role + org (lowercase, hyphenated).
- text: Clean, standalone, impactful bullet starting with an active action verb.
- tags: Array of 3-5 specific technical and functional keywords (e.g. ["aws-cdk", "dynamodb", "lambda", "python"]).
- metrics: Extract the explicit numbers or quantifiable outcome if present (e.g., "86 Lambdas, 14 GSIs, 100+ endpoints", "4.8/5 satisfaction", "40% increase in attendance", "<2% MAPE"), otherwise null.
- strength: Classify as "high" (quantified metrics & major impact), "medium" (clear delivery/responsibility), or "low" (general task).
- Return JSON only: { "bullets": [ ... ] }`;

    let contents: unknown;

    if (kind === "pdf") {
      contents = [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: buffer.toString("base64"),
          },
        },
        instructions,
      ];
    } else if (kind === "docx") {
      let docxText = "";
      try {
        docxText = await extractDocxText(buffer);
      } catch (e) {
        console.error("DOCX extraction error:", e);
        return NextResponse.json(
          { error: "Failed to read DOCX file. Please try another export." },
          { status: 400 }
        );
      }

      if (!docxText.trim()) {
        return NextResponse.json(
          { error: "The uploaded DOCX file contains no text." },
          { status: 400 }
        );
      }

      contents = `${instructions}\n\nCV text:\n${docxText.slice(0, MAX_CV_CHARS)}`;
    } else {
      const txtContent = buffer.toString("utf8").replace(/\u0000/g, "").trim();
      if (!txtContent) {
        return NextResponse.json(
          { error: "The uploaded TXT file is empty." },
          { status: 400 }
        );
      }
      contents = `${instructions}\n\nCV text:\n${txtContent.slice(0, MAX_CV_CHARS)}`;
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.7-flash"];
    let text: string | undefined;
    let lastError: unknown;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: contents as any,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                bullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      category: {
                        type: Type.STRING,
                        enum: [...EXPERIENCE_CATEGORIES],
                      },
                      tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      text: { type: Type.STRING },
                      context: {
                        type: Type.OBJECT,
                        properties: {
                          role: { type: Type.STRING },
                          org: { type: Type.STRING },
                          dates: { type: Type.STRING },
                        },
                        required: ["role", "org", "dates"],
                      },
                      metrics: { type: Type.STRING, nullable: true },
                      strength: {
                        type: Type.STRING,
                        enum: [...EXPERIENCE_STRENGTHS],
                      },
                    },
                    required: [
                      "id",
                      "category",
                      "tags",
                      "text",
                      "context",
                      "metrics",
                      "strength",
                    ],
                  },
                },
              },
              required: ["bullets"],
            },
          },
        });
        if (response.text) {
          text = response.text;
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed in parse-cv, trying fallback...`, err);
      }
    }

    if (!text) {
      throw lastError || new Error("Gemini returned an empty response");
    }

    const bullets = normalizeBullets(parseModelJson(text));
    if (bullets.length === 0) {
      return NextResponse.json(
        { error: "We couldn't find experience bullets in that CV." },
        { status: 400 }
      );
    }

    return NextResponse.json({ bullets });
  } catch (error) {
    console.error("POST /api/parse-cv failed:", error);
    const message = error instanceof Error ? error.message : "Failed to parse CV";
    return NextResponse.json(
      { error: `Failed to parse CV: ${message}` },
      { status: 500 }
    );
  }
}
