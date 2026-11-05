// @ts-nocheck
// MySQL connections (Query), including MySQL-compatible servers (MariaDB,
// TiDB, Aiven, PlanetScale…). Same contract as the Postgres side
// (postgresClient.ts, introspect.ts, query/runQuery.ts): one short-lived
// connection per call, the structure from the catalog, and generated SQL run
// so it can't change anything. npm:mysql2 works on the edge runtime's
// Deno 2.1, TLS included (checked November 2026).
import mysql from "npm:mysql2@3.11.5/promise";
import {
  describeMysqlError,
  MYSQL_CONNECT_TIMEOUT_SECONDS,
  MYSQL_STATEMENT_TIMEOUT_SECONDS,
} from "./connectionErrors.ts";
import { buildMysqlStructure } from "./mysqlStructure.ts";
import type { ConnectionConfig } from "./postgresClient.ts";
import { MAX_ROWS } from "../query/describeStructure.ts";

// Per catalog query when reading the structure.
const STRUCTURE_TIMEOUT_SECONDS = 30;

// Opens a connection, runs `fn` with it and always closes it.
async function withMysql<T>(config: ConnectionConfig, fn: (conn: any) => Promise<T>): Promise<T> {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    // Encrypted but not verified against a CA, like Postgres's "require":
    // hosted MySQL often signs with its own CA (Aiven does).
    ssl: config.ssl ? { minVersion: "TLSv1.2", rejectUnauthorized: false } : undefined,
    connectTimeout: MYSQL_CONNECT_TIMEOUT_SECONDS * 1000,
    // Dates as the database shows them (no time zone shifts), big numbers as text.
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: false,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end().catch(() => conn.destroy());
  }
}

export async function testMysqlConnection(config: ConnectionConfig): Promise<string | null> {
  try {
    await withMysql(config, (conn) => conn.query("select 1"));
    return null;
  } catch (err) {
    console.error("[data-sources] MySQL connection test failed", { host: config.host, error: String(err?.message ?? err) });
    return describeMysqlError(err, config);
  }
}

// Only the database the connection names (a MySQL "schema" is a database;
// the server may hold many). information_schema only lists what the
// connecting user has privileges on. Each query filters on TABLE_SCHEMA by
// itself, with no joins: before MySQL 8, information_schema is only fast
// when every table in the query is looked up by a constant database name
// (a join made it scan every database on the server).

const TABLES_SQL = `
  select TABLE_SCHEMA as \`schema\`, TABLE_NAME as \`table\`, TABLE_TYPE as kind, TABLE_COMMENT as table_comment
  from information_schema.TABLES
  where TABLE_SCHEMA = ?`;

const COLUMNS_SQL = `
  select TABLE_SCHEMA as \`schema\`, TABLE_NAME as \`table\`, COLUMN_NAME as \`column\`, COLUMN_TYPE as column_type,
         IS_NULLABLE as is_nullable, COLUMN_COMMENT as column_comment
  from information_schema.COLUMNS
  where TABLE_SCHEMA = ?
  order by TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`;

const PRIMARY_KEYS_SQL = `
  select TABLE_SCHEMA as \`schema\`, TABLE_NAME as \`table\`, COLUMN_NAME as \`column\`
  from information_schema.KEY_COLUMN_USAGE
  where CONSTRAINT_NAME = 'PRIMARY' and TABLE_SCHEMA = ?
  order by TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`;

const FOREIGN_KEYS_SQL = `
  select CONSTRAINT_NAME as fk_name, TABLE_SCHEMA as \`schema\`, TABLE_NAME as \`table\`, COLUMN_NAME as \`column\`,
         REFERENCED_TABLE_SCHEMA as ref_schema, REFERENCED_TABLE_NAME as ref_table, REFERENCED_COLUMN_NAME as ref_column
  from information_schema.KEY_COLUMN_USAGE
  where REFERENCED_TABLE_NAME is not null and TABLE_SCHEMA = ?
  order by TABLE_SCHEMA, TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`;

export async function readMysqlStructure(config: ConnectionConfig, dataSourceId: string) {
  return await withMysql(config, async (conn) => {
    // One connection runs one query at a time, so these go in turn. Each has
    // the driver's timeout so a slow catalog can't hang the function.
    const read = async (sql: string) =>
      (await conn.query({ sql, values: [config.database], timeout: STRUCTURE_TIMEOUT_SECONDS * 1000 }))[0];
    const tables = new Map((await read(TABLES_SQL)).map((t: any) => [`${t.schema}.${t.table}`, t]));
    const columns = (await read(COLUMNS_SQL)).map((c: any) => {
      const table: any = tables.get(`${c.schema}.${c.table}`);
      return { ...c, kind: table?.kind, table_comment: table?.table_comment };
    });
    const primaryKeys = await read(PRIMARY_KEYS_SQL);
    const foreignKeys = await read(FOREIGN_KEYS_SQL);
    return buildMysqlStructure({ columns, primaryKeys, foreignKeys }, dataSourceId, config.database);
  });
}

// JSON-safe cell values: dates as ISO strings, binary data summarized.
function cell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `(${value.byteLength} bytes)`;
  return value;
}

// Runs the generated SELECT in a READ ONLY transaction (the server refuses
// any write), always rolled back. sql_select_limit caps the rows the way
// LIMIT would without wrapping the query (MySQL may drop a subquery's
// ORDER BY); one extra row tells whether there were more. The timeout is
// both the server's (max_execution_time, MySQL 5.7.8+; ignored where it
// doesn't exist) and the driver's.
export async function runMysqlQuery(config: ConnectionConfig, query: string) {
  const timeoutMs = MYSQL_STATEMENT_TIMEOUT_SECONDS * 1000;
  return await withMysql(config, async (conn) => {
    await conn.query(`set session sql_select_limit = ${MAX_ROWS + 1}`);
    await conn.query(`set session max_execution_time = ${timeoutMs}`).catch(() => {});
    await conn.query("start transaction read only");
    try {
      const [rows, fields] = await conn.query({ sql: query, rowsAsArray: true, timeout: timeoutMs });
      return {
        columns: (fields ?? []).map((f: any) => f.name),
        rows: (rows as unknown[][]).slice(0, MAX_ROWS).map((row) => row.map(cell)),
        truncated: rows.length > MAX_ROWS,
      };
    } finally {
      await conn.query("rollback").catch(() => {});
    }
  });
}
