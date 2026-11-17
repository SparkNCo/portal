import { homePathFor } from "@/lib/route-access";

// Where the login page sends someone once their portal profile has loaded
// (app/login/Login.tsx). Pure logic, so every role's destination is unit
// tested (tests/unit/login-destination.spec.ts).
//
// - Their home page comes from homePathFor, the same rule the [slug] layout
//   uses to send people home, so login and the access check never disagree.
// - A page they were opening before logging in (`redirectTo`, from
//   lib/login-redirect.ts) wins over the home page, but only for an account
//   that has a home page: an account that isn't set up never follows it.
//   That page's own access check still runs after the redirect.

type ProfileForLogin = Parameters<typeof homePathFor>[0];

export type LoginDestination =
  | { kind: "go"; to: string }
  // signOut: whether the login page ends the session along with the message.
  | { kind: "error"; message: string; signOut: boolean };

export const LOGIN_ERROR_MESSAGES = {
  noClientAssigned: "No client assigned to this account. Contact your administrator.",
  notSetUp: "Your account isn't set up yet. Contact your administrator.",
} as const;

export function loginDestination(
  profile: ProfileForLogin,
  redirectTo: string | null,
  selectedProject?: string | null,
): LoginDestination {
  const home = homePathFor(profile, selectedProject);
  if (home) {
    return { kind: "go", to: redirectTo ?? home };
  }
  // A stakeholder waiting for an admin to assign them keeps their session:
  // nothing is wrong with the account itself.
  if (profile?.role === "stakeholder") {
    return { kind: "error", message: LOGIN_ERROR_MESSAGES.noClientAssigned, signOut: false };
  }
  // Unknown role (e.g. an assessment "lead"), or a customer with no linked
  // client: no page to send them to.
  return { kind: "error", message: LOGIN_ERROR_MESSAGES.notSetUp, signOut: true };
}
