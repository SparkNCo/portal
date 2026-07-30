import { CometChat } from "@cometchat/chat-sdk-javascript";
import { COMETCHAT_CONSTANTS } from "./constants";
import { API_JSON_HEADERS } from "@/lib/api-headers";

const groupCreationInFlight = new Map<string, Promise<CometChat.Group>>();

// Same rationale as useCometChat.ts's SUPPORT_OWNER_UID: CometChat makes the
// creator the group's owner, and an owner can't leave without transferring
// ownership first — hand it off to the fixed staff account so whoever
// started the issue thread can still leave it later.
const SUPPORT_OWNER_UID = process.env.NEXT_PUBLIC_COMET_ADMIN_UID as string | undefined;

async function resolveGroupName(baseTitle: string): Promise<string> {
  const groupsReq = new CometChat.GroupsRequestBuilder().setLimit(100).build();
  let allGroups: CometChat.Group[] = [];
  try {
    allGroups = await groupsReq.fetchNext();
  } catch {}
  const taken = new Set(allGroups.map((g) => g.getName()));
  if (!taken.has(baseTitle)) return baseTitle;
  let n = 2;
  while (taken.has(`${baseTitle} ${n}`)) n++;
  return `${baseTitle} ${n}`;
}

async function fetchAssigneeUids(url: string, memberUids: Set<string>) {
  const res = await fetch(url, { headers: API_JSON_HEADERS });
  const assignees: any[] = await res.json();
  assignees.filter((a) => a.user_id).forEach((a) => memberUids.add(a.user_id));
}

// clientName shows up formatted differently depending on which flow produced
// it (raw vs slugified at onboarding) — fold case/spaces/hyphens so a slug
// from either flow still matches (same rationale as use-pinned-panels.ts).
function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[\s-]+/g, "-");
}

// Resolves a customer's own portal user id from their clientName-based slug
// — needed when a developer/admin (not the customer) sends the first
// message on an issue's chat, so the group can still be tagged with the
// right customer for admin's chat filter.
async function resolveCustomerIdBySlug(slug: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`,
      { headers: API_JSON_HEADERS },
    );
    const customers: { id: string; clientName: string }[] = await res.json();
    const match = customers.find(
      (c) => c.clientName && normalizeSlug(c.clientName) === normalizeSlug(slug),
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

function buildGroupGuid(issueId: string): string {
  const safeId = issueId.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  return `issue_${safeId}`;
}

/** Looks up the issue's CometChat group without creating one. Returns null if no one has sent a message yet. */
export async function getExistingIssueGroup(issueId: string): Promise<CometChat.Group | null> {
  try {
    return await CometChat.getGroup(buildGroupGuid(issueId));
  } catch {
    return null;
  }
}

async function buildIssueGroup(
  issueId: string,
  issueTitle: string,
  profile: any,
  slug?: string,
): Promise<CometChat.Group> {
  const deterministicGuid = buildGroupGuid(issueId);

  try {
    return await CometChat.getGroup(deterministicGuid);
  } catch {}

  const memberUids = new Set<string>();
  if (profile?.id) memberUids.add(profile.id);
  if (SUPPORT_OWNER_UID) memberUids.add(SUPPORT_OWNER_UID);

  // Tagged on the group so admins/developers viewing a specific customer's
  // dashboard (ChatLayout's customerId-scoped fetch) can find this chat —
  // same metadata shape as useCometChat.ts's createSupportGroup.
  let resolvedCustomerId: string | undefined =
    profile?.role === "customer" ? profile.id : undefined;

  try {
    if (profile?.role === "stakeholder") {
      const stakeholderRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${profile.id}`,
        { headers: API_JSON_HEADERS },
      );
      const stakeholderAssignments: any[] = await stakeholderRes.json();
      const customerIds = stakeholderAssignments.map((a) => a.customer_id).filter(Boolean);

      if (customerIds.length > 0) {
        resolvedCustomerId = customerIds[0];
        customerIds.forEach((id: string) => memberUids.add(id));
        await fetchAssigneeUids(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${customerIds[0]}&onlyDev=true`,
          memberUids,
        );
      }
    } else if (profile?.role === "customer") {
      await fetchAssigneeUids(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${profile.id}`,
        memberUids,
      );
    } else if (slug) {
      // Developer/admin sending the first message — resolve which customer
      // this issue belongs to from the page's own slug instead of guessing
      // off the creator's id (which isn't a customer_id at all here).
      const customerId = await resolveCustomerIdBySlug(slug);
      if (customerId) {
        resolvedCustomerId = customerId;
        memberUids.add(customerId);
        await fetchAssigneeUids(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${customerId}`,
          memberUids,
        );
      }
    }
  } catch {}

  await Promise.all(
    Array.from(memberUids).map(async (uid) => {
      try {
        await CometChat.getUser(uid);
      } catch (e: any) {
        if (e?.code === "ERR_UID_NOT_FOUND") {
          const u = new CometChat.User(uid);
          u.setName(uid);
          await CometChat.createUser(u, COMETCHAT_CONSTANTS.AUTH_KEY);
        }
      }
    }),
  );

  const groupName = await resolveGroupName(issueTitle);
  const group = new CometChat.Group(deterministicGuid, groupName, CometChat.GROUP_TYPE.PUBLIC, "");
  if (resolvedCustomerId) group.setMetadata({ customerId: resolvedCustomerId });
  const members = Array.from(memberUids).map(
    (uid) => new CometChat.GroupMember(uid, CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT),
  );

  const response = await CometChat.createGroupWithMembers(group, members, []);

  if (SUPPORT_OWNER_UID && profile?.id !== SUPPORT_OWNER_UID) {
    try {
      await CometChat.transferGroupOwnership(deterministicGuid, SUPPORT_OWNER_UID);
    } catch (transferErr) {
      console.error("Failed to transfer issue group ownership:", transferErr);
    }
  }

  return (response as any).group ?? response;
}

export function getOrCreateIssueGroup(
  issueId: string,
  issueTitle: string,
  profile: any,
  slug?: string,
): Promise<CometChat.Group> {
  if (groupCreationInFlight.has(issueId)) {
    return groupCreationInFlight.get(issueId)!;
  }
  const promise = buildIssueGroup(issueId, issueTitle, profile, slug);
  groupCreationInFlight.set(issueId, promise);
  promise.finally(() => groupCreationInFlight.delete(issueId));
  return promise;
}
