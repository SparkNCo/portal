import { CometChat } from "@cometchat/chat-sdk-javascript";
import { COMETCHAT_CONSTANTS } from "./constants";
import { API_JSON_HEADERS } from "@/lib/api-headers";

const groupCreationInFlight = new Map<string, Promise<CometChat.Group>>();

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
): Promise<CometChat.Group> {
  const deterministicGuid = buildGroupGuid(issueId);

  try {
    return await CometChat.getGroup(deterministicGuid);
  } catch {}

  const memberUids = new Set<string>();
  if (profile?.id) memberUids.add(profile.id);

  try {
    if (profile?.role === "stakeholder") {
      const stakeholderRes = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?developer=${profile.id}`,
        { headers: API_JSON_HEADERS },
      );
      const stakeholderAssignments: any[] = await stakeholderRes.json();
      const customerIds = stakeholderAssignments.map((a) => a.customer_id).filter(Boolean);

      if (customerIds.length > 0) {
        customerIds.forEach((id: string) => memberUids.add(id));
        await fetchAssigneeUids(
          `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?customer_id=${customerIds[0]}&onlyDev=true`,
          memberUids,
        );
      }
    } else if (profile?.id) {
      await fetchAssigneeUids(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?customer_id=${profile.id}`,
        memberUids,
      );
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
  const members = Array.from(memberUids).map(
    (uid) => new CometChat.GroupMember(uid, CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT),
  );

  const response = await CometChat.createGroupWithMembers(group, members, []);
  return (response as any).group ?? response;
}

export function getOrCreateIssueGroup(
  issueId: string,
  issueTitle: string,
  profile: any,
): Promise<CometChat.Group> {
  if (groupCreationInFlight.has(issueId)) {
    return groupCreationInFlight.get(issueId)!;
  }
  const promise = buildIssueGroup(issueId, issueTitle, profile);
  groupCreationInFlight.set(issueId, promise);
  promise.finally(() => groupCreationInFlight.delete(issueId));
  return promise;
}
