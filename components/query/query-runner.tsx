"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DataSource } from "@/lib/data-sources-api";
import { type ConnectionAnswer, type QueryResultTable, askQuestion } from "@/lib/query-api";

// "Ask a question" (SPA-492): ask in plain text and it's asked of every good
// connection at once — one whose structure was read and whose last read
// didn't fail, since the structure is what the AI writes from. The answers
// come back as one response: a single table with every connection's rows,
// each tagged with the database it came from.

const EXAMPLE = "Which 5 products sold the most units this year?";

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  // Objects/arrays (json columns, dates as objects…) as JSON, not "[object Object]".
  return JSON.stringify(value);
}

function rowCountLabel(count: number, truncated: boolean | undefined): string {
  if (truncated) {
    return `Showing the first ${count} rows; more matched.`;
  }
  return `${count} ${count === 1 ? "row" : "rows"}`;
}

function cellClass(value: unknown): string {
  const empty = value === null || value === undefined ? "text-muted-foreground" : "";
  const numeric = typeof value === "number" ? "text-right" : "";
  return `px-3 py-1.5 align-top ${empty} ${numeric}`;
}

// Result rows have no id of their own (and column names can repeat, e.g. two
// "count"), so each answer's columns and rows get one when it arrives.
function withIds<T>(items: T[]): { id: string; item: T }[] {
  return items.map((item) => ({ id: crypto.randomUUID(), item }));
}

function ResultTable({ table }: Readonly<{ table: QueryResultTable }>) {
  const columns = useMemo(() => withIds(table.columns ?? []), [table]);
  const rows = useMemo(() => withIds(table.rows ?? []), [table]);

  if (rows.length === 0) {
    return <p className="smalltext text-muted-foreground">The query ran and returned no rows.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="smalltext text-muted-foreground">{rowCountLabel(rows.length, table.truncated)}</p>
      <div className="max-h-[28rem] overflow-auto rounded-md border border-border/60">
        <table className="w-full smalltext tabular-nums">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {column.item}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border/60 hover:bg-muted/30">
                {columns.map((column, c) => (
                  <td key={column.id} className={cellClass(row.item[c])}>
                    {formatCell(row.item[c])}
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

function ErrorLine({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p role="alert" className="flex items-start gap-2 smalltext text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function SqlUsed({ sql, label = "SQL used" }: Readonly<{ sql: string; label?: string }>) {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 smalltext font-medium text-primary [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
        {label}
      </summary>
      <pre className="mt-2 overflow-x-auto rounded-md bg-background/60 p-3 smalltext font-mono whitespace-pre-wrap break-words">
        {sql}
      </pre>
    </details>
  );
}

// One connection's answer: explanation, SQL, and its rows or why there are none.
function AnswerBlock({ answer, showTable = true }: Readonly<{ answer: ConnectionAnswer; showTable?: boolean }>) {
  const failed = !!answer.error;
  return (
    <div className="space-y-3">
      {answer.explanation && !failed && <p className="smalltext">{answer.explanation}</p>}
      {failed && <ErrorLine>{answer.error}</ErrorLine>}
      {answer.sql && <SqlUsed sql={answer.sql} />}
      {!failed && showTable && (
        <ResultTable table={{ columns: answer.columns ?? [], rows: answer.rows ?? [], truncated: answer.truncated }} />
      )}
    </div>
  );
}

// The single response for 2+ connections.
function CombinedResponse({
  answers,
  combined,
}: Readonly<{ answers: ConnectionAnswer[]; combined: QueryResultTable | null }>) {
  const answered = answers.filter((a) => !a.error);
  const unanswerable = answers.filter((a) => a.unanswerable);
  const failed = answers.filter((a) => a.error && !a.unanswerable);

  return (
    <div className="space-y-4">
      {answered.length === 0 && failed.length === 0 && (
        <p className="smalltext text-muted-foreground">None of the connections hold what this question asks about.</p>
      )}

      {combined && (
        <div className="space-y-3">
          <p className="smalltext">
            Answered from {answered.length} connections: {answered.map((a) => a.dataSourceName).join(", ")}.
          </p>
          <ResultTable table={combined} />
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 smalltext font-medium text-primary [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
              How each connection answered
            </summary>
            <div className="mt-2 space-y-3">
              {answered.map((a) => (
                <div key={a.dataSourceId} className="space-y-1.5">
                  <p className="smalltext font-medium">{a.dataSourceName}</p>
                  <AnswerBlock answer={a} showTable={false} />
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {!combined &&
        answered.map((a) => (
          <section key={a.dataSourceId} aria-label={a.dataSourceName} className="space-y-2">
            <h3 className="smalltext font-semibold">{a.dataSourceName}</h3>
            <AnswerBlock answer={a} />
          </section>
        ))}

      {failed.map((a) => (
        <section key={a.dataSourceId} aria-label={a.dataSourceName} className="space-y-2">
          <h3 className="smalltext font-semibold">{a.dataSourceName || "Unknown connection"}</h3>
          <AnswerBlock answer={a} />
        </section>
      ))}

      {unanswerable.length > 0 && (
        <div className="space-y-1">
          <p className="smalltext text-muted-foreground">Couldn&apos;t be answered from:</p>
          <ul className="space-y-1">
            {unanswerable.map((a) => (
              <li key={a.dataSourceId} className="smalltext text-muted-foreground">
                <span className="font-medium text-foreground">{a.dataSourceName}</span> — {a.explanation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function QueryRunner({ dataSources }: Readonly<{ dataSources: DataSource[] }>) {
  // "Good" connections: structure read, and the last read didn't fail.
  const askable = dataSources.filter((d) => !!d.schema_path && !d.schema_error);
  const [question, setQuestion] = useState("");

  const ask = useMutation({
    mutationFn: () =>
      askQuestion(
        askable.map((d) => d.id),
        question.trim(),
      ),
  });
  const response = ask.data;

  const submit = () => {
    if (askable.length > 0 && question.trim() && !ask.isPending) {
      ask.mutate();
    }
  };

  const askedOf = askable.map((d) => d.name).join(", ");

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
          <div className="space-y-1.5">
            <Label htmlFor="query-question">
              Question <span className="font-normal text-muted-foreground">· {askedOf}</span>
            </Label>
            <textarea
              id="query-question"
              rows={3}
              maxLength={2000}
              // Locked while the question is being answered (good or error).
              readOnly={ask.isPending}
              aria-busy={ask.isPending}
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
              className="w-full rounded-lg border border-border bg-background smalltext text-foreground placeholder:text-muted-foreground p-2.5 resize-y focus:outline-none focus:ring-1 focus:ring-ring read-only:cursor-not-allowed read-only:opacity-60"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="smalltext text-muted-foreground">
              Read-only · at most 500 rows per connection · stops after 15 seconds
            </p>
            <Button type="submit" disabled={!question.trim() || ask.isPending}>
              {ask.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {ask.isPending ? "Asking…" : "Ask"}
            </Button>
          </div>
        </form>
      )}

      <div aria-live="polite" className="space-y-3">
        {ask.isError && <ErrorLine>{(ask.error as Error).message}</ErrorLine>}

        {response && !ask.isPending && (
          <div className="border-t border-border/60 pt-3">
            {response.answers.length === 1 && response.answers[0] ? (
              <AnswerBlock answer={response.answers[0]} />
            ) : (
              <CombinedResponse answers={response.answers} combined={response.combined} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
