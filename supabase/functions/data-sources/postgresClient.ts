// @ts-nocheck
// Connections to a client's own Postgres database (Query, SPA-488). One
// short-lived connection per call: these databases are someone else's, so
// nothing is pooled or kept open between requests.
import postgres from "npm:postgres@3.4.5";
import { CONNECT_TIMEOUT_SECONDS, describeConnectionError } from "./connectionErrors.ts";

export { describeConnectionError };

export type DatabaseEngine = "postgres" | "sqlserver" | "mysql";

export type ConnectionConfig = {
  type: DatabaseEngine;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  // The server's CA certificate (PEM), when it's signed with its own CA
  // (Aiven, AWS RDS, self-signed). Only used with ssl.
  ca?: string | null;
};

// The `ssl` option for the Postgres and MySQL drivers. With the server's CA,
// the server is verified against it — needed where it's signed with a private
// CA: the edge runtime (Deno) checks the certificate even when told not to,
// so without the CA such a server's handshake fails ("write UNKNOWN").
// Without one: encrypted, not verified, as before.
export function tlsOptions(config: ConnectionConfig) {
  if (!config.ssl) return undefined;
  if (config.ca) return { ca: config.ca, rejectUnauthorized: true, minVersion: "TLSv1.2" };
  return null;
}

// Opens a connection, runs `fn` with it and always closes it.
export async function withConnection<T>(config: ConnectionConfig, fn: (sql: any) => Promise<T>): Promise<T> {
  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    // With the server's CA: verified against it. Otherwise "require"
    // (encrypted, not verified), or no SSL.
    ssl: tlsOptions(config) ?? (config.ssl ? "require" : false),
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
