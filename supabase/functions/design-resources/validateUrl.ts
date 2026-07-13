// @ts-nocheck

/**
 * Figma URL patterns:
 * - https://www.figma.com/file/{file-id}/{file-name}
 * - https://www.figma.com/design/{file-id}/{file-name}
 * - https://www.figma.com/proto/{file-id}/{file-name}
 */
const FIGMA_URL_REGEX = /^https?:\/\/(www\.)?figma\.com\/(file|design|proto)\/[a-zA-Z0-9]+\/.+/;

/**
 * v0 URL patterns:
 * - https://v0.dev/{id}
 * - https://v0.dev/chat/{chat-id}
 * - https://v0.dev/t/{template-id}
 */
const V0_URL_REGEX = /^https?:\/\/v0\.dev\/(chat\/[a-zA-Z0-9-]+|t\/[a-zA-Z0-9-]+|[a-zA-Z0-9-]+)/;

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validates a design resource URL based on its type
 */
export function validateDesignResourceUrl(
  url: string,
  resourceType: string
): ValidationResult {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "URL is required" };
  }

  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return { valid: false, error: "URL cannot be empty" };
  }

  // Try to parse as URL to check basic validity
  try {
    new URL(trimmedUrl);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (resourceType === "figma") {
    if (!FIGMA_URL_REGEX.test(trimmedUrl)) {
      return {
        valid: false,
        error: "Invalid Figma URL. Expected format: https://www.figma.com/file/...",
      };
    }
    return { valid: true };
  }

  if (resourceType === "v0") {
    if (!V0_URL_REGEX.test(trimmedUrl)) {
      return {
        valid: false,
        error: "Invalid v0 URL. Expected format: https://v0.dev/...",
      };
    }
    return { valid: true };
  }

  return {
    valid: false,
    error: `Unknown resource type: ${resourceType}`,
  };
}
