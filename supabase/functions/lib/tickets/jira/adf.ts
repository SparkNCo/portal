// @ts-nocheck
// Jira Cloud stores descriptions and comments as ADF (Atlassian Document
// Format, a JSON tree); the portal reads and writes Markdown. These convert
// between the two for the parts people actually use — paragraphs,
// headings, lists, code, quotes, links, bold/italic/strike/inline code.
// Anything else degrades to its plain text. No Deno imports (unit-tested).

// ── ADF → Markdown ────────────────────────────────────────────────────────

function inlineToMarkdown(node: any): string {
  switch (node?.type) {
    case "text": {
      let text = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "code") text = `\`${text}\``;
        else if (mark.type === "strong") text = `**${text}**`;
        else if (mark.type === "em") text = `*${text}*`;
        else if (mark.type === "strike") text = `~~${text}~~`;
        else if (mark.type === "link" && mark.attrs?.href) text = `[${text}](${mark.attrs.href})`;
      }
      return text;
    }
    case "hardBreak":
      return "\n";
    case "mention":
      return node.attrs?.text ?? "";
    case "emoji":
      return node.attrs?.text ?? node.attrs?.shortName ?? "";
    case "inlineCard":
      return node.attrs?.url ?? "";
    default:
      return (node?.content ?? []).map(inlineToMarkdown).join("");
  }
}

function listToMarkdown(node: any, ordered: boolean, depth: number): string {
  const indent = "  ".repeat(depth);
  return (node.content ?? [])
    .map((item: any, i: number) => {
      const marker = ordered ? `${i + 1}.` : "-";
      const parts = (item.content ?? []).map((child: any) =>
        child.type === "bulletList" || child.type === "orderedList"
          ? "\n" + listToMarkdown(child, child.type === "orderedList", depth + 1)
          : inlineToMarkdown(child),
      );
      return `${indent}${marker} ${parts.join("")}`;
    })
    .join("\n");
}

function blockToMarkdown(node: any): string {
  switch (node?.type) {
    case "paragraph":
      return inlineToMarkdown(node);
    case "heading":
      return `${"#".repeat(Math.min(Math.max(node.attrs?.level ?? 1, 1), 6))} ${inlineToMarkdown(node)}`;
    case "bulletList":
      return listToMarkdown(node, false, 0);
    case "orderedList":
      return listToMarkdown(node, true, 0);
    case "codeBlock":
      return "```" + (node.attrs?.language ?? "") + "\n" + inlineToMarkdown(node) + "\n```";
    case "blockquote":
      return (node.content ?? []).map(blockToMarkdown).join("\n\n").split("\n").map((line: string) => `> ${line}`).join("\n");
    case "rule":
      return "---";
    case "mediaSingle":
    case "mediaGroup":
      return "";
    case "table":
      return (node.content ?? [])
        .map((row: any) => "| " + (row.content ?? []).map((cell: any) => (cell.content ?? []).map(blockToMarkdown).join(" ")).join(" | ") + " |")
        .join("\n");
    default:
      return node?.content ? (node.content ?? []).map(blockToMarkdown).join("\n\n") : inlineToMarkdown(node);
  }
}

export function adfToMarkdown(doc: any): string {
  if (!doc) return "";
  if (typeof doc === "string") return doc;
  return (doc.content ?? [])
    .map(blockToMarkdown)
    .filter((block: string) => block !== "")
    .join("\n\n")
    .trim();
}

// ── Markdown → ADF ────────────────────────────────────────────────────────

// Inline Markdown is read with a left-to-right scan instead of one big regex:
// the regex rescanned the rest of the line for every unclosed marker
// (super-linear on lines like "[[[[…"). Recognised, in this order at each
// position: **bold**, ~~strike~~, `code`, [label](href), *em*, _em_.

type InlineMatch = { end: number; node: any };

// Finds characters left to right, remembering each answer, so a marker that is
// never closed costs one search for the whole line instead of one per opener.
function charFinder(line: string) {
  const found = new Map<string, number>();
  return (ch: string, from: number): number => {
    const known = found.get(ch);
    if (known !== undefined && (known === -1 || known >= from)) {
      return known;
    }
    const at = line.indexOf(ch, from);
    found.set(ch, at);
    return at;
  };
}

