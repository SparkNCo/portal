// @ts-nocheck
// Query (SPA-487..492): the client databases admins connect to the portal.
//   GET    /data-sources?slug=   — the client's connections
//   POST   /data-sources/test    — try a connection's details without saving
//   POST   /data-sources         — save a new connection (tested first)
//   PATCH  /data-sources/:id     — edit one (tested first)
//   DELETE /data-sources/:id     — remove one
//   POST   /data-sources/:id/refresh-structure — read its structure again
// Admins only, checked from the session token — never from the body.
import { serveWithCors } from "../utils/serve.ts";
import { resolveCaller } from "../users/resolveCaller.ts";
import { handleCreateDataSource, handleTestConnection } from "./createDataSource.ts";
import {
  handleDeleteDataSource,
  handleListDataSources,
  handleRefreshStructure,
  handleUpdateDataSource,
} from "./manageDataSources.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Requests on one connection: /data-sources/:id[/action].
async function routeConnection(req: Request, id: string, action: string | undefined): Promise<Response | null> {
  if (!UUID_RE.test(id)) return null;
  if (action === "refresh-structure" && req.method === "POST") return await handleRefreshStructure(id);
  if (action) return null;
  if (req.method === "PATCH") return await handleUpdateDataSource(id, req);
  if (req.method === "DELETE") return await handleDeleteDataSource(id);
  return null;
}

serveWithCors("data-sources API Error", async (req) => {
  const caller = await resolveCaller(req, "portal");
  if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role !== "admin") return Response.json({ error: "Only admins can manage data sources" }, { status: 403 });

  const url = new URL(req.url);
  // The path after /data-sources: [], ["test"], [id] or [id, action].
  const [first, action] = (url.pathname.split("/data-sources")[1] ?? "").split("/").filter(Boolean);

  if (!first) {
    if (req.method === "GET") return await handleListDataSources(url);
    if (req.method === "POST") return await handleCreateDataSource(req, caller.id);
  } else if (first === "test" && req.method === "POST") {
    return await handleTestConnection(req);
  } else {
    const response = await routeConnection(req, first, action);
    if (response) return response;
  }

  return Response.json({ error: "Not found" }, { status: 404 });
});
