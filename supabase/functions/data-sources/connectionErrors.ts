// @ts-nocheck
// Connection failures in words an admin can act on. Kept apart from
// postgresClient.ts (no driver import) so the unit tests can load it.
import type { ConnectionConfig } from "./postgresClient.ts";

export const CONNECT_TIMEOUT_SECONDS = 5;

// SQL Server waits longer: Azure SQL's serverless databases (the free offer
// among them) pause when idle, and the first connection wakes them up,
// which can take most of a minute.
export const SQLSERVER_CONNECT_TIMEOUT_SECONDS = 30;

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

// The same for SQL Server (the mssql / tedious driver). Azure SQL refuses
// unknown addresses at its firewall, so that case gets its own message.
export function describeSqlServerError(err: any, config: ConnectionConfig, fallbackPrefix = "Couldn't connect: "): string {
  const code = String(err?.code ?? "");
  const number = Number(err?.number ?? err?.originalError?.info?.number ?? 0);
  const message = String(err?.originalError?.message ?? err?.message ?? err ?? "");
  const where = `${config.host}:${config.port}`;

  const blockedIp = message.match(/Client with IP address '([^']+)' is not allowed/i);
  if (blockedIp || number === 40615) {
    return `The server's firewall refused the connection${blockedIp ? ` from ${blockedIp[1]}` : ""}. Allow that address (or the portal's range) in the server's Networking settings.`;
  }
  if (number === 18456 || /login failed/i.test(message)) return "Wrong username or password.";
  if (number === 4060 || /cannot open database/i.test(message)) {
    return `The database "${config.database}" doesn't exist on this server, or this user can't open it.`;
  }
  if (code === "EINSTLOOKUP" || /getaddrinfo|ENOTFOUND|failed to lookup|name or service not known/i.test(message)) {
    return `Couldn't find the host "${config.host}". Check the address.`;
  }
  if (/ECONNREFUSED|connection refused/i.test(message)) {
    return `${where} refused the connection. Check the host and port, and that the server accepts outside connections.`;
  }
  if (/ECONNRESET|socket hang up/i.test(message)) {
    return `${where} closed the connection while setting up encryption. Check that the server accepts encrypted connections from outside (Azure SQL does), or try with SSL ${config.ssl ? "off" : "on"}.`;
  }
  if (code === "ETIMEOUT" || /timeout|timed out/i.test(message)) {
    return `${where} didn't answer within ${SQLSERVER_CONNECT_TIMEOUT_SECONDS} seconds. If it's an Azure SQL serverless database it may still be waking up: try again in a minute. Otherwise check the host and port, and that its firewall lets outside connections in.`;
  }
  if (/ssl|tls|certificate|encrypt/i.test(message)) {
    return `The encrypted connection failed (${message}). Try with SSL ${config.ssl ? "off" : "on"}.`;
  }
  return `${fallbackPrefix}${message}`;
}
