// @ts-nocheck
// Turns MySQL's information_schema rows (see mysql.ts) into the same
// structure JSON Postgres connections produce (introspect.ts). In MySQL a
// "schema" is a database, so tables are named `database.table`. ENUM columns
// keep their allowed values on the column as `values`, like SQL Server's
// CHECKs. No imports, so the unit tests can load it.

const KINDS: Record<string, string> = { "BASE TABLE": "table", VIEW: "view" };

// The values of an ENUM column type: "enum('pending','it''s')" →
// ["pending", "it's"]. Null for any other type (SET allows several values at
// once, so it stays a plain type).
export function enumValues(columnType: string): string[] | null {
  const inner = /^enum\((.*)\)$/i.exec(String(columnType).trim())?.[1];
  if (inner === undefined) return null;
  // "''" is an escaped quote; written so each character has one way to match.
  return [...inner.matchAll(/'([^']*(?:''[^']*)*)'/g)].map((m) => m[1]!.replace(/''/g, "'"));
}

// MySQL fills empty comments with "" (and views with "VIEW").
const commentOf = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text !== "VIEW" ? text : null;
};

export function buildMysqlStructure(
  { columns, primaryKeys, foreignKeys }: { columns: any[]; primaryKeys: any[]; foreignKeys: any[] },
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
        comment: commentOf(row.table_comment),
        columns: [],
        primaryKey: [],
        foreignKeys: [],
      });
    }
    const values = enumValues(row.column_type);
    tables.get(key).columns.push({
      name: row.column,
      type: values ? "enum" : String(row.column_type),
      nullable: row.is_nullable === "YES",
      comment: commentOf(row.column_comment),
      ...(values && { values }),
    });
  }

  for (const row of primaryKeys) tables.get(keyOf(row.schema, row.table))?.primaryKey.push(row.column);

  // One row per column of each foreign key, in order; group them by key.
  const byKey = new Map<string, any>();
  for (const row of foreignKeys) {
    const table = tables.get(keyOf(row.schema, row.table));
    if (!table) continue;
    const id = `${row.schema}.${row.table}.${row.fk_name}`;
    if (!byKey.has(id)) {
      const fk = { columns: [], references: { schema: row.ref_schema, table: row.ref_table, columns: [] } };
      byKey.set(id, fk);
      table.foreignKeys.push(fk);
    }
    byKey.get(id).columns.push(row.column);
    byKey.get(id).references.columns.push(row.ref_column);
  }

  return {
    dataSourceId,
    database,
    refreshedAt: new Date().toISOString(),
    tables: [...tables.values()],
    enums: [],
  };
}
