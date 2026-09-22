"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { useUser } from "context/UserContext";
import { API_HEADERS } from "@/lib/api-headers";
import { cn } from "@/lib/utils";
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

const MIN_MERMAID_ZOOM = 0.25;
const MAX_MERMAID_ZOOM = 3;
const MERMAID_ZOOM_STEP = 0.25;

// CSS `zoom` (the first thing tried here) measurably shrank the diagram as
// the percentage went *up* — mermaid.render() sets the svg's own width as a
// percentage/max-width of its container, and that percentage re-resolves
// inside a zoomed box in a way that fights the zoom factor instead of
// compounding with it. `transform: scale()` doesn't have that problem (it's
// a pure post-layout paint transform, blind to how the content sized itself),
// but it also doesn't grow the scrollable area on its own the way `zoom`
// does — so this measures the diagram's natural (zoom=1) pixel size once via
// ResizeObserver, then sizes an explicit wrapper box to `natural * zoom` and
// scales a natural-sized inner box up/down to fill it. That keeps scrolling
// to see clipped edges working at any zoom level.
function ZoomableMermaid({ source, zoom }: { readonly source: string; readonly zoom: number }) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setNaturalSize(null);
  }, [source]);

  useEffect(() => {
    if (naturalSize) return;
    const el = innerRef.current;
    if (!el) return;
    // mermaid.render() resolves asynchronously (see MermaidDiagram), so the
    // svg isn't necessarily in the DOM yet on the first paint after `source`
    // changes — a ResizeObserver catches it whenever it actually lands, then
    // disconnects itself (via the cleanup below) once measured.
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setNaturalSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [naturalSize]);

  return (
    <div style={naturalSize ? { width: naturalSize.width * zoom, height: naturalSize.height * zoom } : undefined}>
      <div
        ref={innerRef}
        style={
          naturalSize
            ? {
                width: naturalSize.width,
                height: naturalSize.height,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }
            : undefined
        }
      >
        <MermaidDiagram source={source} />
      </div>
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
  // `user_id` here is checked against document_permissions.user_id, which is
  // keyed by portal.users.id — that's `profile.id`, not the raw Supabase
  // Auth uid `useUser()` also exposes as `user.id` (see
  // 20260921140000_fix_chat_rls_match_by_email.sql for why those two ids
  // don't line up in this app). Sending the auth uid here made the
  // permission check silently fail every time, surfacing as "Failed to get
  // document link".
  const { profile } = useUser();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mermaidZoom, setMermaidZoom] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!doc || !profile?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    setMermaidZoom(1);

    (async () => {
      try {
        // Same signed-URL endpoint the "open in new tab" button already
        // uses (see handleOpen) — permission-checked server-side, so
        // there's nothing new to authorize here.
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/download?document_id=${doc.id}&user_id=${profile.id}&inline=true`,
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
  }, [doc, profile?.id]);

  const zoomIn = () => setMermaidZoom((prev) => Math.min(MAX_MERMAID_ZOOM, prev + MERMAID_ZOOM_STEP));
  const zoomOut = () => setMermaidZoom((prev) => Math.max(MIN_MERMAID_ZOOM, prev - MERMAID_ZOOM_STEP));
  const resetZoom = () => setMermaidZoom(1);

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex flex-col",
          isExpanded ? "max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh]" : "max-w-4xl max-h-[90vh]",
        )}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="absolute right-12 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={isExpanded ? "Exit full screen" : "Expand"}
        >
          {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        <DialogHeader>
          <DialogTitle className="truncate pr-6">{doc?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto custom-scrollbar flex flex-col">
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
                <div className="space-y-2 flex flex-1 min-h-0 flex-col">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={zoomOut}
                      disabled={mermaidZoom <= MIN_MERMAID_ZOOM}
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <button
                      type="button"
                      onClick={resetZoom}
                      className="smalltext w-12 text-center text-muted-foreground hover:text-primary"
                      aria-label="Reset zoom"
                    >
                      {Math.round(mermaidZoom * 100)}%
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={zoomIn}
                      disabled={mermaidZoom >= MAX_MERMAID_ZOOM}
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={resetZoom}
                      disabled={mermaidZoom === 1}
                      aria-label="Reset zoom"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Own scrollbars so a zoomed-in diagram can be panned
                      instead of clipped. flex-1 so it fills whatever height
                      the dialog has to offer (more once expanded) instead of
                      stopping at min-h's floor. */}
                  <div className="custom-scrollbar rounded-lg border border-border overflow-auto min-h-[360px] flex-1 bg-secondary/20">
                    <ZoomableMermaid source={content} zoom={mermaidZoom} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
