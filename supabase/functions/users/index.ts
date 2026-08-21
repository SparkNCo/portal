// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { createCustomerFlow } from "./createCustomerFlow.ts";
import { createUser } from "./createUser.ts";
import { resendAccountEmail } from "./resendAccountEmail.ts";
import { getAllUsers } from "./getAllUsers.ts";
import { updateUser } from "./updateUser.ts";
import { updateCustomer } from "./updateCustomer.ts";
import { getDeveloperProfile } from "./getDeveloperProfile.ts";
import { updateDeveloperProfile } from "./updateDeveloperProfile.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const schema = "portal";

    if (req.method === "GET") {
      console.log("[users GET]", {
        url: url.toString(),
        email: url.searchParams.get("email"),
        hasApiKey: !!req.headers.get("apikey"),
        hasAuth: !!req.headers.get("authorization"),
        apiKeyPrefix: req.headers.get("apikey")?.slice(0, 10),
      });
      return await handleGet(url, schema);
    }
    if (req.method === "PATCH") return await handlePatch(req, url, schema);
    if (req.method === "POST") return await handlePost(req, url, schema);

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("[Supabase Error]", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

const handleGet = async (url: URL, schema: string) => {
  const type = url.searchParams.get("type");
  const email = url.searchParams.get("email");

  if (type === "customers") {
    const { data: customerUsers, error: usersError } = await supabase.schema(schema)
      .from("users")
      .select("id, email, customer_id")
      .eq("role", "customer");
    if (usersError) throw new Error(usersError.message);

    const clientIds = (customerUsers ?? [])
      .map((u) => u.customer_id)
      .filter((id): id is string => Boolean(id) && UUID_RE.test(id));
    const { data: clients, error: clientsError } = await supabase.schema(schema)
      .from("customers")
      .select("customer_id, clientName, linear_slug, stripe_customer_id")
      .in("customer_id", clientIds);
    if (clientsError) throw new Error(clientsError.message);

    const clientMap = new Map((clients ?? []).map((c) => [c.customer_id, c]));

    const data = (customerUsers ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      customer_id: u.customer_id,
      clientName: clientMap.get(u.customer_id)?.clientName ?? null,
      linear_slug: clientMap.get(u.customer_id)?.linear_slug ?? null,
      stripe_customer_id: clientMap.get(u.customer_id)?.stripe_customer_id ?? null,
    }));

    return jsonResponse(data);
  }

  if (type === "developer-profile") {
    const userId = url.searchParams.get("userId");
    const profile = await getDeveloperProfile(userId, schema);
    return jsonResponse(profile);
  }

  if (!email) {
    const users = await getAllUsers(schema);
    return jsonResponse(users);
  }

  const user = await fetchUser(email, schema);
  return jsonResponse(user);
};

const handlePatch = async (req: Request, url: URL, schema: string) => {
  const body = await req.json();

  if (url.searchParams.get("type") === "developer-profile") {
    const updatedProfile = await updateDeveloperProfile(body, schema);
    return jsonResponse(updatedProfile);
  }

  if (url.searchParams.get("type") === "customer") {
    // Never trust body.customer_id for authorization — a customer editing
    // their own record (e.g. set-password) and an admin editing any
    // customer's billing info hit this same endpoint, so the caller's real
    // identity has to come from their own session, not a client-supplied id.
    const caller = await resolveCaller(req, schema);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);

    const updatedCustomer = await updateCustomer(body, schema, caller);
    return jsonResponse(updatedCustomer);
  }

  const updatedUser = await updateUser(body, schema);
  return jsonResponse(updatedUser);
};

const handlePost = async (req: Request, url: URL, schema: string) => {
  const body = await req.json();
  const type = url.searchParams.get("type");

  if (!type || type === "developer" || type === "stakeholder") {
    const newUser = await createUser(body, schema);
    return jsonResponse(newUser);
  }

  if (type === "customer") {
    const result = await createCustomerFlow(body, schema);
    return jsonResponse(result);
  }

  if (type === "resend-account-email") {
    // Never trust a client-supplied identity (e.g. body.requestedBy) for an
    // authorization check — resolve the caller from their bearer token so a
    // spoofed email can't be used to trigger resends for arbitrary users.
    const caller = await resolveCaller(req, schema);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);
    if (caller.role !== "admin") return jsonResponse({ error: "Unauthorized" }, 403);

    const result = await resendAccountEmail(body, schema);
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

// Resolves the calling user's own identity from their bearer token. On most
// requests `Authorization` is just the public anon key (not a real session
// token), so a missing/invalid token or no matching `users` row both resolve
// to `null` — callers must treat that as unauthenticated, never as "no
// restrictions".
const resolveCaller = async (
  req: Request,
  schema: string,
): Promise<{ email: string; role: string | null; customerId: string | null } | null> => {
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  const { data: authData, error: authError } = token
    ? await supabase.auth.getUser(token)
    : { data: null, error: new Error("Missing bearer token") };

  const callerEmail = authData?.user?.email;
  if (authError || !callerEmail) return null;

  const { data: requester } = await supabase.schema(schema)
    .from("users")
    .select("role, customer_id")
    .eq("email", callerEmail)
    .maybeSingle();

  return {
    email: callerEmail,
    role: requester?.role ?? null,
    customerId: requester?.customer_id ?? null,
  };
};

// =========================
// 🔍 GET ONE USER
// =========================

const fetchUser = async (email: string, schema: string) => {
  const { data, error } = await supabase.schema(schema)
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
    const { data: clientRow } = await supabase.schema(schema)
      .from("customers")
      .select("clientName, linear_slug, stripe_customer_id")
      .eq("customer_id", data.customer_id)
      .maybeSingle();
    client = clientRow;
  }
  data.clientName = client?.clientName ?? null;
  data.linear_slug = client?.linear_slug ?? null;
  data.stripe_customer_id = client?.stripe_customer_id ?? null;

  if (data.role === "developer") {
    const { data: developerRow } = await supabase.schema(schema)
      .from("developers")
      .select("developer_type")
      .eq("user_id", data.id)
      .maybeSingle();
    data.developerType = developerRow?.developer_type ?? "spark_fde";
  }

  if (data.assignment_id?.length > 0) {
    const { data: assignments, error: assignmentError } = await supabase.schema(schema)
      .from("assignments")
      .select("*")
      .in("id", data.assignment_id)
      .eq("role", data.role);

    if (assignmentError) throw new Error(assignmentError.message);

    const enrichedAssignments = await Promise.all(
      (assignments ?? []).map(async (assignment: any) => {
        const { data: customerUser } = await supabase.schema(schema)
          .from("users")
          .select("customer_id")
          .eq("id", assignment.customer_id)
          .maybeSingle();

        let client: { clientName?: string | null; linear_slug?: string | null } | null = null;
        if (customerUser?.customer_id && UUID_RE.test(customerUser.customer_id)) {
          const { data: clientRow } = await supabase.schema(schema)
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
