import { getRoadMap } from "@/utils/functions/getRoadMap";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const initiativeId = searchParams.get("initiativeId");

  if (!initiativeId) {
    return new Response(
      JSON.stringify({ error: "initiativeId is required" }),
      { status: 400 }
    );
  }

  try {
    const roadmap = await getRoadMap({ initiativeId });

    return Response.json(roadmap);
  } catch (error) {
    console.error("[Linear Roadmap Error]", error);

    return new Response(
      JSON.stringify({ error: "Failed to fetch roadmap" }),
      { status: 500 }
    );
  }
}