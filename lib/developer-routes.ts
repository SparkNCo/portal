// Where a developer's pages live. Every initiative page is under
// /{slug}/… (slug = the customer's clientName, lowercased — the same route
// customers and admins use); the only developer page outside it is
// /dev/chat. Which initiative to open comes from, in order: the URL, the
// project last picked in the sidebar's "Working on" dropdown, then the
// developer's first assignment.

type ProfileWithAssignments = { assignment_id?: unknown } | null | undefined;

export function routeSlugFor(clientName: string): string {
  return encodeURIComponent(clientName.toLowerCase());
}

// The developer's assigned initiatives, by clientName, in assignment order.
export function developerProjectNames(profile: ProfileWithAssignments): string[] {
  const assignments = Array.isArray(profile?.assignment_id) ? (profile.assignment_id as any[]) : [];
  return [...new Set(assignments.map((a) => a?.clientName as string).filter(Boolean))];
}

// The assigned initiative matching `preferred` (case-insensitive — URL slugs
// are lowercased, clientNames aren't), else the first assignment.
export function pickDeveloperProject(
  profile: ProfileWithAssignments,
  ...preferred: (string | null | undefined)[]
): string | null {
  const projects = developerProjectNames(profile);
  for (const candidate of preferred) {
    if (!candidate) continue;
    const match = projects.find((p) => p.toLowerCase() === candidate.toLowerCase());
    if (match) return match;
  }
  return projects[0] ?? null;
}

// `/{slug}/{panel}` for the developer's initiative, or `/dev/{panel}` when
// they have no assignments yet (that route explains there's nothing to show).
export function developerPanelPath(
  profile: ProfileWithAssignments,
  panel: string,
  ...preferred: (string | null | undefined)[]
): string {
  const project = pickDeveloperProject(profile, ...preferred);
  return project ? `/${routeSlugFor(project)}/${panel}` : `/dev/${panel}`;
}
