// app/api/issues/route.ts

import { getIssues } from "@/utils/functions/getIssue";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  try {
    const issues = await getIssues({ projectId: projectId });

    return Response.json(issues);
  } catch (error) {
    console.error(error);
    return new Response("Failed to fetch issues", { status: 500 });
  }
}
