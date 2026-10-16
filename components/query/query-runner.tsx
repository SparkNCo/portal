"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DataSource } from "@/lib/data-sources-api";
import { type QueryAnswer, askQuestion } from "@/lib/query-api";

// "Ask a question" (SPA-492): pick a connection, ask in plain text, see the
// SQL the AI wrote and the rows it returned. Only connections whose
// structure has been read can be asked — that's what the AI writes from.

const EXAMPLE = "Which 5 products sold the most units this year?";

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ResultTable({ answer }: Readonly<{ answer: QueryAnswer }>) {
  const columns = answer.columns ?? [];
  const rows = answer.rows ?? [];

  if (rows.length === 0) {
    return <p className="smalltext text-muted-foreground">The query ran and returned no rows.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="smalltext text-muted-foreground">
        {answer.truncated ? `Showing the first ${rows.length} rows; more matched.` : `${rows.length} ${rows.length === 1 ? "row" : "rows"}`}
      </p>
      <div className="max-h-[28rem] overflow-auto rounded-md border border-border/60">
        <table className="w-full smalltext tabular-nums">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {columns.map((column, i) => (
                <th key={`${column}-${i}`} scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-border/60 hover:bg-muted/30">
                {row.map((value, c) => (
                  <td
                    key={c}
                    className={`px-3 py-1.5 align-top ${value === null || value === undefined ? "text-muted-foreground" : ""} ${
                      typeof value === "number" ? "text-right" : ""
                    }`}
                  >
                    {formatCell(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QueryRunner({ dataSources }: Readonly<{ dataSources: DataSource[] }>) {
  const askable = dataSources.filter((d) => !!d.schema_path);
  const [chosenId, setChosenId] = useState<string>("");
  const [question, setQuestion] = useState("");
  // The connection asked about: the one picked, or the first available.
  const dataSourceId = askable.some((d) => d.id === chosenId) ? chosenId : (askable[0]?.id ?? "");

  const ask = useMutation({ mutationFn: () => askQuestion(dataSourceId, question.trim()) });
  const answer = ask.data;

  const submit = () => {
    if (dataSourceId && question.trim() && !ask.isPending) ask.mutate();
  };

  return (
    <section aria-labelledby="ask-heading" className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="ask-heading" className="body font-semibold">
          Ask a question
        </h2>
      </div>

      {askable.length === 0 ? (
        <p className="smalltext text-muted-foreground">
          Questions are answered from a connection&apos;s structure. Read the structure of one of the connections below
          (Refresh structure) to start asking.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {askable.length > 1 && (
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="query-connection">Connection</Label>
              <Select value={dataSourceId} onValueChange={setChosenId}>
                <SelectTrigger id="query-connection">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {askable.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="query-question">
              Question{askable.length === 1 && <span className="font-normal text-muted-foreground"> · {askable[0]?.name}</span>}
            </Label>
            <textarea
              id="query-question"
              rows={3}
              maxLength={2000}
              placeholder={EXAMPLE}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                // Enter asks; Shift+Enter adds a line.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="w-full rounded-lg border border-border bg-background smalltext text-foreground placeholder:text-muted-foreground p-2.5 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="smalltext text-muted-foreground">
              Read-only · at most 500 rows · stops after 15 seconds
            </p>
            <Button type="submit" disabled={!question.trim() || ask.isPending}>
              {ask.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {ask.isPending ? "Asking…" : "Ask"}
            </Button>
          </div>
        </form>
      )}

      <div aria-live="polite" className="space-y-3">
        {ask.isError && (
          <p role="alert" className="flex items-start gap-2 smalltext text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            {(ask.error as Error).message}
          </p>
        )}

        {answer && !ask.isPending && (
          <div className="space-y-3 border-t border-border/60 pt-3">
            {answer.explanation && !answer.error && <p className="smalltext">{answer.explanation}</p>}

            {answer.error && (
              <p role="alert" className="flex items-start gap-2 smalltext text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                {answer.error}
              </p>
            )}

            {answer.sql && (
              <details className="group">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 smalltext font-medium text-primary [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
                  SQL used
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-background/60 p-3 smalltext font-mono whitespace-pre-wrap break-words">
                  {answer.sql}
                </pre>
              </details>
            )}

            {!answer.error && <ResultTable answer={answer} />}
          </div>
        )}
      </div>
    </section>
  );
}
