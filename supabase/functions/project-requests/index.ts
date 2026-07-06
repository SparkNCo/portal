// @ts-nocheck
import { createProjectRequest } from "./createProjectRequest.ts";
import { serveWithCors } from "../utils/serve.ts";

serveWithCors("project-requests API Error", async (req) => {
  if (req.method === "POST") {
    return await createProjectRequest(req);
  }
  return Response.json({ error: "Method not allowed" }, { status: 405 });
});
