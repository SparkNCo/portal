// @ts-nocheck
// Connections to a client's own Postgres database (Query, SPA-488). One
// short-lived connection per call: these databases are someone else's, so
// nothing is pooled or kept open between requests.
import postgres from "npm:postgres@3.4.5";

export type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

const CONNECT_TIMEOUT_SECONDS = 5;

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

// `fallbackPrefix` goes before the raw message when it's none of the
// connection problems below (e.g. a query that failed once connected).
export function describeConnectionError(err: any, config: ConnectionConfig, fallbackPrefix = "Couldn't connect: "): string {
  const code = String(err?.code ?? "");
  const message = String(err?.message ?? err ?? "");
  const where = `${config.host}:${config.port}`;

  if (code === "28P01" || /password authentication failed/i.test(message)) {
    return "Wrong username or password.";
  }
  if (code === "3D000") return `The database "${config.database}" doesn't exist on this server.`;
  if (code === "28000") return "This user isn't allowed to connect to that database.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || /getaddrinfo|failed to lookup|name or service not known/i.test(message)) {
    return `Couldn't find the host "${config.host}". Check the address.`;
  }
  if (code === "ECONNREFUSED" || /connection refused/i.test(message)) {
    return `${where} refused the connection. Check the host and port, and that the database accepts outside connections.`;
  }
  if (code === "CONNECT_TIMEOUT" || /timeout|timed out/i.test(message)) {
    return `${where} didn't answer within ${CONNECT_TIMEOUT_SECONDS} seconds. Check the host and port, and that its firewall lets outside connections in.`;
  }
  if (/ssl|tls|certificate/i.test(message)) {
    return `The SSL connection failed (${message}). Try with SSL ${config.ssl ? "off" : "on"}.`;
  }
  return `${fallbackPrefix}${message}`;
}
