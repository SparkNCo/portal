"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, KeyRound, Link2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type DataSource, type DatabaseStructure, fetchDataSourceStructure } from "@/lib/data-sources-api";

// "View structure" on a connection's card (SPA-491): the tables, columns,
// keys and enum values last read from the client's database — what the AI
// writes SQL from. Loaded only when opened.

type Table = DatabaseStructure["tables"][number];

// `public` is the default schema, so its tables go by their bare name.
function tableLabel(schema: string, name: string) {
  return schema === "public" ? name : `${schema}.${name}`;
}

// The enum a column's type names, matched bare or schema-qualified.
function enumValues(structure: DatabaseStructure, type: string): string[] | null {
  const match = structure.enums.find((e) => type === e.name || type === `${e.schema}.${e.name}`);
  return match?.values ?? null;
}

function TableStructure({ table, structure }: Readonly<{ table: Table; structure: DatabaseStructure }>) {
  const foreignKeyOf = (column: string) => table.foreignKeys.find((fk) => fk.columns.includes(column));

  return (
    <details className="group rounded-md border border-border/60 bg-background/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 smalltext [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
        <span className="font-mono font-medium truncate">{tableLabel(table.schema, table.name)}</span>
        <span className="shrink-0 text-muted-foreground">
          {table.kind !== "table" && `${table.kind} · `}
          {table.columns.length} {table.columns.length === 1 ? "column" : "columns"}
        </span>
      </summary>

      <div className="border-t border-border/60 px-3 py-2 space-y-2">
        {table.comment && <p className="smalltext text-muted-foreground">{table.comment}</p>}
        <div className="overflow-x-auto">
          <table className="w-full smalltext">
            <thead className="sr-only">
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Keys</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((column) => {
                const fk = foreignKeyOf(column.name);
                const values = enumValues(structure, column.type);
                return (
                  <tr key={column.name} className="align-top">
                    <td className="py-1 pr-3 font-mono whitespace-nowrap">{column.name}</td>
                    <td className="py-1 pr-3 font-mono text-muted-foreground">
                      {column.type}
                      {!column.nullable && <span className="sr-only">, required</span>}
                      {values && <span className="block font-sans">{values.join(", ")}</span>}
                    </td>
                    <td className="py-1 text-muted-foreground">
                      <span className="flex flex-wrap gap-x-2">
                        {table.primaryKey.includes(column.name) && (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <KeyRound className="h-3 w-3" aria-hidden="true" />
                            PK
                          </span>
                        )}
                        {fk && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Link2 className="h-3 w-3" aria-hidden="true" />
                            {tableLabel(fk.references.schema, fk.references.table)}.
                            {fk.references.columns[fk.columns.indexOf(column.name)]}
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export function StructureViewer({ dataSource }: Readonly<{ dataSource: DataSource }>) {
  const [open, setOpen] = useState(false);

  const { data: structure, isLoading, error } = useQuery({
    // Re-fetched whenever the structure is read again.
    queryKey: ["data-source-structure", dataSource.id, dataSource.schema_refreshed_at],
    queryFn: () => fetchDataSourceStructure(dataSource.id),
    enabled: open && !!dataSource.schema_path,
  });

  if (!dataSource.schema_path) return null;

  let body: React.ReactNode = null;
  if (isLoading) {
    body = (
      <p className="flex items-center gap-2 smalltext text-muted-foreground" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Loading structure…
      </p>
    );
  } else if (error) {
    body = (
      <p role="alert" className="smalltext text-destructive">
        {(error as Error).message}
      </p>
    );
  } else if (structure && structure.tables.length === 0) {
    body = (
      <p className="smalltext text-muted-foreground">
        No tables this user can read. Check the user&apos;s permissions on the client&apos;s database.
      </p>
    );
  } else if (structure) {
    body = (
      <div className="space-y-1.5">
        {structure.tables.map((table) => (
          <TableStructure key={`${table.schema}.${table.name}`} table={table} structure={structure} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 smalltext font-medium text-primary hover:underline"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} aria-hidden="true" />
        {open ? "Hide structure" : "View structure"}
      </button>
      {open && body}
    </div>
  );
}
