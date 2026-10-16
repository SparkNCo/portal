// @ts-nocheck
// Connections to a client's own Postgres database (Query, SPA-488). One
// short-lived connection per call: these databases are someone else's, so
// nothing is pooled or kept open between requests.
import postgres from "npm:postgres@3.4.5";
import { CONNECT_TIMEOUT_SECONDS, describeConnectionError } from "./connectionErrors.ts";

export { describeConnectionError };

export type DatabaseEngine = "postgres" | "sqlserver";

export type ConnectionConfig = {
  type: DatabaseEngine;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

// Opens a connection, runs `fn` with it and always closes it.
export async function withConnection<T>(config: ConnectionConfig, fn: (sql: any) => Promise<T>): Promise<T> {
  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    ssl: config.ssl ? "require" : false,
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    idle_timeout: 1,
    // Some hosted Postgres (poolers like PgBouncer) reject prepared statements.
    prepare: false,
    // Their notices aren't ours to log.
    onnotice: () => {},
  });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

// Null if the database answers; otherwise what went wrong, in words an
// admin can act on.
export async function testConnection(config: ConnectionConfig): Promise<string | null> {
  try {
    await withConnection(config, (sql) => sql`select 1`);
    return null;
  } catch (err) {
    console.error("[data-sources] connection test failed", { host: config.host, error: String(err?.message ?? err) });
    return describeConnectionError(err, config);
  }
}
