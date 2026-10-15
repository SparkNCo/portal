// What the portal shows for a connection — never the password or its secret id.
export const DATA_SOURCE_COLUMNS =
  "id, customer_id, name, type, host, port, database_name, username, ssl, schema_path, schema_refreshed_at, schema_error, created_at, updated_at";

// Where each connection's structure JSON is stored (private bucket).
export const SCHEMAS_BUCKET = "data_source_schemas";
