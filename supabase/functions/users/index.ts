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

    if (req.method === "GET") return handleGet(url);
    if (req.method === "PATCH") return handlePatch(req);
    if (req.method === "POST") return handlePost(req, url);

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
      .select("userName, linear_slug, email")
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

  if (!type || type === "developer") {
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

  return data;
};
