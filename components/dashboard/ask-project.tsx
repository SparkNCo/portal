"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, FileText, FlaskConical, Sparkles, Ticket } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { routeSlugFor } from "@/lib/developer-routes";
import { type AskAnswer, type AskSource, MAX_QUESTION_LENGTH, askProject } from "@/lib/ask-api";
import { isTicketCode } from "@/hooks/use-issue-deep-link";
import { useUser } from "context/UserContext";

// The global query (SPA-582), at the top of the Dashboard: ask anything about
// this project and get a plain-text answer from its documents, test cases and
// issues, with the sources it came from.

const SOURCE_ICON = { document: FileText, test: FlaskConical, issue: Ticket } as const;
const SOURCE_LABEL = { document: "Document", test: "Test case", issue: "Issue" } as const;

// Where a cited source opens: an issue in its ticket modal, with the same
// link as the modal's "Copy link" (Monitor, by ticket number) — on the
// Developer page for developers, who have no Monitor and ask from there.
// Documents open the Documents page. Test cases have no page.
function sourceHref(slug: string, source: AskSource, isDeveloper: boolean): string | null {
  const base = `/${routeSlugFor(slug)}`;
  if (source.type === "issue") {
    // By number (SPA-456) when the source has one, else by id.
    const params = new URLSearchParams(isTicketCode(source.ref) ? { ticket: source.ref.toUpperCase() } : { issueId: source.id });
    return `${base}/${isDeveloper ? "developer" : "monitor"}?${params.toString()}`;
  }
  if (source.type === "document") return `${base}/documents`;
  return null;
}

// What the wait is doing, in the order the backend does it (search the
// sources, fetch the tickets, ask the AI). It's one request, so the steps
// move on by time; the last one stays until the answer is in.
const LOADING_STEPS = [
  { text: "Searching documents, tests and issues…", until: 2000 },
  { text: "Checking the project's tickets…", until: 4500 },
  { text: "Writing the answer…", until: Infinity },
] as const;

// Loading: a sliding bar, the step it's on, and the answer's outline where
// the answer will appear (so the page doesn't jump when it does).
function AskLoading() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(timer);
  }, []);
  const stepText = (LOADING_STEPS.find((s) => elapsed < s.until) ?? LOADING_STEPS[2]).text;
  const bar = "rounded bg-muted-foreground/15";

  return (
    <div className="space-y-3">
      <div
        role="progressbar"
        aria-label="Looking through the project's documents, test cases and issues"
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-primary/30 via-primary to-primary/30 animate-progress-slide motion-reduce:animate-pulse" />
      </div>
      <p className="smalltext flex items-center gap-2 text-muted-foreground" aria-live="polite">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary animate-pulse" aria-hidden="true" />
        {stepText}
      </p>
      <div className="space-y-2 animate-pulse" aria-hidden="true">
        <div className={`${bar} h-3 w-full`} />
        <div className={`${bar} h-3 w-11/12`} />
        <div className={`${bar} h-3 w-2/3`} />
      </div>
    </div>
  );
}

function SourceItem({ slug, source }: Readonly<{ slug: string; source: AskSource }>) {
  const { profile } = useUser();
  const Icon = SOURCE_ICON[source.type];
  const href = sourceHref(slug, source, profile?.role === "developer");
  const label = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="smalltext text-muted-foreground shrink-0">
        {SOURCE_LABEL[source.type]}
        {source.type === "issue" && (
          <>
            {" "}
            <span className="font-medium text-primary">{source.ref}</span>
          </>
        )}
      </span>
      <span className="smalltext font-medium truncate">{source.title}</span>
      {source.status && (
        <span className="smalltext shrink-0">
          <span className="text-muted-foreground">· </span>
          <span className="text-primary">{source.status}</span>
        </span>
      )}
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
          <Button type="submit" disabled={!canAsk} className="shrink-0">
            Ask
          </Button>
        </form>

        {ask.isPending && <AskLoading />}

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
