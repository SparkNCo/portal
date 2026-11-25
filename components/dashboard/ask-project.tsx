"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { AlertCircle, FileText, FlaskConical, RotateCcw, SearchX, Sparkles, Ticket } from "lucide-react";
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

// One cited source: a small card with its kind (and ticket code), title and
// status, clickable where it has a page to open.
function SourceItem({ slug, source }: Readonly<{ slug: string; source: AskSource }>) {
  const { profile } = useUser();
  const Icon = SOURCE_ICON[source.type];
  const href = sourceHref(slug, source, profile?.role === "developer");
  const box =
    "flex min-w-0 items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 py-1.5 transition-colors";
  const label = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="smalltext shrink-0 text-muted-foreground">
        {SOURCE_LABEL[source.type]}
        {source.type === "issue" && (
          <>
            {" "}
            <span className="font-semibold text-primary">{source.ref}</span>
          </>
        )}
      </span>
      <span className="smalltext min-w-0 flex-1 truncate font-medium text-foreground">{source.title}</span>
      {source.status && (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {source.status}
        </span>
      )}
    </>
  );
  return (
    <li className="min-w-0">
      {href ? (
        <Link href={href} className={`${box} hover:border-primary/40 hover:bg-muted/60`}>
          {label}
        </Link>
      ) : (
        <span className={box}>{label}</span>
      )}
    </li>
  );
}

// The answer in its own card: an "Answer" heading, the text (lists and bold
// rendered — the AI often answers in bullet points), then the sources.
// "Not found" gets a quieter card of its own.
function AnswerBlock({ slug, result }: Readonly<{ slug: string; result: AskAnswer }>) {
  if (!result.found) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-4" role="status">
        <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="smalltext text-muted-foreground">
          {result.answer ||
            "Nothing in this project's documents, test cases or issues covers that. Try asking it another way."}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4" role="status">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Answer
      </p>
      {/* Styled by hand: there's no typography plugin, and Tailwind's reset
          drops list bullets. */}
      <div className="body text-foreground [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:marker:text-primary [&_strong]:font-semibold [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <ReactMarkdown remarkPlugins={[remarkBreaks]}>{result.answer}</ReactMarkdown>
      </div>
      {result.sources.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Once asked, the question is locked (while it's answered and after), so
  // the answer below always matches the question above it. "Ask another
  // question" starts over. A failed request leaves it editable to try again.
  const locked = ask.isPending || ask.isSuccess;

  const trimmed = question.trim();
  const canAsk = !!slug && trimmed.length > 0 && trimmed.length <= MAX_QUESTION_LENGTH && !locked;

  function submit() {
    if (canAsk) ask.mutate(trimmed);
  }

  function askAnother() {
    ask.reset();
    setQuestion("");
    // After the re-render that makes it editable again.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <Card className="bg-surface text-foreground border-transparent sm:border-surface-line rounded-none sm:rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle level={2} className="body font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Ask about this project
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* One box: a multiline question with the Ask button inside it,
            below the text. The box carries the focus ring for both. */}
        {/* Same look before and after asking: once asked it only stops being
            editable (readOnly below), it isn't dimmed. */}
        <form
          className="rounded-lg bg-card text-card-foreground focus-within:ring-2 focus-within:ring-ring"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="ask-project-question" className="sr-only">
            Your question about this project
          </label>
          <Textarea
            ref={inputRef}
            id="ask-project-question"
            readOnly={locked}
            aria-readonly={locked || undefined}
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
            rows={3}
            aria-describedby="ask-project-keys"
            className="min-h-[88px] resize-none border-0 bg-transparent text-card-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-3">
            <span id="ask-project-keys" className="smalltext text-card-foreground/60">
              {locked ? (
                <span className="hidden sm:inline">
                  {ask.isPending ? "Looking for the answer…" : "Asked. Start over to ask something else."}
                </span>
              ) : (
                <>
                  <span className="hidden sm:inline">Enter to ask · Shift + Enter for a new line</span>
                  <span className="sm:hidden sr-only">Enter to ask</span>
                </>
              )}
            </span>
            {ask.isSuccess ? (
              <Button
                type="button"
                size="sm"
                onClick={askAnother}
                className="shrink-0 bg-primary text-white hover:bg-primary/90"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Ask another question
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={!canAsk} className="shrink-0">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                {ask.isPending ? "Asking…" : "Ask"}
              </Button>
            )}
          </div>
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
