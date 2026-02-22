// @ts-nocheck

import { corsHeaders } from "../utils/headers.ts";
import { fetchRoadmapByProjects } from "./fetchRoadmapByInitiatives.ts";
import { USER_PROJECTS_QUERY, USERS_LIST_QUERY } from "./query.ts";
import {
  extractProjectAndInitiativeIds,
  linearFetch,
  saveUserProjectsByEmail,
} from "./utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    if (pathname === "/linear/fetch") {
      const data = await linearFetch(USERS_LIST_QUERY);
      console.log("data", data);

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (pathname === "/linear/usersprojects") {
      const userId = url.searchParams.get("userId");
      const email = url.searchParams.get("email");

      if (!userId || !email) {
        return new Response(
          JSON.stringify({
            error: "userId and email are required",
          }),
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }

      const data = await linearFetch(USER_PROJECTS_QUERY, {
        userId,
      });

      /* return new Response(
    JSON.stringify(data),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  ); */

      const { projectIds, initiativeIds } =
        extractProjectAndInitiativeIds(data);

      await saveUserProjectsByEmail(email, projectIds, initiativeIds);
      return new Response(
        JSON.stringify({
          email,
          userId,
          projectIds,
          initiativeIds,
          count: projectIds.length,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    if (pathname === "/linear/roadmap") {
      if (req.method !== "POST") {
        return new Response(
          JSON.stringify({
            error: "POST required",
            headers: corsHeaders,
          }),
          { status: 405, headers: corsHeaders },
        );
      }

      const body = await req.json();

      const email = body?.email;
      const projectIds = body?.ids || [];

      if (!email || !projectIds.length) {
        return new Response(
          JSON.stringify({
            error: "email and ids are required",
          }),
          { status: 400, headers: corsHeaders },
        );
      }

      const roadmap = await fetchRoadmapByProjects(email, projectIds);

      return new Response(JSON.stringify(roadmap), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 👉 Not found
    return new Response(JSON.stringify({ error: "Route not found" }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("[Linear API Error]", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
