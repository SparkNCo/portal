import { developerPanelPath, routeSlugFor } from "@/lib/developer-routes";

// Who may open which /{slug} route, and where to send them otherwise. Used
// by the [slug] layout (app/[slug]/(portal)/layout.tsx). This only controls
// what the app shows — the edge functions don't check the caller yet.

type Assignment = { clientName?: string | null; linear_slug?: string | null };
type ProfileForAccess = {
  role?: string | null;
  clientName?: string | null;
  assignment_id?: unknown;
} | null | undefined;

const KNOWN_ROLES = new Set(["admin", "customer", "stakeholder", "developer"]);

export type SlugAccess =
  | { kind: "allowed" }
  // reason "initiative": not one of theirs; "page": theirs, but a page their
  // role doesn't use (see PAGE_ROLES).
  | { kind: "redirect"; to: string; reason: "initiative" | "page" }
  | { kind: "not-set-up" };

// Pages under /{slug} that only some roles use; every other page is open to
// any role that can open the initiative.
const PAGE_ROLES: Record<string, string[]> = {
  developer: ["developer"],
  settings: ["admin", "customer", "stakeholder"],
  // The client-facing overview pages; developers work from their own
  // Developer page instead.
  dashboard: ["admin", "customer", "stakeholder"],
  monitor: ["admin", "customer", "stakeholder"],
};

// Where a role starts inside an initiative it can open.
function initiativeHomePath(role: string, slug: string): string {
  return `/${routeSlugFor(slug)}/${role === "developer" ? "developer" : "dashboard"}`;
}

function sameSlug(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function assignments(profile: ProfileForAccess): Assignment[] {
  return Array.isArray(profile?.assignment_id) ? (profile.assignment_id as Assignment[]) : [];
}

// Slugs the user's own initiatives can appear under. Route slugs are the
// customer's clientName lowercased; linear_slug is accepted too since some
// older links were built from it.
function ownSlugs(profile: ProfileForAccess): string[] {
  if (profile?.role === "customer") return profile.clientName ? [profile.clientName] : [];
  const fromAssignments = assignments(profile).flatMap((a) => [a.clientName, a.linear_slug]);
  // Stakeholders fall back to the profile's own clientName for their home
  // page (getStakeholderClientSlug), so it has to be openable too.
  const extra = profile?.role === "stakeholder" ? [profile.clientName] : [];
  return [...fromAssignments, ...extra].filter((s): s is string => !!s);
}

// The page each role lands on after login, or null if there's nowhere valid
// to send them (no linked client / no role).
export function homePathFor(profile: ProfileForAccess, selectedProject?: string | null): string | null {
  switch (profile?.role) {
    case "admin":
      return "/admin/users";
    case "customer":
      return profile.clientName ? `/${routeSlugFor(profile.clientName)}/dashboard` : null;
    case "stakeholder": {
      const first = assignments(profile)[0];
      const slug = first?.clientName ?? first?.linear_slug ?? profile.clientName;
      return slug ? `/${routeSlugFor(slug)}/dashboard` : null;
    }
    case "developer":
      // /dev/developer when unassigned — it explains there's nothing yet.
      return developerPanelPath(profile, "developer", selectedProject);
    default:
      return null;
  }
}

// `page` is the segment after the slug (e.g. "build" in /acme/build).
export function checkSlugAccess(
  profile: ProfileForAccess,
  slug: string | null | undefined,
  selectedProject?: string | null,
  page?: string | null,
): SlugAccess {
  if (!profile?.role || !KNOWN_ROLES.has(profile.role)) return { kind: "not-set-up" };

  const canOpenInitiative =
    profile.role === "admin" || (!!slug && ownSlugs(profile).some((s) => sameSlug(s, slug)));
  if (!canOpenInitiative) {
    const home = homePathFor(profile, selectedProject);
    return home ? { kind: "redirect", to: home, reason: "initiative" } : { kind: "not-set-up" };
  }

  const pageRoles = page ? PAGE_ROLES[page] : undefined;
  if (slug && pageRoles && !pageRoles.includes(profile.role)) {
    return { kind: "redirect", to: initiativeHomePath(profile.role, slug), reason: "page" };
  }
  return { kind: "allowed" };
}
