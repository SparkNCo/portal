// @ts-nocheck
import { supabase } from "../client.ts";

// Every user. Developers also carry `developerType` ("spark_fde" or
// "internal" — the ones a customer added, shown as External to admins), read
// from portal.developers in one query for all of them. Missing = spark_fde,
// same default as the single-user lookup (index.ts → fetchUser).
export const getAllUsers = async (schema: string) => {
  const { data, error } = await supabase.schema(schema).from("users").select("*");

  if (error) throw new Error(error.message);

  const developerIds = (data ?? []).filter((u) => u.role === "developer").map((u) => u.id);
  if (developerIds.length === 0) return data;

  const { data: developers, error: developersError } = await supabase
    .schema(schema)
    .from("developers")
    .select("user_id, developer_type")
    .in("user_id", developerIds);

  if (developersError) throw new Error(developersError.message);

  const typeByUserId = new Map((developers ?? []).map((d) => [d.user_id, d.developer_type]));
  return data.map((u) =>
    u.role === "developer" ? { ...u, developerType: typeByUserId.get(u.id) ?? "spark_fde" } : u,
  );
};
