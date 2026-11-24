// @ts-nocheck
import type { ConnectionConfig, DatabaseEngine } from "./postgresClient.ts";

// The engines Query can connect to, and the port each one listens on by default.
export const DEFAULT_PORTS: Record<DatabaseEngine, number> = { postgres: 5432, sqlserver: 1433, mysql: 3306 };

export const MAX_CA_CHARS = 20000;
const PEM_CERTIFICATE = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;

// The server's CA certificate as typed or uploaded: trimmed, null when empty;
// it must be a PEM certificate ("-----BEGIN CERTIFICATE-----"). Only kept
// with SSL on (without SSL nothing is verified).
export function parseCaCertificate(value: unknown, ssl: boolean): { ca: string | null } | { error: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !ssl) return { ca: null };
  if (text.length > MAX_CA_CHARS) return { error: "The CA certificate is too long. Paste only the CA certificate." };
  if (!PEM_CERTIFICATE.test(text)) {
    return {
      error:
        'The CA certificate must be in PEM format, starting with "-----BEGIN CERTIFICATE-----" (e.g. the ca.pem file from the provider).',
    };
  }
  return { ca: text };
}

// The connection form's fields, checked and normalized. Returns the config,
// or what's missing or wrong.
export function parseConnectionInput(body: any): { config: ConnectionConfig } | { error: string } {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const type = body?.type === undefined || body?.type === "" ? "postgres" : body.type;
  if (!(type in DEFAULT_PORTS)) return { error: "Database type must be PostgreSQL, SQL Server or MySQL" };

  const host = text(body?.host);
  const database = text(body?.database);
  const username = text(body?.username);
  // Passwords are kept exactly as typed.
  const password = typeof body?.password === "string" ? body.password : "";
  const port = body?.port === undefined || body?.port === "" ? DEFAULT_PORTS[type] : Number(body.port);

  if (!host) return { error: "Host is required" };
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: "Port must be a number between 1 and 65535" };
  if (!database) return { error: "Database is required" };
  if (!username) return { error: "Username is required" };
  if (!password) return { error: "Password is required" };

  const ssl = body?.ssl !== false;
  const ca = parseCaCertificate(body?.ssl_ca, ssl);
  if ("error" in ca) return { error: ca.error };

  return { config: { type, host, port, database, username, password, ssl, ca: ca.ca } };
}
