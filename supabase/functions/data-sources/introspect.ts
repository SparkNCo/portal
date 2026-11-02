// @ts-nocheck
// Reads the structure of a client's Postgres database (SPA-490): its tables
// and views, their columns and types, primary and foreign keys, and the
// values of its enum types. Only what the connecting user can read is
// listed, and never any row — this is what the AI gets to write SQL from.

export type DatabaseStructure = {
  dataSourceId: string;
  database: string;
  refreshedAt: string;
  tables: {
    schema: string;
    name: string;
    kind: "table" | "view" | "materialized view" | "foreign table";
    comment: string | null;
    columns: { name: string; type: string; nullable: boolean; comment: string | null }[];
    primaryKey: string[];
    foreignKeys: { columns: string[]; references: { schema: string; table: string; columns: string[] } }[];
  }[];
  enums: { schema: string; name: string; values: string[] }[];
};

const KINDS: Record<string, DatabaseStructure["tables"][number]["kind"]> = {
  r: "table",
  p: "table",
  v: "view",
  m: "materialized view",
  f: "foreign table",
};

// The system schemas, left out everywhere below.
const USER_SCHEMAS = `n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%' and n.nspname not like 'pg_temp%'`;

export async function readStructure(sql: any, dataSourceId: string, database: string): Promise<DatabaseStructure> {
  const columns = await sql.unsafe(`
    select n.nspname::text as schema, c.relname::text as table, c.relkind::text as kind,
           obj_description(c.oid, 'pg_class') as table_comment,
           a.attname::text as column, format_type(a.atttypid, a.atttypmod) as type,
           not a.attnotnull as nullable, col_description(c.oid, a.attnum) as column_comment
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where c.relkind in ('r', 'p', 'v', 'm', 'f')
      and not c.relispartition
      and ${USER_SCHEMAS}
      and has_table_privilege(c.oid, 'SELECT')
    order by n.nspname, c.relname, a.attnum`);

  const keys = await sql.unsafe(`
    select con.contype::text as type, n.nspname::text as schema, c.relname::text as table,
           array(select a.attname::text from unnest(con.conkey) with ordinality k(attnum, ord)
                 join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum order by k.ord) as columns,
           fn.nspname::text as ref_schema, fc.relname::text as ref_table,
           array(select a.attname::text from unnest(con.confkey) with ordinality k(attnum, ord)
                 join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum order by k.ord) as ref_columns
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_class fc on fc.oid = con.confrelid
    left join pg_namespace fn on fn.oid = fc.relnamespace
    where con.contype in ('p', 'f')
      and ${USER_SCHEMAS}
      and has_table_privilege(c.oid, 'SELECT')`);

  const enums = await sql.unsafe(`
    select n.nspname::text as schema, t.typname::text as name,
           array_agg(e.enumlabel::text order by e.enumsortorder) as values
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where ${USER_SCHEMAS}
    group by n.nspname, t.typname
    order by n.nspname, t.typname`);

  const tables = new Map<string, DatabaseStructure["tables"][number]>();
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
    tables.get(key)!.columns.push({
      name: row.column,
      type: row.type,
      nullable: row.nullable,
      comment: row.column_comment ?? null,
    });
  }

  for (const row of keys) {
    const table = tables.get(keyOf(row.schema, row.table));
    if (!table) continue;
    if (row.type === "p") {
      table.primaryKey = row.columns;
    } else {
      table.foreignKeys.push({
        columns: row.columns,
        references: { schema: row.ref_schema, table: row.ref_table, columns: row.ref_columns },
      });
    }
  }

  // Enum types aren't permission-checked like tables; keep the ones in the
  // schemas whose tables the user can read.
  const visibleSchemas = new Set([...tables.values()].map((t) => t.schema));

  return {
    dataSourceId,
    database,
    refreshedAt: new Date().toISOString(),
    tables: [...tables.values()],
    enums: enums
      .filter((e: any) => visibleSchemas.has(e.schema))
      .map((e: any) => ({ schema: e.schema, name: e.name, values: e.values })),
  };
}
