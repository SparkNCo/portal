"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
// of a client's own database. "Test connection" tries them without
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
  sslCa: string;
};

const EMPTY_FORM: FormState = {
  type: "postgres",
  name: "",
  host: "",
  port: "5432",
  database: "",
  username: "",
  password: "",
  // Off by default for a new connection (turn it on, and add the CA where the
  // provider has its own, e.g. Aiven). An edited one shows what it has.
  ssl: false,
  sslCa: "",
};

// A CA certificate file is small; anything bigger isn't one.
const MAX_CA_FILE_BYTES = 20000;

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
    sslCa: dataSource.ssl_ca ?? "",
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
    // Only with SSL: without it nothing is verified.
    ssl_ca: form.ssl ? form.sslCa.trim() : "",
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

  // "Upload file" for the CA certificate: reads it into the field (it's
  // text), so it can still be checked or edited before saving.
  const caFileRef = useRef<HTMLInputElement>(null);
  function readCaFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_CA_FILE_BYTES) {
      toast.error("That file is too big to be a CA certificate.");
      return;
    }
    file
      .text()
      .then((text) => update("sslCa", text.trim()))
      .catch(() => toast.error("Couldn't read that file."));
  }

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

          {form.ssl && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="data-source-ssl-ca">
                  CA certificate <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <div className="flex items-center gap-1">
                  {form.sslCa && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => update("sslCa", "")}>
                      Remove
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2"
                    onClick={() => caFileRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Upload file
                  </Button>
                </div>
              </div>
              <input
                ref={caFileRef}
                type="file"
                accept=".pem,.crt,.cer,text/plain,application/x-pem-file"
                className="hidden"
                onChange={(e) => {
                  readCaFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Textarea
                id="data-source-ssl-ca"
                aria-describedby="data-source-ssl-ca-help"
                placeholder={"-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----"}
                value={form.sslCa}
                onChange={(e) => update("sslCa", e.target.value)}
                className="min-h-[72px] resize-y font-mono text-xs"
                spellCheck={false}
              />
              <p id="data-source-ssl-ca-help" className="smalltext text-muted-foreground">
                Needed when the provider signs with its own certificate (e.g. Aiven, AWS RDS, a self-signed server).
                Download it from the provider&apos;s console (often ca.pem).
              </p>
            </div>
          )}

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
