// @ts-nocheck
// Query (SPA-487..492): the client databases admins connect to the portal.
//   GET    /data-sources?slug=   — the client's connections
//   POST   /data-sources/test    — try a connection's details without saving
//   POST   /data-sources         — save a new connection (tested first)
//   PATCH  /data-sources/:id     — edit one (tested first)
//   DELETE /data-sources/:id     — remove one
// Admins only, checked from the session token — never from the body.
import { serveWithCors } from "../utils/serve.ts";
import { resolveCaller } from "../users/resolveCaller.ts";
import { handleCreateDataSource, handleTestConnection } from "./createDataSource.ts";
import { handleDeleteDataSource, handleListDataSources, handleUpdateDataSource } from "./manageDataSources.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serveWithCors("data-sources API Error", async (req) => {
  const caller = await resolveCaller(req, "portal");
  if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role !== "admin") return Response.json({ error: "Only admins can manage data sources" }, { status: 403 });

  const url = new URL(req.url);
  // What follows /data-sources in the path: "", "test" or a connection id.
  const sub = url.pathname.split("/data-sources")[1]?.replace(/^\/+|\/+$/g, "") ?? "";

  if (req.method === "GET" && !sub) return await handleListDataSources(url);
  if (req.method === "POST" && sub === "test") return await handleTestConnection(req);
  if (req.method === "POST" && !sub) return await handleCreateDataSource(req, caller.id);

  if (UUID_RE.test(sub)) {
    if (req.method === "PATCH") return await handleUpdateDataSource(sub, req);
    if (req.method === "DELETE") return await handleDeleteDataSource(sub);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
});
