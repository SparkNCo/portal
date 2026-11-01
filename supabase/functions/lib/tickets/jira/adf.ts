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

const INLINE_RE = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/;

function inlineNodes(text: string): any[] {
  const nodes: any[] = [];
  const lines = text.split("\n");
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) nodes.push({ type: "hardBreak" });
    for (const part of line.split(INLINE_RE)) {
      if (!part) continue;
      let node: any;
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) node = { type: "text", text: part.slice(2, -2), marks: [{ type: "strong" }] };
      else if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) node = { type: "text", text: part.slice(2, -2), marks: [{ type: "strike" }] };
      else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) node = { type: "text", text: part.slice(1, -1), marks: [{ type: "code" }] };
      else if (/^\[[^\]]+\]\([^)\s]+\)$/.test(part)) {
        const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)!;
        node = { type: "text", text: label, marks: [{ type: "link", attrs: { href } }] };
      } else if (((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) && part.length > 2) {
        node = { type: "text", text: part.slice(1, -1), marks: [{ type: "em" }] };
      } else node = { type: "text", text: part };
      nodes.push(node);
    }
  });
  return nodes;
}

function paragraph(text: string) {
  const content = inlineNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

const BULLET_RE = /^\s*[-*+]\s+(.*)$/;
const ORDERED_RE = /^\s*\d+[.)]\s+(.*)$/;

export function markdownToAdf(markdown: string | null | undefined): any {
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const content: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence
      content.push({
        type: "codeBlock",
        ...(fence[1] && { attrs: { language: fence[1] } }),
        content: code.length ? [{ type: "text", text: code.join("\n") }] : [],
      });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      content.push({ type: "heading", attrs: { level: heading[1].length }, content: inlineNodes(heading[2]) });
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      content.push({ type: "rule" });
      i++;
      continue;
    }

    if (BULLET_RE.test(line) || ORDERED_RE.test(line)) {
      const ordered = !BULLET_RE.test(line);
      const re = ordered ? ORDERED_RE : BULLET_RE;
      const items: any[] = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push({ type: "listItem", content: [paragraph(re.exec(lines[i])![1])] });
        i++;
      }
      content.push({ type: ordered ? "orderedList" : "bulletList", content: items });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quoted.push(lines[i++].replace(/^>\s?/, ""));
      content.push({ type: "blockquote", content: [paragraph(quoted.join("\n"))] });
      continue;
    }

    // A paragraph runs until a blank line or the start of another block.
    const text: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !BULLET_RE.test(lines[i]) &&
      !ORDERED_RE.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      text.push(lines[i++]);
    }
    content.push(paragraph(text.join("\n")));
  }

  return { type: "doc", version: 1, content };
}
