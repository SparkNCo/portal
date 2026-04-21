// @ts-nocheck
import { supabase } from "../client.ts";
import { LINEAR_GRAPHQL } from "../utils/headers.ts";
import { ISSUES_QUERY } from "./query.ts";
import { IssuesResponseSchema } from "./zod.ts";

async function getCustomerBySlug(slug: string) {
  const { data, error } = await supabase
    .from("customers")
    .select(
      `
      linear_projects,
      linear_initiative_id,
      linear_slug,
      proposal_id,
      stripe_customer_id
    `,
    )
    .eq("linear_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Supabase error:", error);
    throw new Error("Customer not found");
  }

  if (!data) {
    throw new Error("Customer not found");
  }

  return data;
}

async function fetchIssuesFromLinear(
  projectIds: string[],
  ticketStatuses?: string[],
) {
  const filter = {
    project: { id: { in: projectIds } },
    ...(ticketStatuses?.length
      ? { state: { name: { in: ticketStatuses } } }
      : {}),
  };

  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({
      query: ISSUES_QUERY,
      variables: { filter },
    }),
  });

  const json = await res.json();
  console.log("Linear API response:", json);

  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }

  const parsed = IssuesResponseSchema.safeParse(json);

  if (!parsed.success) {
    console.error("Invalid Linear response", parsed.error.format());
    throw new Error("Invalid response from Linear API");
  }

  return parsed.data.data.issues.nodes;
}

export async function handleGetIssues(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);

  const rawSlug = searchParams.get("slug");
  const slug = rawSlug ? decodeURIComponent(rawSlug) : null;

  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  const rawStatuses = searchParams.get("ticket_statuses");
  const ticketStatuses = rawStatuses
    ? rawStatuses
        .split(",")
        .map((s) => decodeURIComponent(s.trim()))
        .filter(Boolean)
    : undefined;

  const customer = await getCustomerBySlug(slug);

  if (!customer.linear_projects?.length) {
    throw new Error("No Linear projects configured");
  }

  const issues = await fetchIssuesFromLinear(
    customer.linear_projects,
    ticketStatuses,
  );

  return Response.json(issues);
}
