import { isIP } from "node:net";

export const IP_LIMIT_PER_HOUR = 10;
export const GLOBAL_LIMIT_PER_DAY = 150;
export const MIN_INTERVAL_MS = 10_000;
export const MAX_JOB_DESCRIPTION_CHARS = 8000;

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; status: 429 | 503; message: string };

const memoryHour = new Map<string, number[]>();
const memoryCooldown = new Map<string, number>();
let memoryDay: { start: number; count: number } = { start: 0, count: 0 };

function hasUpstash(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function getClientIp(request: Request): string {
  const candidates = [
    request.headers.get("x-vercel-forwarded-for")?.split(",").pop()?.trim(),
    request.headers.get("x-real-ip")?.trim(),
    request.headers.get("cf-connecting-ip")?.trim(),
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim(),
  ];

  for (const value of candidates) {
    if (value && isIP(value)) {
      return value;
    }
  }

  return "127.0.0.1";
}

async function upstash(command: (string | number)[]): Promise<unknown> {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL as string, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Upstash request failed");
  }

  return payload.result;
}

function checkMemory(ip: string): RateLimitDecision {
  const now = Date.now();
  const cooldownUntil = memoryCooldown.get(ip) ?? 0;
  if (cooldownUntil > now) {
    return {
      ok: false,
      status: 429,
      message: "Please wait a few seconds before generating again.",
    };
  }

  const hourStart = now - 60 * 60 * 1000;
  const hourHits = (memoryHour.get(ip) ?? []).filter((time) => time > hourStart);
  if (hourHits.length >= IP_LIMIT_PER_HOUR) {
    memoryHour.set(ip, hourHits);
    return {
      ok: false,
      status: 429,
      message: `This demo allows ${IP_LIMIT_PER_HOUR} generations per hour per visitor. Please try again later.`,
    };
  }

  const dayStart = now - 24 * 60 * 60 * 1000;
  if (memoryDay.start < dayStart) {
    memoryDay = { start: now, count: 0 };
  }
  if (memoryDay.count >= GLOBAL_LIMIT_PER_DAY) {
    return {
      ok: false,
      status: 429,
      message:
        "This public demo has reached today's generation limit. Please try again tomorrow.",
    };
  }

  hourHits.push(now);
  memoryHour.set(ip, hourHits);
  memoryDay.count += 1;
  memoryCooldown.set(ip, now + MIN_INTERVAL_MS);
  return { ok: true };
}

async function checkRedis(ip: string): Promise<RateLimitDecision> {
  const cooldownKey = `jata:cd:${ip}`;
  const hourKey = `jata:ip:${ip}`;
  const dayKey = "jata:global:day";

  const coolingDown = await upstash(["GET", cooldownKey]);
  if (coolingDown) {
    return {
      ok: false,
      status: 429,
      message: "Please wait a few seconds before generating again.",
    };
  }

  const ipCount = Number(await upstash(["INCR", hourKey]));
  if (ipCount === 1) {
    await upstash(["EXPIRE", hourKey, 3600]);
  }
  if (ipCount > IP_LIMIT_PER_HOUR) {
    return {
      ok: false,
      status: 429,
      message: `This demo allows ${IP_LIMIT_PER_HOUR} generations per hour per visitor. Please try again later.`,
    };
  }

  const globalCount = Number(await upstash(["INCR", dayKey]));
  if (globalCount === 1) {
    await upstash(["EXPIRE", dayKey, 86400]);
  }
  if (globalCount > GLOBAL_LIMIT_PER_DAY) {
    return {
      ok: false,
      status: 429,
      message:
        "This public demo has reached today's generation limit. Please try again tomorrow.",
    };
  }

  await upstash(["SET", cooldownKey, "1", "PX", MIN_INTERVAL_MS]);
  return { ok: true };
}

export async function enforceRateLimit(request: Request): Promise<RateLimitDecision> {
  const ip = getClientIp(request);

  if (hasUpstash()) {
    return checkRedis(ip);
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[Security Warning] UPSTASH_REDIS_REST_URL is not set. In-memory rate limiting is ineffective in multi-instance or serverless environments."
    );
  }

  // Gracefully fallback to in-memory rate limiting
  return checkMemory(ip);
}
