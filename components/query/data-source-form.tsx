"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type ConnectionDetails,
  type DatabaseEngine,
  DATABASE_ENGINES,
  type DataSource,
  createDataSource,
  testDataSourceConnection,
  updateDataSource,
} from "@/lib/data-sources-api";

// "Connect database" (SPA-488) and "Edit connection" (SPA-489): the details
// of a client's Postgres database. "Test connection" tries them without
// saving; "Save" tests again and stores them (the password in Vault). When
// editing, an empty password keeps the stored one.

type FormState = {
  type: DatabaseEngine;
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

const EMPTY_FORM: FormState = { type: "postgres", name: "", host: "", port: "5432", database: "", username: "", password: "", ssl: true };

const defaultPort = (type: DatabaseEngine) => DATABASE_ENGINES.find((e) => e.value === type)?.defaultPort ?? 5432;

function formFor(dataSource: DataSource | null | undefined): FormState {
  if (!dataSource) return EMPTY_FORM;
  return {
    type: dataSource.type,
    name: dataSource.name,
    host: dataSource.host,
    port: String(dataSource.port),
    database: dataSource.database_name,
    username: dataSource.username,
    password: "",
    ssl: dataSource.ssl,
  };
}

type TestResult = { ok: true } | { ok: false; error: string };

function connectionDetails(form: FormState): ConnectionDetails {
  return {
    type: form.type,
    host: form.host.trim(),
    port: Number(form.port) || defaultPort(form.type),
    database: form.database.trim(),
    username: form.username.trim(),
    password: form.password,
    ssl: form.ssl,
  };
}

// Mount it with a `key` per connection (or "new") so it starts from that
// connection's details.
export function DataSourceForm({
  slug,
  dataSource,
  open,
  onOpenChange,
  onSaved,
}: Readonly<{
  slug: string;
  /** The connection being edited; none to connect a new one. */
  dataSource?: DataSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (dataSource: DataSource) => void;
}>) {
  const editing = !!dataSource;
  const [form, setForm] = useState<FormState>(() => formFor(dataSource));
  // The result of the last "Test connection", cleared when a field changes.
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setForm(formFor(dataSource));
      setTestResult(null);
    }
  };

  const test = useMutation({
    mutationFn: () => testDataSourceConnection(connectionDetails(form), dataSource?.id),
    onSuccess: (error) => setTestResult(error ? { ok: false, error } : { ok: true }),
    onError: (err: Error) => setTestResult({ ok: false, error: err.message }),
  });

  const save = useMutation({
    mutationFn: () => {
      const input = { name: form.name.trim(), ...connectionDetails(form) };
      return dataSource ? updateDataSource(dataSource.id, input) : createDataSource(slug, input);
    },
    onSuccess: (saved) => {
      toast.success(editing ? `Saved changes to "${saved.name}"` : `Connected "${saved.name}"`);
      // Saving also reads the database's structure; the connection is kept
      // even when that part fails.
      if (saved.schema_error) toast.warning(`Couldn't read its structure: ${saved.schema_error}`);
      onSaved?.(saved);
      close(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // A saved connection already has a password.
  const connectionFilled =
    !!form.host.trim() && !!form.database.trim() && !!form.username.trim() && (editing || !!form.password);
  const busy = test.isPending || save.isPending;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit connection" : "Connect database"}</DialogTitle>
          <DialogDescription>
            Use a read-only user: Query only ever reads from this database.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.name.trim() && connectionFilled) save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="data-source-type">Database type</Label>
            <Select
              value={form.type}
              onValueChange={(value) => {
                const type = value as DatabaseEngine;
                // Follow the engine's default port unless one was typed in.
                const portUntouched = form.port === "" || form.port === String(defaultPort(form.type));
                setForm((prev) => ({ ...prev, type, port: portUntouched ? String(defaultPort(type)) : prev.port }));
                setTestResult(null);
              }}
            >
              <SelectTrigger id="data-source-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATABASE_ENGINES.map((engine) => (
                  <SelectItem
                    key={engine.value}
                    value={engine.value}
                    // A saved connection keeps its engine selectable.
                    disabled={!engine.available && engine.value !== dataSource?.type}
                  >
                    {engine.label}
                    {!engine.available && <span className="text-muted-foreground"> · coming soon</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data-source-name">Name</Label>
            <Input
              id="data-source-name"
              placeholder="Production"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="data-source-host">Host</Label>
              <Input
                id="data-source-host"
                placeholder="db.example.com"
                autoComplete="off"
                value={form.host}
                onChange={(e) => update("host", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data-source-port">Port</Label>
              <Input
                id="data-source-port"
                inputMode="numeric"
                value={form.port}
                onChange={(e) => update("port", e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data-source-database">Database</Label>
            <Input
              id="data-source-database"
              autoComplete="off"
              value={form.database}
              onChange={(e) => update("database", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data-source-username">Username</Label>
              <Input
                id="data-source-username"
                autoComplete="off"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data-source-password">Password</Label>
              <Input
                id="data-source-password"
                type="password"
                autoComplete="new-password"
                placeholder={editing ? "Leave empty to keep it" : undefined}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="data-source-ssl"
              checked={form.ssl}
              onCheckedChange={(checked) => update("ssl", checked === true)}
            />
            <Label htmlFor="data-source-ssl" className="font-normal">
              Connect with SSL
            </Label>
          </div>

          <div role="status" aria-live="polite">
            {testResult?.ok && (
              <p className="flex items-center gap-2 smalltext text-green-600 dark:text-green-500">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                Connected successfully.
              </p>
            )}
            {testResult && !testResult.ok && (
              <p className="flex items-start gap-2 smalltext text-destructive">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                {testResult.error}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!connectionFilled || busy}
              onClick={() => test.mutate()}
            >
              {test.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Test connection
            </Button>
            <Button type="submit" disabled={!form.name.trim() || !connectionFilled || busy}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
