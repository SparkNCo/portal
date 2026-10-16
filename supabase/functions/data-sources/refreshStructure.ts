// @ts-nocheck
import { supabase } from "../client.ts";
import { DATA_SOURCE_COLUMNS, SCHEMAS_BUCKET } from "./columns.ts";
import type { ConnectionConfig } from "./postgresClient.ts";
import { engineFor } from "./engines.ts";

// Reads a connection's structure and stores it as JSON at
// data_source_schemas/{customer_id}/{data_source_id}.json (SPA-490/491).
// Records the outcome on the row: schema_path and schema_refreshed_at when
// it worked, schema_error when it didn't (the previous file, if any, is
// kept). Returns the updated row either way.
export async function refreshStructure(dataSource: any, config: ConnectionConfig) {
  const engine = engineFor(config.type);
  let update: Record<string, unknown>;
  try {
    const structure = await engine.readStructure(config, dataSource.id);
    const path = `${dataSource.customer_id}/${dataSource.id}.json`;

    const { error: uploadError } = await supabase.storage
      .from(SCHEMAS_BUCKET)
      .upload(path, new Blob([JSON.stringify(structure)], { type: "application/json" }), {
        contentType: "application/json",
        upsert: true,
      });
    if (uploadError) throw new Error(`Couldn't store the structure: ${uploadError.message}`);

    update = { schema_path: path, schema_refreshed_at: structure.refreshedAt, schema_error: null };
    console.log("[data-sources] structure read", { id: dataSource.id, tables: structure.tables.length });
  } catch (err) {
    const message = engine.describeConnectionError(err, config, "");
    console.error("[data-sources] reading the structure failed", { id: dataSource.id, error: message });
    update = { schema_error: message };
  }

  const { data, error } = await supabase
    .schema("portal")
    .from("data_sources")
    .update(update)
    .eq("id", dataSource.id)
    .select(DATA_SOURCE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
