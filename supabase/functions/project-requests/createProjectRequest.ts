// @ts-nocheck
import { supabase } from "../client.ts";
import { resolveTestMode, testModeBody } from "../lib/testMode.ts";
import { sendProjectRequestMail } from "./sendProjectRequestMail.ts";

// POST /project-requests — client asks for a new project instead of creating one in Linear
export async function createProjectRequest(req: Request): Promise<Response> {
  // Test mode (lib/testMode.ts): the admins' emails are recorded, not sent.
  const testRun = resolveTestMode(req);
  const { title, description, requestedBy, slug } = await req.json();

  if (!title) {
    return Response.json({ error: "Missing title" }, { status: 400 });
  }

  const { data: admins, error } = await supabase
    .schema("portal")
    .from("users")
    .select("email, role")
    .eq("role", "admin");

  if (error) {
    console.error("[createProjectRequest] ❌ Error fetching admins:", error);
    return Response.json(
      { error: "Failed to look up admins", details: error.message },
      { status: 500 },
    );
  }

  if (!admins || admins.length === 0) {
    console.warn("[createProjectRequest] ⚠️ No matching admin found");
    return Response.json({ error: "No admin recipient found" }, { status: 404 });
  }

  for (const admin of admins) {
    await sendProjectRequestMail({
      email: admin.email,
      testRun,
      title: String(title).trim(),
      description: description ?? undefined,
      requestedBy,
      slug,
    });
  }

  const result = { sent: true };
  return Response.json(testRun ? testModeBody(testRun, result) : result);
}
