// @ts-nocheck
import { notifyAdminsOfStakeholder } from "./notifyAdminsOfStakeholder.ts";
import { serveWithCors } from "../utils/serve.ts";

serveWithCors("stakeholder-notifications API Error", async (req) => {
  if (req.method === "POST") {
    return await notifyAdminsOfStakeholder(req);
  }
  return Response.json({ error: "Method not allowed" }, { status: 405 });
});
