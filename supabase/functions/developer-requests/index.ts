// @ts-nocheck
import { createDeveloperRequest } from "./createDeveloperRequest.ts";
import { serveWithCors } from "../utils/serve.ts";

serveWithCors("developer-requests API Error", async (req) => {
  if (req.method === "POST") {
    return await createDeveloperRequest(req);
  }
  return Response.json({ error: "Method not allowed" }, { status: 405 });
});
