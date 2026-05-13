// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { createCustomerFlow } from "./createCustomerFlow.ts";
import { createUser } from "./createUser.ts";
import { getAllUsers } from "./getAllUsers.ts";
import { updateUser } from "./updateUser.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      console.log("[users GET]", {
        url: url.toString(),
        email: url.searchParams.get("email"),
        hasApiKey: !!req.headers.get("apikey"),
        hasAuth: !!req.headers.get("authorization"),
        apiKeyPrefix: req.headers.get("apikey")?.slice(0, 10),
      });
      return await handleGet(url);
    }
    if (req.method === "PATCH") return await handlePatch(req);
    if (req.method === "POST") return await handlePost(req, url);

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("[Supabase Error]", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

const handleGet = async (url: URL) => {
  const type = url.searchParams.get("type");
  const email = url.searchParams.get("email");

  if (type === "customers") {
    const { data, error } = await supabase
      .from("users")
      .select("id, clientName, linear_slug, email, customer_id")
      .eq("role", "customer");
    if (error) throw new Error(error.message);
    return jsonResponse(data);
  }

  if (!email) {
    const users = await getAllUsers();
    return jsonResponse(users);
  }

  const user = await fetchUser(email);
  return jsonResponse(user);
};

const handlePatch = async (req: Request) => {
  const body = await req.json();
  const updatedUser = await updateUser(body);
  return jsonResponse(updatedUser);
};

const handlePost = async (req: Request, url: URL) => {
  const body = await req.json();
  const type = url.searchParams.get("type");

  if (!type || type === "developer" || type === "stakeholder") {
    const newUser = await createUser(body);
    return jsonResponse(newUser);
  }

  if (type === "customer") {
    const result = await createCustomerFlow(body);
    return jsonResponse(result);
  }

  return jsonResponse({ error: "Invalid type" }, 400);
};

// =========================
// 📦 Helpers
// =========================

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

// =========================
// 🔍 GET ONE USER
// =========================

const fetchUser = async (email: string) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return data;

  if (data.assignment_id?.length > 0) {
    const { data: assignments, error: assignmentError } = await supabase
      .from("assignments")
      .select("*")
      .in("id", data.assignment_id)
      .eq("role", "developer");

    if (assignmentError) throw new Error(assignmentError.message);

    const enrichedAssignments = await Promise.all(
      (assignments ?? []).map(async (assignment: any) => {
        const { data: customer } = await supabase
          .from("users")
          .select("clientName, linear_slug")
          .eq("id", assignment.customer_id)
          .maybeSingle();
        return {
          ...assignment,
          clientName: customer?.clientName ?? null,
          linear_slug: customer?.linear_slug ?? null,
        };
      })
    );

    return { ...data, assignment_id: enrichedAssignments };
  }

  return data;
};
