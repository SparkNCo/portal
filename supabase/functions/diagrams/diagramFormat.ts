// @ts-nocheck

// The Design tab's "Diagrams" take Mermaid (.mmd/.mermaid) or Markdown
// (.md/.markdown) files. There's no format column: the stored file's
// extension (diagrams.storage_path, e.g. "diagrams/<service>/v2.md") says
// which one it is, and the Design tab renders it accordingly. Anything else
// is treated as Mermaid, as before.
export function diagramExtension(fileName: string | null | undefined): "md" | "mmd" {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  return ext === "md" || ext === "markdown" ? "md" : "mmd";
}
