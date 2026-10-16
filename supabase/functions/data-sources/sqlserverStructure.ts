// @ts-nocheck
// Turns SQL Server's catalog rows (see sqlserver.ts) into the same structure
// JSON Postgres connections produce (introspect.ts). SQL Server has no enum
// types; a CHECK that limits a column to fixed values (status IN ('paid',
// 'cancelled')) is recorded on the column as `values` instead, so the AI
// still knows them. No imports, so the unit tests can load it.

const KINDS: Record<string, string> = { "BASE TABLE": "table", VIEW: "view" };

// "nvarchar" + 100 → "nvarchar(100)", "decimal" + 10, 2 → "decimal(10,2)".
export function sqlServerType(row: any): string {
  const type = String(row.data_type);
  if (["char", "varchar", "nchar", "nvarchar", "binary", "varbinary"].includes(type)) {
    return `${type}(${row.max_length === -1 ? "max" : row.max_length})`;
  }
  if (type === "decimal" || type === "numeric") return `${type}(${row.precision},${row.scale})`;
  return type;
}

// The values a CHECK allows, when it only compares one column with fixed
// values: SQL Server stores `status IN ('a', 'b')` as
// "([status]='a' OR [status]='b')". Null for any other kind of CHECK.
export function checkValues(definition: string): { column: string; values: string[] } | null {
  const comparison = /\[([^\]]+)\]\s*=\s*N?'((?:[^']|'')*)'/g;
  const matches = [...definition.matchAll(comparison)];
  if (!matches.length) return null;

  const column = matches[0]![1]!;
  if (matches.some((m) => m[1] !== column)) return null;
  // Nothing else may be in there (no ranges, functions, AND…).
  const rest = definition.replace(comparison, "").replace(/\bOR\b/gi, "").replace(/[()\s]/g, "");
  if (rest) return null;

  return { column, values: matches.map((m) => m[2]!.replace(/''/g, "'")) };
}

export function buildSqlServerStructure(
  { columns, primaryKeys, foreignKeys, checks }: { columns: any[]; primaryKeys: any[]; foreignKeys: any[]; checks: any[] },
  dataSourceId: string,
  database: string,
) {
  const tables = new Map<string, any>();
  const keyOf = (schema: string, table: string) => `${schema}.${table}`;

  for (const row of columns) {
    const key = keyOf(row.schema, row.table);
    if (!tables.has(key)) {
      tables.set(key, {
        schema: row.schema,
        name: row.table,
        kind: KINDS[row.kind] ?? "table",
        comment: row.table_comment ?? null,
        columns: [],
        primaryKey: [],
        foreignKeys: [],
      });
    }
    tables.get(key).columns.push({
      name: row.column,
      type: sqlServerType(row),
      nullable: row.is_nullable === "YES",
      comment: row.column_comment ?? null,
    });
  }

  for (const row of primaryKeys) tables.get(keyOf(row.schema, row.table))?.primaryKey.push(row.column);

  // One row per column of each foreign key, in order; group them by key.
  const byKey = new Map<string, any>();
  for (const row of foreignKeys) {
    const table = tables.get(keyOf(row.schema, row.table));
    if (!table) continue;
    const id = `${row.schema}.${row.fk_name}`;
    if (!byKey.has(id)) {
      const fk = { columns: [], references: { schema: row.ref_schema, table: row.ref_table, columns: [] } };
      byKey.set(id, fk);
      table.foreignKeys.push(fk);
    }
    byKey.get(id).columns.push(row.column);
    byKey.get(id).references.columns.push(row.ref_column);
  }

  for (const row of checks) {
    const allowed = checkValues(String(row.definition ?? ""));
    const column = allowed && tables.get(keyOf(row.schema, row.table))?.columns.find((c: any) => c.name === allowed.column);
    if (column) column.values = allowed.values;
  }

  return {
    dataSourceId,
    database,
    refreshedAt: new Date().toISOString(),
    tables: [...tables.values()],
    enums: [],
  };
}
