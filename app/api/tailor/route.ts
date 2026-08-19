import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const DUMMY_EXPERIENCE = [
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

type TailorRequestBody = {
  jobDescription?: unknown;
};

type TailorResult = {
  summary: string;
  selectedBulletIds: string[];
  coverEmail: string;
};

function parseModelJson(text: string): TailorResult {
  const trimmed = text.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(unfenced) as TailorResult;

  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.coverEmail !== "string" ||
    !Array.isArray(parsed.selectedBulletIds) ||
    parsed.selectedBulletIds.some((id) => typeof id !== "string")
  ) {
    throw new Error("Model response did not match the expected JSON shape");
  }

  return parsed;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TailorRequestBody;
    const jobDescription =
      typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";

    if (!jobDescription) {
      return NextResponse.json(
        { error: "jobDescription is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_key_here") {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const bulletList = DUMMY_EXPERIENCE.map(
      (bullet) => `- id: ${bullet.id}\n  category: ${bullet.category}\n  text: ${bullet.text}`
    ).join("\n");

    const prompt = `You are helping tailor a CV and cover email to a specific job.

Job description:
${jobDescription}

Candidate experience bullets:
${bulletList}

Instructions:
- Select the most relevant experience bullets for this job.
- Write a 3-4 sentence tailored CV summary.
- Write a cover email under 150 words.
- Respond with JSON only in this exact shape:
{
  "summary": string,
  "selectedBulletIds": string[],
  "coverEmail": string
}
- selectedBulletIds must only include ids from the candidate experience bullets above.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            selectedBulletIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            coverEmail: { type: Type.STRING },
          },
          required: ["summary", "selectedBulletIds", "coverEmail"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    const result = parseModelJson(text);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/tailor failed:", error);
    return NextResponse.json(
      { error: "Failed to tailor CV" },
      { status: 500 }
    );
  }
}
