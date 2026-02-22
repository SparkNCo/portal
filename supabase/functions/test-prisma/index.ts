// @ts-nocheck

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("PROJECT_URL")!,
  Deno.env.get("SERVICE_SECRET_KEY")!,
);

Deno.serve(async (_req) => {
  console.log("Fetching leads...");

  const { data, error } = await supabase.from("proposals").select("*");

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
