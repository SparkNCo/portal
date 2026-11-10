"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, FileText, FlaskConical, Loader2, Sparkles, Ticket } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { routeSlugFor } from "@/lib/developer-routes";
import { type AskAnswer, type AskSource, MAX_QUESTION_LENGTH, askProject } from "@/lib/ask-api";

// The global query (SPA-582), at the top of the Dashboard: ask anything about
// this project and get a plain-text answer from its documents, test cases and
// issues, with the sources it came from.

const SOURCE_ICON = { document: FileText, test: FlaskConical, issue: Ticket } as const;
const SOURCE_LABEL = { document: "Document", test: "Test case", issue: "Issue" } as const;

// Where a cited source opens: issues in their ticket modal (Build opens any
// ticket by id), documents on the Documents page. Test cases have no page.
function sourceHref(slug: string, source: AskSource): string | null {
  const base = `/${routeSlugFor(slug)}`;
  if (source.type === "issue") return `${base}/build?issueId=${encodeURIComponent(source.id)}`;
  if (source.type === "document") return `${base}/documents`;
  return null;
}

function SourceItem({ slug, source }: Readonly<{ slug: string; source: AskSource }>) {
  const Icon = SOURCE_ICON[source.type];
  const href = sourceHref(slug, source);
  const label = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="smalltext text-muted-foreground shrink-0">
        {SOURCE_LABEL[source.type]} {source.type === "issue" ? source.ref : ""}
      </span>
      <span className="smalltext font-medium truncate">{source.title}</span>
      {source.status && <span className="smalltext text-muted-foreground shrink-0">· {source.status}</span>}
    </>
  );
  return (
    <li className="min-w-0">
      {href ? (
        <Link href={href} className="flex items-center gap-1.5 min-w-0 rounded-md px-2 py-1 hover:bg-muted">
          {label}
        </Link>
      ) : (
        <span className="flex items-center gap-1.5 min-w-0 px-2 py-1">{label}</span>
      )}
    </li>
  );
}

function AnswerBlock({ slug, result }: Readonly<{ slug: string; result: AskAnswer }>) {
  if (!result.found) {
    return (
      <p className="smalltext text-muted-foreground" role="status">
        {result.answer ||
          "Nothing in this project's documents, test cases or issues covers that. Try asking it another way."}
      </p>
    );
  }
  return (
    <div className="space-y-3" role="status">
      <p className="body whitespace-pre-line">{result.answer}</p>
      {result.sources.length > 0 && (
        <div className="space-y-1">
          <p className="smalltext font-semibold text-muted-foreground">Sources</p>
          <ul className="space-y-0.5">
            {result.sources.map((source) => (
              <SourceItem key={`${source.type}-${source.id}`} slug={slug} source={source} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AskProject({ slug }: Readonly<{ slug: string }>) {
  const [question, setQuestion] = useState("");
  const ask = useMutation({ mutationFn: (q: string) => askProject(slug, q) });

  const trimmed = question.trim();
  const canAsk = !!slug && trimmed.length > 0 && trimmed.length <= MAX_QUESTION_LENGTH && !ask.isPending;

  function submit() {
    if (canAsk) ask.mutate(trimmed);
  }

  return (
    <Card className="bg-background text-foreground border-transparent sm:border-border rounded-none sm:rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle level={2} className="body font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Ask about this project
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="ask-project-question" className="sr-only">
            Your question about this project
          </label>
          <Textarea
            id="ask-project-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. What's left before the login with SSO is done?"
            maxLength={MAX_QUESTION_LENGTH}
            rows={1}
            className="min-h-[40px] resize-none bg-card text-card-foreground"
          />
          <Button type="submit" disabled={!canAsk} className="shrink-0 gap-1.5">
            {ask.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {ask.isPending ? "Thinking…" : "Ask"}
          </Button>
        </form>

        {ask.isPending && (
          <p className="smalltext text-muted-foreground flex items-center gap-1.5" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Looking through the project's documents, test cases and issues…
          </p>
        )}

        {ask.isError && (
          <p className="smalltext text-destructive flex items-start gap-1.5" role="alert">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            {(ask.error as Error).message}
          </p>
        )}

        {ask.isSuccess && <AnswerBlock slug={slug} result={ask.data} />}
      </CardContent>
    </Card>
  );
}
