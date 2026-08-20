export const EXPERIENCE_CATEGORIES = [
  "cloud-infrastructure",
  "software-mobile",
  "data-analytics",
  "product-operations",
  "leadership-management",
  "speaking-achievements",
  "technical",
] as const;

export const EXPERIENCE_STRENGTHS = ["high", "medium", "low"] as const;

export type ExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number];
export type ExperienceStrength = (typeof EXPERIENCE_STRENGTHS)[number];

export type ExperienceBullet = {
  id: string;
  category: ExperienceCategory;
  tags: string[];
  text: string;
  context: {
    role: string;
    org: string;
    dates: string;
  };
  metrics: string | null;
  strength: ExperienceStrength;
};

export const STORAGE_KEY = "jata-experience-bank";
export const MAX_EXPERIENCE_BULLETS = 60;
export const MAX_CV_CHARS = 50_000;
export const MAX_CV_BYTES = 5 * 1024 * 1024;

function isExperienceCategory(value: unknown): value is ExperienceCategory {
  return (
    typeof value === "string" &&
    (EXPERIENCE_CATEGORIES as readonly string[]).includes(value)
  );
}

function isExperienceStrength(value: unknown): value is ExperienceStrength {
  return (
    typeof value === "string" &&
    (EXPERIENCE_STRENGTHS as readonly string[]).includes(value)
  );
}

export function isExperienceBullet(value: unknown): value is ExperienceBullet {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const context = record.context;

  return (
    typeof record.id === "string" &&
    record.id.trim().length > 0 &&
    isExperienceCategory(record.category) &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string") &&
    typeof record.text === "string" &&
    record.text.trim().length > 0 &&
    Boolean(context) &&
    typeof context === "object" &&
    typeof (context as Record<string, unknown>).role === "string" &&
    typeof (context as Record<string, unknown>).org === "string" &&
    typeof (context as Record<string, unknown>).dates === "string" &&
    (record.metrics === null || typeof record.metrics === "string") &&
    isExperienceStrength(record.strength)
  );
}

function coerceExperienceBullet(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const context =
    record.context && typeof record.context === "object"
      ? (record.context as Record<string, unknown>)
      : {};

  return {
    ...record,
    id: typeof record.id === "string" ? record.id : "",
    category:
      typeof record.category === "string" ? record.category.toLowerCase() : record.category,
    tags: Array.isArray(record.tags)
      ? record.tags.filter((tag) => typeof tag === "string")
      : [],
    text: typeof record.text === "string" ? record.text : "",
    context: {
      role: typeof context.role === "string" ? context.role : "",
      org: typeof context.org === "string" ? context.org : "",
      dates: typeof context.dates === "string" ? context.dates : "",
    },
    metrics:
      record.metrics === undefined || record.metrics === "" ? null : record.metrics,
    strength:
      typeof record.strength === "string"
        ? record.strength.toLowerCase()
        : record.strength,
  };
}

export function parseExperienceBank(value: unknown): ExperienceBullet[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const bullets = value.map(coerceExperienceBullet).filter(isExperienceBullet);
  if (bullets.length === 0) {
    return [];
  }

  return bullets.slice(0, MAX_EXPERIENCE_BULLETS);
}

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
  "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
  "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
  "hasn't", "have", "haven't", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it",
  "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
  "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
  "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
  "should", "shouldn't", "so", "some", "such", "than", "that", "the", "their",
  "theirs", "them", "themselves", "then", "there", "these", "they", "this",
  "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
  "we", "were", "weren't", "what", "when", "where", "which", "while", "who",
  "whom", "why", "with", "won't", "would", "wouldn't", "you", "your", "yours",
  "yourself", "yourselves", "role", "company", "requirements", "seeking", "looking",
  "experience", "years", "candidate", "position", "work", "job"
]);

function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return new Set(words);
}

export function rankRelevantBullets(
  bullets: ExperienceBullet[],
  jobDescription: string,
  maxCount = 20
): ExperienceBullet[] {
  if (bullets.length <= maxCount) {
    return bullets;
  }

  const jobLower = jobDescription.toLowerCase();
  const jobKeywords = extractKeywords(jobDescription);

  const scored = bullets.map((bullet) => {
    let score = 0;

    // 1. Tag matches (high priority: 3 points each)
    for (const tag of bullet.tags) {
      const tagLower = tag.toLowerCase();
      if (jobLower.includes(tagLower) || jobKeywords.has(tagLower)) {
        score += 3.0;
      }
    }

    // 2. Keyword overlap in bullet text and context role (1 point per keyword match)
    const bulletWords = extractKeywords(`${bullet.text} ${bullet.context.role} ${bullet.context.org}`);
    for (const word of bulletWords) {
      if (jobKeywords.has(word)) {
        score += 1.0;
      }
    }

    // 3. Category match (1 point)
    if (jobLower.includes(bullet.category.replace(/-/g, " "))) {
      score += 1.5;
    }

    // 4. Strength boost
    if (bullet.strength === "high") {
      score += 2.0;
    } else if (bullet.strength === "medium") {
      score += 1.0;
    }

    // 5. Quantified outcome / metric boost
    if (bullet.metrics) {
      score += 1.5;
    }

    return { bullet, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxCount).map((item) => item.bullet);
}

export function formatBulletForPrompt(bullet: ExperienceBullet): string {
  const metricsStr = bullet.metrics ? ` | Metrics: ${bullet.metrics}` : "";
  return `- [ID: ${bullet.id} | Tags: ${bullet.tags.join(", ")} | Role: ${bullet.context.role} at ${bullet.context.org}${metricsStr} | Strength: ${bullet.strength}] ${bullet.text}`;
}

