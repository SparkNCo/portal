import { getRoadMap } from "@/utils/functions/getRoadMap";
import {
  InitiativeIdSchema,
  RoadmapResponseSchema,
} from "@/lib/schemas/roadmap.schema";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const initiativeId = searchParams.get("initiativeId");

  const parsedId = InitiativeIdSchema.safeParse(initiativeId);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Invalid initiativeId" },
      { status: 400 },
    );
  }

  try {
    const roadmap = await getRoadMap({ initiativeId });

    const parsedResponse = RoadmapResponseSchema.safeParse(roadmap);

    if (!parsedResponse.success) {
      console.error(parsedResponse.error);
      return NextResponse.json(
        { error: "Invalid roadmap response" },
        { status: 500 },
      );
    }
    console.log("parsedResponse", parsedResponse);

    return NextResponse.json(parsedResponse.data);
  } catch (error) {
    console.error("[Linear Roadmap Error]", error);

    return new Response(JSON.stringify({ error: "Failed to fetch roadmap" }), {
      status: 500,
    });
  }
}
