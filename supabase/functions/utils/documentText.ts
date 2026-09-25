// @ts-nocheck
// Formats this app already knows how to read as plain text — same list as
// PREVIEWABLE_FORMATS in components/documents/document-preview-modal.tsx.
// Kept as its own small module (rather than importing the frontend's set)
// since edge functions and the Next.js app don't share a build step here.
const TEXT_DOCUMENT_EXTENSIONS = new Set([
  "md",
  "markdown",
  "txt",
  "text",
  "csv",
  "mmd",
  "mermaid",
]);

export function isTextDocumentFormat(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_DOCUMENT_EXTENSIONS.has(ext);
}

// Upstash's hosted-embedding endpoint embeds whatever text it's given — a
// generous but finite cap keeps a huge report from blowing out the request
// payload or dominating the embedding with content far past what's useful
// for a similarity match anyway.
const MAX_DOCUMENT_CONTENT_CHARS = 20000;

export function truncateDocumentContent(text: string): string {
  return text.length > MAX_DOCUMENT_CONTENT_CHARS ? text.slice(0, MAX_DOCUMENT_CONTENT_CHARS) : text;
}
