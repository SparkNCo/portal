// @ts-nocheck
// SQL Server / Azure SQL Database connections (Query). Same contract as the
// Postgres side (postgresClient.ts, introspect.ts, query/runQuery.ts): one
// short-lived connection per call, the structure from the catalog, and
// generated SQL run so it can't change anything.
import sql from "npm:mssql@11.0.1";
import { describeSqlServerError, SQLSERVER_CONNECT_TIMEOUT_SECONDS } from "./connectionErrors.ts";
import { buildSqlServerStructure } from "./sqlserverStructure.ts";
import type { ConnectionConfig } from "./postgresClient.ts";
import { MAX_ROWS } from "../query/describeStructure.ts";

export const SQLSERVER_STATEMENT_TIMEOUT_SECONDS = 15;

// How to encrypt, in the order tried. "strict" (TDS 8.0) opens a plain TLS
// connection first, which works in the edge runtime (Deno); the classic mode
// negotiates TLS inside the TDS handshake, which Deno's TLS can't wrap
// (the server sees a reset). Azure SQL and SQL Server 2022+ take "strict";
// older servers only the classic mode, so it's the fallback.
function encryptionModes(config: ConnectionConfig): (string | boolean)[] {
  return config.ssl ? ["strict", true] : [false];
}

// A failure that another encryption mode might get past — not a refused
// login, a firewall or a missing database.
function isHandshakeFailure(err: any): boolean {
  const message = String(err?.originalError?.message ?? err?.message ?? "");
  return err?.name === "ConnectionError" && /ECONNRESET|socket hang up|TLS|SSL|handshake|encrypt|ESOCKET/i.test(message)
    && !/Login failed|not allowed to access|Cannot open database/i.test(message);
}

async function openPool(config: ConnectionConfig, encrypt: string | boolean) {
  const pool = new sql.ConnectionPool({
    server: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectionTimeout: SQLSERVER_CONNECT_TIMEOUT_SECONDS * 1000,
    requestTimeout: SQLSERVER_STATEMENT_TIMEOUT_SECONDS * 1000,
    pool: { max: 1, min: 0, idleTimeoutMillis: 1000 },
    options: { encrypt, trustServerCertificate: false, appName: "SparkCo Portal Query" },
  });
  await pool.connect();
  return pool;
}

async function withPool<T>(config: ConnectionConfig, fn: (pool: any) => Promise<T>): Promise<T> {
  const modes = encryptionModes(config);
  let pool;
  for (const [i, encrypt] of modes.entries()) {
    try {
      pool = await openPool(config, encrypt);
      break;
    } catch (err) {
      const last = i === modes.length - 1;
      // The runtime's Deno version matters: before 2.7 its TLS can't carry
      // SQL Server's handshake (ECONNRESET in both modes).
      console.error("[data-sources] SQL Server connect failed", {
        host: config.host,
        encrypt,
        deno: Deno.version?.deno,
        error: String(err?.message ?? err),
      });
      if (last || !isHandshakeFailure(err)) throw err;
    }
  }
  try {
    return await fn(pool);
  } finally {
    await pool.close().catch(() => {});
  }
}

export async function testSqlServerConnection(config: ConnectionConfig): Promise<string | null> {
  try {
    await withPool(config, (pool) => pool.request().query("SELECT 1"));
    return null;
  } catch (err) {
    console.error("[data-sources] SQL Server connection test failed", { host: config.host, error: String(err?.message ?? err) });
    return describeSqlServerError(err, config);
  }
}

// The catalog, as far as this user can see it (SQL Server only lists the
// objects a user has permissions on). System schemas are left out.
const COLUMNS_SQL = `
  SELECT c.TABLE_SCHEMA AS [schema], c.TABLE_NAME AS [table], t.TABLE_TYPE AS kind,
         c.COLUMN_NAME AS [column], c.DATA_TYPE AS data_type, c.CHARACTER_MAXIMUM_LENGTH AS max_length,
         c.NUMERIC_PRECISION AS [precision], c.NUMERIC_SCALE AS scale, c.IS_NULLABLE AS is_nullable,
         CAST(tp.value AS nvarchar(4000)) AS table_comment, CAST(cp.value AS nvarchar(4000)) AS column_comment
  FROM INFORMATION_SCHEMA.COLUMNS c
  JOIN INFORMATION_SCHEMA.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
  LEFT JOIN sys.extended_properties tp
    ON tp.class = 1 AND tp.name = 'MS_Description' AND tp.minor_id = 0
   AND tp.major_id = OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME))
  LEFT JOIN sys.extended_properties cp
    ON cp.class = 1 AND cp.name = 'MS_Description'
   AND cp.major_id = OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME))
   AND cp.minor_id = COLUMNPROPERTY(OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME)), c.COLUMN_NAME, 'ColumnId')
  WHERE c.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
  ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`;

