// @ts-nocheck
// Query (SPA-487..492): the client databases admins connect to the portal.
//   POST /data-sources/test  — try a connection's details without saving
//   POST /data-sources       — save a new connection (tested first)
// Admins only, checked from the session token — never from the body.
import { serveWithCors } from "../utils/serve.ts";
import { resolveCaller } from "../users/resolveCaller.ts";
import { handleCreateDataSource, handleTestConnection } from "./createDataSource.ts";

serveWithCors("data-sources API Error", async (req) => {
  const caller = await resolveCaller(req, "portal");
  if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role !== "admin") return Response.json({ error: "Only admins can manage data sources" }, { status: 403 });

  const { pathname } = new URL(req.url);

  if (req.method === "POST" && pathname.endsWith("/test")) return await handleTestConnection(req);
  if (req.method === "POST") return await handleCreateDataSource(req, caller.id);

  return Response.json({ error: "Method not allowed" }, { status: 405 });
});
