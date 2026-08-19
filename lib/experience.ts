export const EXPERIENCE_CATEGORIES = [
  "technical",
  "business-analysis",
  "leadership",
  "teaching",
  "marketing",
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