const textNode = (text: string, mark?: any) => (mark ? { type: "text", text, marks: [mark] } : { type: "text", text });

const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);

// "**x**" / "~~x~~": x is non-empty and has no marker character in it.
function matchDouble(line: string, i: number, ch: string, mark: string, next: ReturnType<typeof charFinder>): InlineMatch | null {
  if (line[i + 1] !== ch) {
    return null;
  }
  const close = next(ch, i + 2);
  if (close <= i + 2 || line[close + 1] !== ch) {
    return null;
  }
  return { end: close + 2, node: textNode(line.slice(i + 2, close), { type: mark }) };
}

// "`x`", "*x*", "_x_": x is non-empty; for emphasis it can't start with a space.
function matchSingle(line: string, i: number, ch: string, mark: string, next: ReturnType<typeof charFinder>): InlineMatch | null {
  if (mark === "em" && (line[i + 1] === ch || isSpace(line[i + 1]))) {
    return null;
  }
  const close = next(ch, i + 1);
  if (close <= i + 1) {
    return null;
  }
  return { end: close + 1, node: textNode(line.slice(i + 1, close), { type: mark }) };
}

// "[label](href)": label non-empty, href non-empty with no spaces.
function matchLink(line: string, i: number, next: ReturnType<typeof charFinder>): InlineMatch | null {
  const labelEnd = next("]", i + 1);
  if (labelEnd <= i + 1 || line[labelEnd + 1] !== "(") {
    return null;
  }
  const hrefEnd = next(")", labelEnd + 2);
  const href = line.slice(labelEnd + 2, hrefEnd);
  if (hrefEnd <= labelEnd + 2 || /\s/.test(href)) {
    return null;
  }
  return { end: hrefEnd + 1, node: textNode(line.slice(i + 1, labelEnd), { type: "link", attrs: { href } }) };
}

function matchInline(line: string, i: number, next: ReturnType<typeof charFinder>): InlineMatch | null {
  switch (line[i]) {
    case "*":
      return matchDouble(line, i, "*", "strong", next) ?? matchSingle(line, i, "*", "em", next);
    case "~":
      return matchDouble(line, i, "~", "strike", next);
    case "`":
      return matchSingle(line, i, "`", "code", next);
    case "[":
      return matchLink(line, i, next);
    case "_":
      return matchSingle(line, i, "_", "em", next);
    default:
      return null;
  }
}

function lineNodes(line: string): any[] {
  const nodes: any[] = [];
  const next = charFinder(line);
  let plainStart = 0;
  let i = 0;
  while (i < line.length) {
    const match = matchInline(line, i, next);
    if (!match) {
      i++;
      continue;
    }
    if (i > plainStart) {
      nodes.push(textNode(line.slice(plainStart, i)));
    }
    nodes.push(match.node);
    i = match.end;
    plainStart = i;
  }
  if (line.length > plainStart) {
    nodes.push(textNode(line.slice(plainStart)));
  }
  return nodes;
}

function inlineNodes(text: string): any[] {
  const nodes: any[] = [];
  text.split("\n").forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      nodes.push({ type: "hardBreak" });
    }
    nodes.push(...lineNodes(line));
  });
  return nodes;
}

