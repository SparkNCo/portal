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
    const { data: customerUsers, error: usersError } = await supabase.schema("portal")
      .from("users")
      .select("id, email, customer_id")
      .eq("role", "customer");
    if (usersError) throw new Error(usersError.message);

    const clientIds = (customerUsers ?? [])
      .map((u) => u.customer_id)
      .filter((id): id is string => Boolean(id) && UUID_RE.test(id));
    const { data: clients, error: clientsError } = await supabase.schema("portal")
      .from("customers")
      .select("customer_id, clientName, linear_slug")
      .in("customer_id", clientIds);
    if (clientsError) throw new Error(clientsError.message);

    const clientMap = new Map((clients ?? []).map((c) => [c.customer_id, c]));

    const data = (customerUsers ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      customer_id: u.customer_id,
      clientName: clientMap.get(u.customer_id)?.clientName ?? null,
      linear_slug: clientMap.get(u.customer_id)?.linear_slug ?? null,
    }));

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

// `users.customer_id` may still hold legacy Stripe customer IDs (e.g. "cus_...")
// for rows that predate the customers table migration; only UUIDs match `customers.customer_id`.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const { data, error } = await supabase.schema("portal")
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return data;

  // `linear_slug`/`clientName` moved off `users` onto `customers`; merge them
  // back into the profile when this user is linked to a client record.
  let client: { clientName?: string | null; linear_slug?: string | null; stripe_customer_id?: string | null } | null = null;
  if (data.customer_id && UUID_RE.test(data.customer_id)) {
    const { data: clientRow } = await supabase.schema("portal")
      .from("customers")
      .select("clientName, linear_slug, stripe_customer_id")
      .eq("customer_id", data.customer_id)
      .maybeSingle();
    client = clientRow;
  }
  data.clientName = client?.clientName ?? null;
  data.linear_slug = client?.linear_slug ?? null;
  data.stripe_customer_id = client?.stripe_customer_id ?? null;

  if (data.assignment_id?.length > 0) {
    const { data: assignments, error: assignmentError } = await supabase.schema("portal")
      .from("assignments")
      .select("*")
      .in("id", data.assignment_id)
      .eq("role", data.role);

    if (assignmentError) throw new Error(assignmentError.message);

    const enrichedAssignments = await Promise.all(
      (assignments ?? []).map(async (assignment: any) => {
        const { data: customerUser } = await supabase.schema("portal")
          .from("users")
          .select("customer_id")
          .eq("id", assignment.customer_id)
          .maybeSingle();

        let client: { clientName?: string | null; linear_slug?: string | null } | null = null;
        if (customerUser?.customer_id && UUID_RE.test(customerUser.customer_id)) {
          const { data: clientRow } = await supabase.schema("portal")
            .from("customers")
            .select("clientName, linear_slug")
            .eq("customer_id", customerUser.customer_id)
            .maybeSingle();
          client = clientRow;
        }

        return {
          ...assignment,
          clientName: client?.clientName ?? null,
          linear_slug: client?.linear_slug ?? null,
        };
      })
    );

    return { ...data, assignment_id: enrichedAssignments };
  }

  return data;
};
