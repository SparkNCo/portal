// @ts-nocheck
import mammoth from "npm:mammoth@1.13.0";
import { Buffer } from "node:buffer";

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

const WORD_EXTENSIONS = new Set(["docx"]);

// Formats whose content search can read: the text ones, plus Word (.docx).
export function isSearchableDocumentFormat(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_DOCUMENT_EXTENSIONS.has(ext) || WORD_EXTENSIONS.has(ext);
}

// A document's text for search, truncated — or null for formats we can't
// read (pdf, images) or a file that isn't what its extension says (e.g. a
// text file renamed to .docx).
export async function extractDocumentText(fileName: string, file: Blob): Promise<string | null> {
  try {
    if (isTextDocumentFormat(fileName)) return truncateDocumentContent(await file.text());
    if (isSearchableDocumentFormat(fileName)) {
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) });
      return value.trim() ? truncateDocumentContent(value) : null;
    }
  } catch (err) {
    console.error(`[extractDocumentText] couldn't read ${fileName}:`, err);
  }
  return null;
}
