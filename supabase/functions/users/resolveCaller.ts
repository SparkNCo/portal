// @ts-nocheck
import { supabase } from "../client.ts";

// Resolves the calling user's own identity from their bearer token. On most
// requests `Authorization` is just the public anon key (not a real session
// token), so a missing/invalid token or no matching `users` row both resolve
// to `null` — callers must treat that as unauthenticated, never as "no
// restrictions".
export const resolveCaller = async (
  req: Request,
  schema: string,
): Promise<{ id: string; email: string; role: string | null; customerId: string | null } | null> => {
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
    .select("id, role, customer_id")
    .eq("email", callerEmail)
    .maybeSingle();

  return {
    id: requester?.id ?? authData.user.id,
    email: callerEmail,
    role: requester?.role ?? null,
    customerId: requester?.customer_id ?? null,
  };
};