function paragraph(text: string) {
  const content = inlineNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

// "- item", "* item", "+ item" (bullet) or "1. item", "1) item" (ordered):
// optional indent, the marker, at least one space, then the text. Read by
// hand rather than with a regex (\s+(.*) backtracks on long runs of spaces).
function listItem(line: string): { ordered: boolean; text: string } | null {
  const body = line.trimStart();
  let ordered = false;
  let markerEnd = 1;
  if (!body.startsWith("-") && !body.startsWith("*") && !body.startsWith("+")) {
    let digits = 0;
    while (body[digits] >= "0" && body[digits] <= "9") {
      digits++;
    }
    if (digits === 0 || (body[digits] !== "." && body[digits] !== ")")) {
      return null;
    }
    ordered = true;
    markerEnd = digits + 1;
  }
  const rest = body.slice(markerEnd);
  const text = rest.trimStart();
  if (text.length === rest.length) {
    return null;
  }
  return { ordered, text };
}

// "# Title" … "###### Title": 1–6 "#", at least one space, then the text.
// Read by hand for the same reason as listItem.
function headingOf(line: string): { level: number; text: string } | null {
  let level = 0;
  while (line[level] === "#") {
    level++;
  }
  const rest = line.slice(level);
  const text = rest.trimStart();
  if (level === 0 || level > 6 || text.length === rest.length) {
    return null;
  }
  return { level, text };
}

const QUOTE_RE = /^>\s?/;
const RULE_RE = /^\s*(-{3,}|\*{3,})\s*$/;

// Each reader looks at the block starting at lines[i]: null if it isn't that
// kind of block, otherwise the ADF node and the index of the line after it.
type Block = { node: any; next: number };

function readFence(lines: string[], i: number): Block | null {
  const fence = /^```(\w*)\s*$/.exec(lines[i]);
  if (!fence) {
    return null;
  }
  let end = i + 1;
  while (end < lines.length && !/^```\s*$/.test(lines[end])) {
    end++;
  }
  const code = lines.slice(i + 1, end);
  const node = {
    type: "codeBlock",
    ...(fence[1] && { attrs: { language: fence[1] } }),
    content: code.length ? [{ type: "text", text: code.join("\n") }] : [],
  };
  return { node, next: end + 1 }; // past the closing fence
}

function readHeading(lines: string[], i: number): Block | null {
  const heading = headingOf(lines[i]);
  if (!heading) {
    return null;
  }
  return { node: { type: "heading", attrs: { level: heading.level }, content: inlineNodes(heading.text) }, next: i + 1 };
}

function readRule(lines: string[], i: number): Block | null {
  return RULE_RE.test(lines[i]) ? { node: { type: "rule" }, next: i + 1 } : null;
}

// Consecutive items of the same kind (bullet or ordered) form one list.
function readList(lines: string[], i: number): Block | null {
  const first = listItem(lines[i]);
  if (!first) {
    return null;
  }
  const items: any[] = [];
  let next = i;
  let item: ReturnType<typeof listItem> = first;
  while (item?.ordered === first.ordered) {
    items.push({ type: "listItem", content: [paragraph(item.text)] });
    next++;
    item = next < lines.length ? listItem(lines[next]) : null;
  }
  return { node: { type: first.ordered ? "orderedList" : "bulletList", content: items }, next };
}

function readQuote(lines: string[], i: number): Block | null {
  let next = i;
  const quoted: string[] = [];
  while (next < lines.length && QUOTE_RE.test(lines[next])) {
    quoted.push(lines[next].replace(QUOTE_RE, ""));
    next++;
  }
  return quoted.length ? { node: { type: "blockquote", content: [paragraph(quoted.join("\n"))] }, next } : null;
}

// Lines that end a paragraph: blank, or the start of a fence, heading, list or quote.
function endsParagraph(line: string): boolean {
  return !line.trim() || line.startsWith("```") || !!headingOf(line) || !!listItem(line) || QUOTE_RE.test(line);
}

// A paragraph runs until a blank line or the start of another block. It always
// takes its first line, so a line no other reader accepted (e.g. "```js x")
// can't stop the parse from moving forward.
function readParagraph(lines: string[], i: number): Block {
  let next = i + 1;
  while (next < lines.length && !endsParagraph(lines[next])) {
    next++;
  }
  return { node: paragraph(lines.slice(i, next).join("\n")), next };
}

const BLOCK_READERS = [readFence, readHeading, readRule, readList, readQuote];

export function markdownToAdf(markdown: string | null | undefined): any {
  const lines = String(markdown ?? "").replaceAll("\r\n", "\n").split("\n");
  const content: any[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++;
      continue;
    }
    let block: Block | null = null;
    for (const read of BLOCK_READERS) {
      block ??= read(lines, i);
    }
    block ??= readParagraph(lines, i);
    content.push(block.node);
    i = block.next;
  }

  return { type: "doc", version: 1, content };
}