const PRIMARY_KEYS_SQL = `
  SELECT k.TABLE_SCHEMA AS [schema], k.TABLE_NAME AS [table], k.COLUMN_NAME AS [column]
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
    ON k.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
  WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
  ORDER BY k.TABLE_SCHEMA, k.TABLE_NAME, k.ORDINAL_POSITION`;

const FOREIGN_KEYS_SQL = `
  SELECT fk.name AS fk_name,
         OBJECT_SCHEMA_NAME(fk.parent_object_id) AS [schema], OBJECT_NAME(fk.parent_object_id) AS [table],
         COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS [column],
         OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS ref_schema, OBJECT_NAME(fk.referenced_object_id) AS ref_table,
         COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ref_column
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  ORDER BY fk.name, fkc.constraint_column_id`;

const CHECKS_SQL = `
  SELECT OBJECT_SCHEMA_NAME(cc.parent_object_id) AS [schema], OBJECT_NAME(cc.parent_object_id) AS [table], cc.definition
  FROM sys.check_constraints cc`;

export async function readSqlServerStructure(config: ConnectionConfig, dataSourceId: string) {
  return await withPool(config, async (pool) => {
    const [columns, primaryKeys, foreignKeys, checks] = await Promise.all(
      [COLUMNS_SQL, PRIMARY_KEYS_SQL, FOREIGN_KEYS_SQL, CHECKS_SQL].map(async (q) => (await pool.request().query(q)).recordset),
    );
    return buildSqlServerStructure({ columns, primaryKeys, foreignKeys, checks }, dataSourceId, config.database);
  });
}

// JSON-safe cell values: dates as ISO strings, binary data summarized.
function cell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `(${value.byteLength} bytes)`;
  return value;
}

// Runs the generated SELECT inside a transaction that is always rolled back
// — SQL Server has no read-only transactions, so nothing it might change is
// ever kept. SET ROWCOUNT caps the rows (one extra tells whether there were
// more), and the request times out after 15 s.
export async function runSqlServerQuery(config: ConnectionConfig, query: string) {
  return await withPool(config, async (pool) => {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const request = new sql.Request(transaction);
      request.arrayRowMode = true;
      const result = await request.query(`SET ROWCOUNT ${MAX_ROWS + 1};\n${query}`);
      const rows = (result.recordset ?? []) as unknown[][];
      const columns = ((result.columns?.[0] ?? []) as any[]).map((c) => c.name);
      return {
        columns,
        rows: rows.slice(0, MAX_ROWS).map((row) => row.map(cell)),
        truncated: rows.length > MAX_ROWS,
      };
    } finally {
      await transaction.rollback().catch(() => {});
    }
  });
}

export function describeSqlServerQueryError(err: any, config: ConnectionConfig): string {
  const code = String(err?.code ?? "");
  const number = Number(err?.number ?? err?.originalError?.info?.number ?? 0);
  // Never got as far as running it.
  if (err?.name === "ConnectionError") return describeSqlServerError(err, config);
  if (code === "ETIMEOUT" || code === "ECANCEL") {
    return `The query took longer than ${SQLSERVER_STATEMENT_TIMEOUT_SECONDS} seconds and was stopped. Try a narrower question.`;
  }
  if (number === 229 || number === 230) return "The database user isn't allowed to read one of the tables this needs.";
  if (number === 208) return `The query used a table that doesn't exist: ${err?.message ?? ""}. Try Refresh structure.`;
  return describeSqlServerError(err, config, "The query failed: ");
}
