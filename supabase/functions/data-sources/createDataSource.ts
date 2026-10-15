// @ts-nocheck
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";
import { parseConnectionInput } from "./connectionInput.ts";
import { testConnection } from "./postgresClient.ts";
import { testSavedConnection } from "./manageDataSources.ts";
import { DATA_SOURCE_COLUMNS } from "./columns.ts";
import { refreshStructure } from "./refreshStructure.ts";

// POST /data-sources/test — does this database answer with these details?
// With `id`, tests a saved connection instead (see testSavedConnection).
export async function handleTestConnection(req: Request): Promise<Response> {
  const body = await req.json();
  if (typeof body?.id === "string" && body.id) return await testSavedConnection(body.id, body);

  const parsed = parseConnectionInput(body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const error = await testConnection(parsed.config);
  return Response.json(error ? { ok: false, error } : { ok: true });
}

// POST /data-sources — saves a new connection for the client at `slug`,
// after checking it works. The password goes to Vault, not the table. Then
// reads its structure; if that fails the connection stays saved, with the
// error on it (schema_error) to retry from the list.
export async function handleCreateDataSource(req: Request, callerId: string | null): Promise<Response> {
  const body = await req.json();

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!slug) return Response.json({ error: "Missing client" }, { status: 400 });

  const parsed = parseConnectionInput(body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { config } = parsed;

  const { data: customer, error: customerError } = await supabase
    .schema("portal")
    .from("customers")
    .select("customer_id")
    .ilike("clientName", escapeIlike(slug))
    .maybeSingle();
  if (customerError) throw new Error(customerError.message);
  if (!customer) return Response.json({ error: "Client not found" }, { status: 404 });

  const connectionError = await testConnection(config);
  if (connectionError) return Response.json({ error: connectionError }, { status: 400 });

  const { data: row, error: insertError } = await supabase
    .schema("portal")
    .from("data_sources")
    .insert({
      customer_id: customer.customer_id,
      name,
      type: "postgres",
      host: config.host,
      port: config.port,
      database_name: config.database,
      username: config.username,
      ssl: config.ssl,
      created_by: callerId,
    })
    .select(DATA_SOURCE_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return Response.json({ error: `This client already has a connection named "${name}"` }, { status: 409 });
    }
    throw new Error(insertError.message);
  }

  const { error: passwordError } = await supabase
    .schema("portal")
    .rpc("set_data_source_password", { p_data_source_id: row.id, p_password: config.password });

  if (passwordError) {
    // No usable connection without its password: undo the row.
    console.error("[data-sources] storing the password failed", passwordError.message);
    await supabase.schema("portal").from("data_sources").delete().eq("id", row.id);
    throw new Error("Couldn't store the password securely. Nothing was saved.");
  }

  return Response.json(await refreshStructure(row, config), { status: 201 });
}
