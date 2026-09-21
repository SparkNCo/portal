"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { useUser } from "context/UserContext";
import { API_HEADERS } from "@/lib/api-headers";
// Reused as-is from the Design tab's own diagram preview — also runs that
// module's top-level `mermaid.initialize(...)` as an import side effect, so
// there's nothing to configure here.
import { MermaidDiagram } from "@/components/client/design-tab";

// Formats this modal knows how to render — everything else keeps using the
// existing "open in a new tab" behavior (see handleOpen in
// document-list-panel.tsx), since building a renderer for every file type
// (pdf, docx, images, ...) is a different, much bigger project.
export const PREVIEWABLE_FORMATS = new Set(["md", "markdown", "txt", "text", "csv", "mmd", "mermaid"]);

// Minimal RFC4180-ish CSV parser: quoted fields, embedded commas/newlines,
// doubled-quote escaping. Good enough for a preview — not a general-purpose
// CSV library, so no new dependency for this.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function CsvTable({ text }: { readonly text: string }) {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return <p className="smalltext text-muted-foreground">Empty file.</p>;
  }
  const header = rows[0]!;
  const body = rows.slice(1);

  return (
    <div className="custom-scrollbar overflow-auto border border-border rounded-lg">
      <table className="w-full smalltext border-collapse">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="text-left font-semibold px-3 py-2 border-b border-border whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="border-b border-border last:border-b-0 hover:bg-muted/30">
              {r.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type PreviewableDoc = { id: string; name: string; format: string };

export function DocumentPreviewModal({
  doc,
  onClose,
}: {
  readonly doc: PreviewableDoc | null;
  readonly onClose: () => void;
}) {
  const { user } = useUser();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc || !user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    (async () => {
      try {
        // Same signed-URL endpoint the "open in new tab" button already
        // uses (see handleOpen) — permission-checked server-side, so
        // there's nothing new to authorize here.
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/download?document_id=${doc.id}&user_id=${user.id}&inline=true`,
          { headers: API_HEADERS },
        );
        if (!res.ok) throw new Error("Failed to get document link");
        const { url } = await res.json();

        const fileRes = await fetch(url);
        if (!fileRes.ok) throw new Error("Failed to load document contents");
        const text = await fileRes.text();
        if (!cancelled) setContent(text);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Failed to load preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc, user?.id]);

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{doc?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="smalltext text-muted-foreground">{error}</p>
            </div>
          )}

          {!loading && !error && content !== null && doc && (
            <>
              {(doc.format === "md" || doc.format === "markdown") && (
                <div
                  className="smalltext prose prose-sm prose-invert max-w-none leading-relaxed
                  [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2 [&_h1:first-child]:mt-0
                  [&_h2]:smalltext [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2:first-child]:mt-0
                  [&_h3]:smalltext [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5
                  [&_p]:mb-4 [&_p:last-child]:mb-0
                  [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:space-y-1
                  [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:space-y-1
                  [&_code]:smalltext [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted/60 [&_pre]:p-3"
                >
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown>
                </div>
              )}

              {(doc.format === "txt" || doc.format === "text") && (
                <pre className="smalltext whitespace-pre-wrap break-words font-mono bg-muted/40 rounded-lg p-4">
                  {content}
                </pre>
              )}

              {doc.format === "csv" && <CsvTable text={content} />}

              {(doc.format === "mmd" || doc.format === "mermaid") && (
                // Same wrapper design-tab.tsx uses for its own diagram preview.
                <div className="rounded-lg border border-border overflow-hidden min-h-[360px] bg-secondary/20">
                  <MermaidDiagram source={content} />
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
