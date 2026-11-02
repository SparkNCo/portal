"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TICKET_SYSTEMS, type TicketSettings, type TicketSystem, ticketSettingsComplete, ticketSystemInfo } from "@/lib/ticket-systems";
import { type TicketConnectionResult, testTicketConnection } from "@/lib/ticket-systems-api";

type Props = {
  value: TicketSettings;
  onChange: (next: TicketSettings) => void;
  // Prefix for the inputs' ids, unique per form ("client", "edit-client").
  idPrefix: string;
  // Editing a customer already on Jira: a blank token keeps the stored one.
  customerId?: string;
  hasStoredToken?: boolean;
  // Show "required" hints (after a save attempt).
  showErrors?: boolean;
};

const INPUT_CLASS = "smalltext bg-secondary border-0";

// Ticket system picker for Add/Edit Customer: Linear (a slug in Spark & Co's
// workspace) or Jira (the customer's own site — URL, account email, API
// token and project key), with "Test connection" for Jira.
export function TicketSystemFields({ value, onChange, idPrefix, customerId, hasStoredToken = false, showErrors = false }: Readonly<Props>) {
  const info = ticketSystemInfo(value.system);
  const isJira = value.system === "jira";
  // The last test's result, cleared whenever a field changes.
  const [result, setResult] = useState<TicketConnectionResult | null>(null);

  const update = (patch: Partial<TicketSettings>) => {
    setResult(null);
    onChange({ ...value, ...patch });
  };

  const test = useMutation({
    mutationFn: () => testTicketConnection(value, customerId),
    onSuccess: setResult,
    onError: (err: Error) => setResult({ ok: false, error: err.message }),
  });

  const canTest = isJira && ticketSettingsComplete(value, hasStoredToken);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-ticket-system`} className="smalltext">Ticket System</Label>
        <Select value={value.system} onValueChange={(system) => update({ system: system as TicketSystem })}>
          <SelectTrigger id={`${idPrefix}-ticket-system`} className={INPUT_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_SYSTEMS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-project-id`} className="smalltext">{info.idLabel}</Label>
        <Input
          id={`${idPrefix}-project-id`}
          value={value.projectId}
          onChange={(e) => update({ projectId: isJira ? e.target.value.toUpperCase() : e.target.value })}
          className={INPUT_CLASS}
          placeholder={info.idPlaceholder}
        />
        <p className="smalltext text-muted-foreground">{info.idHelp}</p>
        {showErrors && !value.projectId.trim() && <p className="smalltext text-red-400">{info.idLabel} is required.</p>}
      </div>

      {isJira && (
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="smalltext text-muted-foreground">
            The customer&apos;s Jira site and the account the portal connects with — ideally a bot user with access to this
            project only. Tokens are created at id.atlassian.com → Security → API tokens.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-jira-url`} className="smalltext">Jira URL</Label>
            <Input
              id={`${idPrefix}-jira-url`}
              value={value.jiraBaseUrl}
              onChange={(e) => update({ jiraBaseUrl: e.target.value })}
              className={INPUT_CLASS}
              placeholder="https://acme.atlassian.net"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-jira-email`} className="smalltext">Jira account email</Label>
            <Input
              id={`${idPrefix}-jira-email`}
              type="email"
              value={value.jiraEmail}
              onChange={(e) => update({ jiraEmail: e.target.value })}
              className={INPUT_CLASS}
              placeholder="portal-bot@acme.com"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-jira-token`} className="smalltext">API token</Label>
            <Input
              id={`${idPrefix}-jira-token`}
              type="password"
              value={value.jiraApiToken}
              onChange={(e) => update({ jiraApiToken: e.target.value })}
              className={INPUT_CLASS}
              placeholder={hasStoredToken ? "Saved — leave blank to keep it" : "Paste the API token"}
              autoComplete="new-password"
            />
            {hasStoredToken && (
              <p className="smalltext text-muted-foreground">A changed Jira URL needs the token entered again.</p>
            )}
          </div>

          {showErrors && !ticketSettingsComplete(value, hasStoredToken) && (
            <p className="smalltext text-red-400">Fill in the Jira URL, account email and API token.</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" variant="outline" disabled={!canTest || test.isPending} onClick={() => test.mutate()}>
              {test.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Test connection
            </Button>
            <div aria-live="polite" className="min-w-0 flex-1">
              {result?.ok && (
                <p className="flex items-center gap-2 smalltext text-green-600 dark:text-green-500">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Connected as {result.accountName} · {result.projectName}
                </p>
              )}
              {result && !result.ok && (
                <p className="flex items-start gap-2 smalltext text-destructive">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {result.error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
