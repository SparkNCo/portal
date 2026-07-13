import type { DesignResourceType } from "@/components/client/design-resources.types";

/**
 * Figma URL patterns:
 * - https://www.figma.com/file/{file-id}/{file-name}
 * - https://www.figma.com/design/{file-id}/{file-name}
 * - https://www.figma.com/proto/{file-id}/{file-name}
 * - https://www.figma.com/board/{board-id}/{board-name} (FigJam)
 * - https://figma.com/file/{file-id}/{file-name}
 */
const FIGMA_URL_REGEX = /^https?:\/\/(www\.)?figma\.com\/(file|design|proto|board)\/[a-zA-Z0-9]+\/.+/;

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
  type?: DesignResourceType;
};

/**
 * Validates a design resource URL and determines its type
 */
export function validateDesignResourceUrl(url: string): ValidationResult {
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

  // Check if it's a Figma URL
  if (FIGMA_URL_REGEX.test(trimmedUrl)) {
    return { valid: true, type: "figma" };
  }

  // Check if it's a v0 URL
  if (V0_URL_REGEX.test(trimmedUrl)) {
    return { valid: true, type: "v0" };
  }

  return {
    valid: false,
    error: "URL must be a valid Figma or v0 link",
  };
}

/**
 * Validates a Figma URL specifically
 */
export function isFigmaUrl(url: string): boolean {
  return FIGMA_URL_REGEX.test(url);
}

/**
 * Validates a v0 URL specifically
 */
export function isV0Url(url: string): boolean {
  return V0_URL_REGEX.test(url);
}

/**
 * Extracts a display name from a Figma URL
 * Example: https://www.figma.com/file/abc123/My-Design-File -> "My Design File"
 */
export function extractFigmaFileName(url: string): string | null {
  try {
    const match = url.match(/figma\.com\/(?:file|design|proto|board)\/[^/]+\/([^/?#]+)/);
    if (match?.[1]) {
      // Replace hyphens and underscores with spaces, decode URI components
      return decodeURIComponent(match[1].replace(/[-_]/g, " "));
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Extracts the file ID from a Figma URL
 */
export function extractFigmaFileId(url: string): string | null {
  try {
    const match = url.match(/figma\.com\/(?:file|design|proto|board)\/([^/]+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Gets the embed URL for a Figma file
 * Figma embed URLs: https://www.figma.com/embed?embed_host=share&url={encoded-url}
 */
export function getFigmaEmbedUrl(url: string): string {
  const encodedUrl = encodeURIComponent(url);
  return `https://www.figma.com/embed?embed_host=share&url=${encodedUrl}`;
}

/**
 * Gets a display title for a v0 URL
 * Example: https://v0.dev/chat/abc-123 -> "v0 Chat: abc-123"
 */
export function getV0DisplayTitle(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    
    if (pathParts.length === 0) {
      return "v0 Design";
    }
    
    if (pathParts[0] === "chat") {
      return `v0 Chat: ${pathParts[1] || ""}`;
    }
    
    if (pathParts[0] === "t") {
      return `v0 Template: ${pathParts[1] || ""}`;
    }
    
    return `v0 Design: ${pathParts[0]}`;
  } catch {
    return "v0 Design";
  }
}
