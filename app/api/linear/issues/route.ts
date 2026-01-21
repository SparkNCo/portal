// app/api/issues/route.ts

import { getIssues } from "@/utils/functions/getIssue";

export async function GET() {
  try {
    const issues = await getIssues({
      project: {
        id: {
          eq: "0b7fdd82-8bba-4587-856f-b50ab96b2e58",
        },
      },
    });

    return Response.json(issues);
  } catch (error) {
    console.error(error);
    return new Response("Failed to fetch issues", { status: 500 });
  }
}
