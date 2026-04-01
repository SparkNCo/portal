// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { createCustomerFlow } from "./createCustomerFlow.ts";
import { createUser } from "./createUser.ts";
import { getAllUsers } from "./getAllUsers.ts";
import { updateUser } from "./updateUser.ts";

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");

    // ✅ GET
    if (req.method === "GET") {
      // GET ALL
      if (!email) {
        const users = await getAllUsers();
        return jsonResponse(users);
      }

      // GET ONE
      const user = await fetchUser(email);
      return jsonResponse(user);
    }

    // ✅ PATCH (update user)
    if (req.method === "PATCH") {
      const body = await req.json();

      const updatedUser = await updateUser(body);
      return jsonResponse(updatedUser);
    }

    // ✅ POST (create user)
    if (req.method === "POST") {
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
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("[Supabase Error]", error);

    return jsonResponse({ error: error.message }, 500);
  }
});

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
