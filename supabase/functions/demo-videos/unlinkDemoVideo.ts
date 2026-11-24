// @ts-nocheck
// Unlinks a demo from one ticket without deleting the demo: removes that
// ticket's demo_videos row (the version, and its feedback thread via ON
// DELETE CASCADE), never the file or link itself.
//
// Only when another ticket still uses the same demo (same uploaded file, or
// same link) — otherwise unlinking would be deleting it, since it would no
// longer be reachable anywhere in the portal. The storage object is never
// touched here: it's still in use, by that other ticket.
import { SCHEMA } from "./helpers.ts";

export class UnlinkError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type DemoRow = {
  id: string;
  issue_id: string;
  version: number;
  source_type: "upload" | "embed";
  storage_path: string | null;
  embed_url: string | null;
};

// How many other tickets' rows point at the same file or link.
export async function otherUsesOfDemo(supabase: any, demo: DemoRow): Promise<number> {
  const column = demo.source_type === "upload" ? "storage_path" : "embed_url";
  const value = demo.source_type === "upload" ? demo.storage_path : demo.embed_url;
  if (!value) return 0;

  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("issue_id")
    .eq(column, value)
    .neq("id", demo.id)
    .neq("issue_id", demo.issue_id);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r: { issue_id: string }) => r.issue_id)).size;
}

export async function unlinkDemoVideo(supabase: any, demoId: string) {
  const { data: demo, error } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("id, issue_id, version, source_type, storage_path, embed_url")
    .eq("id", demoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!demo) throw new UnlinkError("Demo version not found", 404);

  if ((await otherUsesOfDemo(supabase, demo)) === 0) {
    throw new UnlinkError(
      "This is the only ticket using this demo, so unlinking it would delete it. Attach it to another ticket first.",
      409,
    );
  }

  const { error: deleteError } = await supabase.schema(SCHEMA).from("demo_videos").delete().eq("id", demoId);
  if (deleteError) throw new Error(deleteError.message);

  return { unlinked: true, issueId: demo.issue_id, version: demo.version };
}
