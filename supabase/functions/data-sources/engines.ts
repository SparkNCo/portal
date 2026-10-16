// @ts-nocheck
// One adapter per database engine Query can connect to (`data_sources.type`).
// Everything engine-specific goes through here: testing a connection,
// reading the structure, running a generated query and explaining failures.
import { type ConnectionConfig, type DatabaseEngine, testConnection, withConnection } from "./postgresClient.ts";
import { describeConnectionError, describeSqlServerError } from "./connectionErrors.ts";
import { readStructure } from "./introspect.ts";
import {
  describeSqlServerQueryError,
  readSqlServerStructure,
  runSqlServerQuery,
  testSqlServerConnection,
} from "./sqlserver.ts";
import { describeQueryError, runQuery } from "../query/runQuery.ts";

export type QueryResult = { columns: string[]; rows: unknown[][]; truncated: boolean };

export type Engine = {
  /** Null if the database answers; otherwise why it didn't. */
  test(config: ConnectionConfig): Promise<string | null>;
  readStructure(config: ConnectionConfig, dataSourceId: string): Promise<any>;
  /** Runs a checked SELECT read-only, with the timeout and row cap. */
  run(config: ConnectionConfig, sql: string): Promise<QueryResult>;
  describeConnectionError(err: unknown, config: ConnectionConfig, fallbackPrefix?: string): string;
  describeQueryError(err: unknown, config: ConnectionConfig): string;
};

// The SQL Server driver needs Deno 2.7+: older runtimes' TLS can't carry its
// handshake (ECONNRESET), and Supabase's edge runtime is on Deno 2.1.4 as of
// October 2026. Until it's upgraded, SQL Server is refused with this reason
// instead of failing obscurely; once it is, it works with no code change.
function denoVersion(): [number, number] {
  const match = String(Deno.version?.deno ?? "").match(/(\d+)\.(\d+)(?:\.\d+)?\)?$/);
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

export function sqlServerUnavailable(): string | null {
  const [major, minor] = denoVersion();
  if (major > 2 || (major === 2 && minor >= 7)) return null;
  return "SQL Server connections aren't available yet: the portal's server runtime can't open them. PostgreSQL works.";
}

// Refuses every operation with the reason while the engine can't run here.
function guarded(engine: Engine, unavailable: () => string | null): Engine {
  const fail = () => {
    throw new Error(unavailable()!);
  };
  return {
    ...engine,
    test: async (config) => unavailable() ?? engine.test(config),
    readStructure: (config, id) => (unavailable() ? fail() : engine.readStructure(config, id)),
    run: (config, sql) => (unavailable() ? fail() : engine.run(config, sql)),
    describeConnectionError: (err, config, prefix) =>
      unavailable() ?? engine.describeConnectionError(err, config, prefix),
    describeQueryError: (err, config) => unavailable() ?? engine.describeQueryError(err, config),
  };
}

const ENGINES: Record<DatabaseEngine, Engine> = {
  postgres: {
    test: testConnection,
    readStructure: (config, id) => withConnection(config, (sql) => readStructure(sql, id, config.database)),
    run: runQuery,
    describeConnectionError,
    describeQueryError,
  },
  sqlserver: guarded(
    {
      test: testSqlServerConnection,
      readStructure: readSqlServerStructure,
      run: runSqlServerQuery,
      describeConnectionError: describeSqlServerError,
      describeQueryError: describeSqlServerQueryError,
    },
    sqlServerUnavailable,
  ),
};

export function engineFor(type: DatabaseEngine | string | null | undefined): Engine {
  return ENGINES[(type ?? "postgres") as DatabaseEngine] ?? ENGINES.postgres;
}

// A saved connection (a portal.data_sources row) plus its password, as the
// config the engines take.
export function configFor(dataSource: any, password: string): ConnectionConfig {
  return {
    type: dataSource.type ?? "postgres",
    host: dataSource.host,
    port: dataSource.port,
    database: dataSource.database_name,
    username: dataSource.username,
    password,
    ssl: dataSource.ssl,
  };
}
