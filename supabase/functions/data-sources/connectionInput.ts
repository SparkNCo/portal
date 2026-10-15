// @ts-nocheck
import type { ConnectionConfig } from "./postgresClient.ts";

// The connection form's fields, checked and normalized. Returns the config,
// or what's missing or wrong.
export function parseConnectionInput(body: any): { config: ConnectionConfig } | { error: string } {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const host = text(body?.host);
  const database = text(body?.database);
  const username = text(body?.username);
  // Passwords are kept exactly as typed.
  const password = typeof body?.password === "string" ? body.password : "";
  const port = body?.port === undefined || body?.port === "" ? 5432 : Number(body.port);

  if (!host) return { error: "Host is required" };
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: "Port must be a number between 1 and 65535" };
  if (!database) return { error: "Database is required" };
  if (!username) return { error: "Username is required" };
  if (!password) return { error: "Password is required" };

  return { config: { host, port, database, username, password, ssl: body?.ssl !== false } };
}
