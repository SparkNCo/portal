// @ts-nocheck
import { supabase } from "../client.ts";
import { LINEAR_GRAPHQL } from "../utils/headers.ts";
import { escapeIlike } from "../utils/slug.ts";
import { ISSUES_QUERY } from "./query.ts";
import { IssuesResponseSchema } from "./zod.ts";
import { syncCustomerLinearProjects } from "./syncLinearProjects.ts";

async function getCustomerBySlug(slug: string, schema: string) {
  console.log("getCustomerBySlug", slug);

  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .select(
      `
      customer_id,
      linear_projects,
      linear_slug
    `,
    )
    .ilike("clientName", escapeIlike(slug))
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

  const EXCLUDED_AUTHORS = new Set(["cursor", "codex"]);

  return parsed.data.data.issues.nodes.map((issue: any) => ({
    ...issue,
    comments: {
      nodes: (issue.comments?.nodes ?? [])
        .filter((c: any) => {
          const name = c.user?.displayName?.toLowerCase();
          return name && !EXCLUDED_AUTHORS.has(name);
        })
        .map((c: any) => ({
          id: c.id,
          body: extractText(c.bodyData),
          createdAt: c.createdAt,
          displayName: c.user?.displayName ?? null,
        })),
    },
  }));
}

function extractText(bodyData: string): string {
  try {
    const doc = JSON.parse(bodyData);
    const texts: string[] = [];
    function walk(node: any) {
      if (node.type === "text" && typeof node.text === "string") {
        texts.push(node.text);
      }
      if (Array.isArray(node.content)) node.content.forEach(walk);
    }
    walk(doc);
    return texts.join(" ").trim();
  } catch {
    return bodyData;
  }
}

export async function handleGetIssues(req: Request): Promise<Response> {
  const schema = "portal";
  const { searchParams } = new URL(req.url);

  const rawSlug = searchParams.get("linear_slug") ?? searchParams.get("slug");
  const slug = rawSlug ? decodeURIComponent(rawSlug) : null;

  if (!slug) {
    return Response.json({ error: "Missing linear_slug" }, { status: 400 });
  }

  const rawStatuses = searchParams.get("ticket_statuses");
  const ticketStatuses = rawStatuses
    ? rawStatuses
        .split(",")
        .map((s) => decodeURIComponent(s.trim()))
        .filter(Boolean)
    : undefined;

  const customer = await getCustomerBySlug(slug, schema);

  let projectIds: string[] = customer.linear_projects ?? [];

  // Re-sync on every fetch (not just when empty) — linear_projects is
  // otherwise a stale snapshot the moment a new project is added to the
  // initiative, regardless of which role is the one viewing this customer's
  // dashboard. Falls back to whatever was already stored if the sync itself
  // fails, so a Linear hiccup doesn't take the whole page down.
  if (customer.linear_slug) {
    const synced = await syncCustomerLinearProjects(customer.customer_id, customer.linear_slug, schema);
    if (synced) {
      projectIds = synced;
      console.log(`Synced ${synced.length} projects for ${slug}`);
    }
  }

  if (!projectIds.length) {
    throw new Error(
      customer.linear_slug
        ? `No projects found in Linear for initiative: ${customer.linear_slug}`
        : "No Linear projects configured and no linear_slug to look them up",
    );
  }

  const issues = await fetchIssuesFromLinear(projectIds, ticketStatuses);

  return Response.json(issues);
}
