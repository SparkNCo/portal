// @ts-nocheck

// The closed option catalogues the diagnostic form exposes. Every value the AI
// returns for prefill/recommend is constrained to (and sanitised against) these
// lists so the frontend never receives an option it can't render.

export const BUILD_TYPES = [
  "web application",
  "mobile application",
  "crypto application",
  "iot device",
  "specialized machinery",
] as const;

export const FUNCTIONALITIES = [
  "analytics",
  "chat",
  "document generation",
  "notifications",
  "search",
  "ai automation",
  "payments",
  "realtime collaboration",
] as const;

export const LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "java",
  "go",
  "rust",
  "c#",
  "solidity",
  "swift",
  "kotlin",
] as const;

export const FRAMEWORKS = [
  "react",
  "next.js",
  "react native",
  "node.js",
  "fastapi",
  "spring boot",
  "django",
  ".net",
  "docker / kubernetes",
  "expo",
] as const;

export const HOSTING = [
  "vercel",
  "supabase",
  "aws",
  "gcp",
  "azure",
  "cloudflare",
  "on-premise",
] as const;

// Keep only known catalogue values, lowercased and de-duplicated while
// preserving order. The AI is constrained by a JSON schema enum, but we defend
// against drift regardless.
export function sanitizeToCatalogue(
  values: unknown,
  catalogue: readonly string[],
): string[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(catalogue);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim().toLowerCase();
    if (allowed.has(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

// Priority markers live on a [-1, 1] square. Clamp anything the AI returns.
export function clampPriority(priority: unknown): { x: number; y: number } {
  const source = (priority ?? {}) as { x?: unknown; y?: unknown };
  const clamp = (n: unknown): number => {
    const value = Number(n);
    if (!Number.isFinite(value)) return 0;
    return Math.max(-1, Math.min(1, value));
  };
  return { x: clamp(source.x), y: clamp(source.y) };
}
