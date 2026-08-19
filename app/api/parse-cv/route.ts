import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
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

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
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
    let extracted = "";

    try {
      if (kind === "pdf") {
        extracted = await extractPdfText(buffer);
      } else if (kind === "docx") {
        extracted = await extractDocxText(buffer);
      } else {
        extracted = buffer.toString("utf8");
      }
    } catch (error) {
      console.error("CV text extraction failed:", error);
      return NextResponse.json(
        { error: "We couldn't read that file. Try a different PDF, DOCX, or TXT export." },
        { status: 400 }
      );
    }

    const cvText = extracted.replace(/\u0000/g, "").trim();
    if (!cvText) {
      return NextResponse.json(
        { error: "That CV looks empty. Try another file with selectable text." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_key_here") {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const prompt = `You are parsing a CV into structured experience bullets.

CV text:
${cvText.slice(0, MAX_CV_CHARS)}

Instructions:
- Extract concrete experience bullets (achievements, responsibilities, projects). Skip contact details, skills lists, and education unless they are written as impact bullets.
- Use category as one of: ${EXPERIENCE_CATEGORIES.join(", ")}.
- id must be a short slug from role + org (lowercase, hyphens).
- text should be a cleaned, standalone bullet.
- tags should be short keywords.
- metrics should be a short string if the bullet has a number/outcome, otherwise null.
- strength is your best guess of how quantified/impactful the bullet is: high, medium, or low.
- Return JSON only: { "bullets": [ ... ] }`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
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

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
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
    return NextResponse.json(
      { error: "Failed to parse CV" },
      { status: 500 }
    );
  }
}
