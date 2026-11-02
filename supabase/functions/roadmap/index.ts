// @ts-nocheck
// Roadmap timeline data, through the ticket-system wrapper (Linear or the
// customer's Jira — lib/tickets/provider.ts, adapters in
// lib/tickets/{linear,jira}/roadmap.ts).
//
//   ?slug=&group=active|completed|upcoming[&projectsAfter=]
//       → { initiative: { id, projects: { pageInfo, nodes } }, cycles }
//   ?cycleId=[&projectId=][&milestoneId=][&after=]  → issues in a cycle
//   ?milestoneId= | ?projectId= [&after=]           → issues of a milestone / project
import { corsHeaders } from "../utils/headers.ts";
import { TicketError } from "../lib/tickets/errors.ts";
import { customerBySlug, roadmapForCustomer, roadmapForId } from "../lib/tickets/provider.ts";

const EMPTY_PAGE = { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// An issue list: a cycle's (optionally narrowed), else a milestone's or a project's.
async function issues(searchParams: URLSearchParams) {
  const after = searchParams.get("after");
  const cycleId = searchParams.get("cycleId");
  const projectId = searchParams.get("projectId");
  const milestoneId = searchParams.get("milestoneId");

  if (cycleId) {
    return await (await roadmapForId(cycleId)).cycleIssues(cycleId, after, projectId, milestoneId);
  }
  if (milestoneId) {
    return await (await roadmapForId(milestoneId)).milestoneIssues(milestoneId, after);
  }
  return await (await roadmapForId(projectId!)).projectIssues(projectId!, after);
}

async function projects(searchParams: URLSearchParams) {
  const rawSlug = searchParams.get("slug");
  const slug = rawSlug ? decodeURIComponent(rawSlug) : null;
  if (!slug) return json({ error: "Missing slug" }, 400);

  const customer = await customerBySlug(slug);
  if (!customer) {
    console.error("[roadmap] no customer row for clientName", slug);
    throw new Error("Customer not found");
  }
  if (!customer.linear_slug) {
    console.error("[roadmap] customer has no linear_slug configured", { slug });
    return json({ error: "No Linear initiative configured" }, 400);
  }

  const projectsAfter = searchParams.get("projectsAfter");
  const rawGroup = searchParams.get("group");
  const group = rawGroup === "completed" || rawGroup === "upcoming" ? rawGroup : "active";

  const roadmap = roadmapForCustomer(customer);
  const data = await roadmap.projects(group, projectsAfter);

  // Cycles are fetched once, with the first page of the active group; the
  // completed/upcoming calls and "load more" pages skip them.
  const cycles = projectsAfter || group !== "active" ? EMPTY_PAGE : await roadmap.cycles(data?.initiative?.projects?.nodes ?? []);

  return json({ ...data, cycles });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("cycleId") || searchParams.get("milestoneId") || searchParams.get("projectId")) {
      return json(await issues(searchParams));
    }
    return await projects(searchParams);
  } catch (error) {
    if (error instanceof TicketError) return json({ error: error.message }, error.status);
    console.error("[roadmap] request failed", error.message);
    return json({ error: error.message }, 500);
  }
});
