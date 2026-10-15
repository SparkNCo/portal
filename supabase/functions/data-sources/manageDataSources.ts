// @ts-nocheck
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";
import { parseConnectionInput } from "./connectionInput.ts";
import { testConnection } from "./postgresClient.ts";
import { DATA_SOURCE_COLUMNS, SCHEMAS_BUCKET } from "./columns.ts";

// The saved connection, with the columns needed to reconnect.
export async function findDataSource(id: string) {
  const { data, error } = await supabase
    .schema("portal")
    .from("data_sources")
    .select(`${DATA_SOURCE_COLUMNS}, password_secret_id`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function storedPassword(id: string): Promise<string> {
  const { data, error } = await supabase
    .schema("portal")
    .rpc("get_data_source_password", { p_data_source_id: id });
  if (error) throw new Error(`Couldn't read the stored password: ${error.message}`);
  return data ?? "";
}

// The form's fields, with what's left out (the password, when kept)
// filled in from the saved connection.
async function mergedConnectionInput(existing: any, body: any) {
  return parseConnectionInput({
    host: body?.host ?? existing.host,
    port: body?.port ?? existing.port,
    database: body?.database ?? existing.database_name,
    username: body?.username ?? existing.username,
    ssl: body?.ssl ?? existing.ssl,
    password: body?.password ? body.password : await storedPassword(existing.id),
  });
}

// GET /data-sources?slug= — the client's connections, by name.
export async function handleListDataSources(url: URL): Promise<Response> {
  const slug = url.searchParams.get("slug")?.trim();
  if (!slug) return Response.json({ error: "Missing client" }, { status: 400 });

  const { data: customer, error: customerError } = await supabase
    .schema("portal")
    .from("customers")
    .select("customer_id")
    .ilike("clientName", escapeIlike(slug))
    .maybeSingle();
  if (customerError) throw new Error(customerError.message);
  if (!customer) return Response.json({ error: "Client not found" }, { status: 404 });

  const { data, error } = await supabase
    .schema("portal")
    .from("data_sources")
    .select(DATA_SOURCE_COLUMNS)
    .eq("customer_id", customer.customer_id)
    .order("name");
  if (error) throw new Error(error.message);
  return Response.json(data ?? []);
}

// POST /data-sources/test with `id`: a saved connection, with any edited
// fields and, unless a new one is typed, its stored password.
export async function testSavedConnection(id: string, body: any): Promise<Response> {
  const existing = await findDataSource(id);
  if (!existing) return Response.json({ error: "Connection not found" }, { status: 404 });

  const parsed = await mergedConnectionInput(existing, body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const error = await testConnection(parsed.config);
  return Response.json(error ? { ok: false, error } : { ok: true });
}

// PATCH /data-sources/:id — edits a connection. An empty password keeps the
// current one. The details are tested before anything is saved.
export async function handleUpdateDataSource(id: string, req: Request): Promise<Response> {
  const body = await req.json();
  const existing = await findDataSource(id);
  if (!existing) return Response.json({ error: "Connection not found" }, { status: 404 });

  const name = body?.name === undefined ? existing.name : String(body.name).trim();
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  const parsed = await mergedConnectionInput(existing, body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { config } = parsed;

  const connectionError = await testConnection(config);
  if (connectionError) return Response.json({ error: connectionError }, { status: 400 });

  const { data: row, error: updateError } = await supabase
    .schema("portal")
    .from("data_sources")
    .update({
      name,
      host: config.host,
      port: config.port,
      database_name: config.database,
      username: config.username,
      ssl: config.ssl,
    })
    .eq("id", id)
    .select(DATA_SOURCE_COLUMNS)
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      return Response.json({ error: `This client already has a connection named "${name}"` }, { status: 409 });
    }
    throw new Error(updateError.message);
  }

  if (body?.password) {
    const { error: passwordError } = await supabase
      .schema("portal")
      .rpc("set_data_source_password", { p_data_source_id: id, p_password: config.password });
    if (passwordError) throw new Error(`Saved, but the new password couldn't be stored: ${passwordError.message}`);
  }

  return Response.json(row);
}

// DELETE /data-sources/:id — removes the connection and its structure file.
// Its Vault password goes with the row (a trigger, see the migrations).
export async function handleDeleteDataSource(id: string): Promise<Response> {
  const existing = await findDataSource(id);
  if (!existing) return Response.json({ error: "Connection not found" }, { status: 404 });

  if (existing.schema_path) {
    const { error: storageError } = await supabase.storage.from(SCHEMAS_BUCKET).remove([existing.schema_path]);
    // A leftover file isn't worth keeping the connection for.
    if (storageError) console.error("[data-sources] removing the structure file failed", storageError.message);
  }

  const { error } = await supabase.schema("portal").from("data_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return Response.json({ deleted: true });
}
