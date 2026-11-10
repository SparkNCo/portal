// Splits an object's text (an issue, a document, a test case) into chunks
// for portal.embeddings, one vector each. gte-small reads only ~512 tokens,
// so a single vector per object left everything past the start of long
// content unsearchable.
//
// How a body is split:
//   1. by markdown headings (# … ######), each heading staying with its text;
//   2. consecutive short sections are packed together up to CHUNK_WORDS;
//   3. a section longer than that is packed paragraph by paragraph, and a
//      paragraph longer than that is cut into CHUNK_WORDS windows that
//      overlap by OVERLAP_WORDS, so a sentence cut at a boundary still
//      appears whole in one of them.
// Every chunk starts with the object's title, so its vector (and anyone
// reading it in a prompt) knows what it belongs to.
//
// No imports: the unit tests load it directly (tests/unit/chunking.spec.ts).

// ~300 words + the title stays under gte-small's ~512-token window.
export const CHUNK_WORDS = 300;
export const OVERLAP_WORDS = 50;
// A huge file can't turn into hundreds of embeddings (each is a model run).
export const MAX_CHUNKS = 40;

export type Chunk = {
  // 0, 1, 2… in reading order; stored as embeddings.chunk_index.
  index: number;
  // What gets embedded and stored as embeddings.content.
  text: string;
};

export type ChunkInput = {
  title: string;
  body?: string | null;
  // Issues: chunk 0 is the title alone (what short searches match against),
  // and the body chunks follow from index 1.
  titleChunk?: boolean;
};

const HEADING = /^#{1,6}\s+\S/;

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Sections: each heading line starts a new one; text before the first
// heading is its own section.
function splitSections(body: string): string[] {
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (HEADING.test(line) && current.some((l) => l.trim())) {
      sections.push(current.join("\n").trim());
      current = [];
    }
    current.push(line);
  }
  if (current.some((l) => l.trim())) {
    sections.push(current.join("\n").trim());
  }
  return sections;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// A paragraph longer than CHUNK_WORDS, as overlapping word windows.
function windows(paragraph: string): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);
  const step = CHUNK_WORDS - OVERLAP_WORDS;
  const out: string[] = [];
  for (let start = 0; start < words.length; start += step) {
    out.push(words.slice(start, start + CHUNK_WORDS).join(" "));
    if (start + CHUNK_WORDS >= words.length) {
      break;
    }
  }
  return out;
}

// Packs pieces (sections or paragraphs) into groups of up to CHUNK_WORDS,
// keeping their order; a piece that alone is too long is split further.
function pack(pieces: string[], splitLong: (piece: string) => string[]): string[] {
  const out: string[] = [];
  let group: string[] = [];
  let groupWords = 0;
  const flush = () => {
    if (group.length) {
      out.push(group.join("\n\n"));
      group = [];
      groupWords = 0;
    }
  };
  for (const piece of pieces) {
    const words = wordCount(piece);
    if (words > CHUNK_WORDS) {
      flush();
      out.push(...splitLong(piece));
      continue;
    }
    if (groupWords + words > CHUNK_WORDS) {
      flush();
    }
    group.push(piece);
    groupWords += words;
  }
  flush();
  return out;
}

// The body's pieces of text, each up to ~CHUNK_WORDS words.
export function splitBody(body: string | null | undefined): string[] {
  if (!body?.trim()) {
    return [];
  }
  const byParagraph = (section: string) => pack(splitParagraphs(section), windows);
  return pack(splitSections(body.trim()), byParagraph);
}

// The object's chunks, ready to embed. Never empty: an object with no body
// still gets one chunk (its title), so it can be found.
export function chunkObject({ title, body, titleChunk = false }: ChunkInput): Chunk[] {
  const cleanTitle = title.trim();
  const texts: string[] = [];
  if (titleChunk) {
    texts.push(cleanTitle);
  }
  for (const piece of splitBody(body)) {
    texts.push(cleanTitle ? `${cleanTitle}\n\n${piece}` : piece);
  }
  if (texts.length === 0) {
    texts.push(cleanTitle);
  }
  return texts.slice(0, MAX_CHUNKS).map((text, index) => ({ index, text }));
}
