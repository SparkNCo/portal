"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Loader2, Lock, LockOpen, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type DataSource, deleteDataSource, refreshDataSourceStructure } from "@/lib/data-sources-api";
import { StructureViewer } from "./structure-viewer";

// A client's connected databases (SPA-489): what each one points at, the
// state of its structure (SPA-490) and Refresh structure / Edit / Delete.

function structureStatus(dataSource: DataSource): { label: string; tone: "muted" | "ok" | "error" } {
  if (dataSource.schema_error) return { label: `Couldn't read its structure: ${dataSource.schema_error}`, tone: "error" };
  if (dataSource.schema_refreshed_at) {
    const when = new Date(dataSource.schema_refreshed_at).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return { label: `Structure read ${when}`, tone: "ok" };
  }
  return { label: "Structure not read yet", tone: "muted" };
}

const TONE_CLASS = {
  muted: "text-muted-foreground",
  ok: "text-green-600 dark:text-green-500",
  error: "text-destructive",
};

export function DataSourcesListSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid gap-3 sm:grid-cols-2 animate-pulse">
      <span className="sr-only">Loading connections…</span>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
          <div className="h-4 w-32 rounded bg-muted-foreground/20" />
          <div className="h-3 w-56 max-w-full rounded bg-muted-foreground/20" />
          <div className="h-3 w-40 rounded bg-muted-foreground/20" />
        </div>
      ))}
    </div>
  );
}

export function DataSourcesList({
  dataSources,
  onEdit,
  onChanged,
}: Readonly<{
  dataSources: DataSource[];
  onEdit: (dataSource: DataSource) => void;
  /** After one is deleted or its structure read again. */
  onChanged: () => void;
}>) {
  const [deleting, setDeleting] = useState<DataSource | null>(null);

  const refreshStructure = useMutation({
    mutationFn: (dataSource: DataSource) => refreshDataSourceStructure(dataSource.id),
    onSuccess: (updated) => {
      if (updated.schema_error) toast.error(`Couldn't read the structure of "${updated.name}"`);
      else toast.success(`Read the structure of "${updated.name}"`);
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (dataSource: DataSource) => deleteDataSource(dataSource.id),
    onSuccess: (_data, dataSource) => {
      toast.success(`Deleted "${dataSource.name}"`);
      onChanged();
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <ul className="grid items-start gap-3 sm:grid-cols-2" aria-label="Connected databases">
        {dataSources.map((dataSource) => {
          const status = structureStatus(dataSource);
          return (
            <li key={dataSource.id} className="rounded-lg border border-border/60 bg-muted/30 p-4 flex flex-col gap-2 min-w-0 transition-colors hover:border-primary/50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <h3 className="body font-semibold truncate">{dataSource.name}</h3>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Read the structure of ${dataSource.name} again`}
                    title="Refresh structure"
                    disabled={refreshStructure.isPending}
                    onClick={() => refreshStructure.mutate(dataSource)}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        refreshStructure.isPending && refreshStructure.variables?.id === dataSource.id ? "animate-spin" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Edit ${dataSource.name}`}
                    onClick={() => onEdit(dataSource)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:text-destructive"
                    aria-label={`Delete ${dataSource.name}`}
                    onClick={() => setDeleting(dataSource)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <p className="smalltext text-muted-foreground font-mono break-all">
                {dataSource.username}@{dataSource.host}:{dataSource.port}/{dataSource.database_name}
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 smalltext">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  {dataSource.ssl ? (
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {dataSource.ssl ? "SSL" : "No SSL"}
                </span>
                <span className={TONE_CLASS[status.tone]}>{status.label}</span>
              </div>

              <StructureViewer dataSource={dataSource} />
            </li>
          );
        })}
      </ul>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && !remove.isPending && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              The portal forgets this connection, its password and its structure. The client&apos;s database
              itself isn&apos;t touched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
