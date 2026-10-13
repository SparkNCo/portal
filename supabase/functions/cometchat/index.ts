// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { markIssueUpdated } from "../utils/issueUpdates.ts";
import { notifyUsers } from "../utils/notify.ts";
import { escapeIlike } from "../utils/slug.ts";
import { linearRequest } from "../issues/linearClient.ts";

const AI_UID = Deno.env.get("AI_UID")!;
const APP_ID = Deno.env.get("COMETCHAT_APP_ID")!;
const API_KEY = Deno.env.get("COMETCHAT_API_KEY")!;
const REGION = Deno.env.get("COMETCHAT_REGION")!;

// Reverses buildGroupGuid (getOrCreateIssueGroup.ts): "_" back to "-" recovers
// the Linear issue id. Non-issue groups don't match the prefix.
function decodeIssueIdFromGroupId(groupId: string): string | null {
  if (!groupId?.startsWith("issue_")) return null;
  return groupId.slice("issue_".length).replaceAll("_", "-");
}

// CometChat's REST API lives on the app's own subdomain (same host the SDK
// uses: "<appId>.api-<region>.cometchat.io").
const COMETCHAT_API = `https://${APP_ID}.api-${REGION}.cometchat.io/v3`;
const MEDIA_TYPES = new Set(["image", "video", "audio", "file"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cometchatGet(path: string) {
  const res = await fetch(`${COMETCHAT_API}${path}`, {
    headers: { appId: APP_ID, apiKey: API_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CometChat ${path} → ${res.status}`);
  return (await res.json())?.data;
}

// The /{slug}/chat page of the customer a group belongs to (its metadata's
// customerId, else the projectSlug support chats are tagged with).
// The portal user behind a CometChat UID. Members are added by portal.users
// id, but people log into CometChat with their Supabase Auth id, which isn't
// always the same (and auth_id is rarely filled in) — so fall back to the
// Auth account's email, like the rest of the app.
async function portalUserForUid(uid: string): Promise<{ id: string; email: string } | null> {
  if (!UUID_RE.test(uid)) return null;
  const { data: byId } = await supabase.schema("portal")
    .from("users").select("id, email").eq("id", uid).maybeSingle();
  if (byId) return byId;
  const { data: authUser } = await supabase.auth.admin.getUserById(uid);
  const email = authUser?.user?.email;
  if (!email) return null;
  const { data: byEmail } = await supabase.schema("portal")
    .from("users").select("id, email").ilike("email", escapeIlike(email)).maybeSingle();
  return byEmail ?? null;
}

// @mentions arrive in the text as "<@uid:UID>" (CometChat's mention format;
// see components/chat/mentions.ts).
const MENTION_TOKEN = /<@uid:([^>\s]+)>/g;

function displayName(u: { firstName?: string | null; lastName?: string | null; userName?: string | null; email?: string | null }) {
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return full || u.userName || u.email || "someone";
}

// The portal users a message mentions, and its text with each token shown as
// "@Name" (for the notification preview). Unknown uids read "@someone".
async function resolveMentions(text: string): Promise<{ text: string; userIds: string[] }> {
  const uids = [...new Set([...text.matchAll(MENTION_TOKEN)].map((m) => m[1]))];
  if (uids.length === 0) return { text, userIds: [] };

  const portalIdByUid = new Map<string, string>();
  await Promise.all(
    uids.map(async (uid) => {
      const user = await portalUserForUid(uid);
      if (user) portalIdByUid.set(uid, user.id);
    }),
  );
  const ids = [...new Set(portalIdByUid.values())];
  const { data: users } = ids.length
    ? await supabase.schema("portal").from("users").select("id, firstName, lastName, userName, email").in("id", ids)
    : { data: [] };
  const nameById = new Map((users ?? []).map((u: any) => [u.id, displayName(u)]));

  return {
    text: text.replace(MENTION_TOKEN, (_, uid: string) => `@${nameById.get(portalIdByUid.get(uid) ?? "") ?? "someone"}`),
    userIds: ids,
  };
}

// A reply quotes another message (components/chat — CometChat's
// quotedMessage). Who wrote the quoted one: from the payload when it carries
// that message, else looked up by its id. Undefined if it isn't a reply or
// that can't be worked out.
async function quotedAuthorUid(message: any): Promise<string | undefined> {
  const quoted = message?.quotedMessage ?? message?.data?.quotedMessage;
  const fromPayload =
    quoted?.sender?.uid ?? (typeof quoted?.sender === "string" ? quoted.sender : undefined) ??
    quoted?.data?.entities?.sender?.entity?.uid;
  if (fromPayload) return fromPayload;

  const quotedId = message?.quotedMessageId ?? message?.data?.quotedMessageId ?? quoted?.id;
  if (!quotedId) return undefined;
  const found = await cometchatGet(`/messages/${encodeURIComponent(String(quotedId))}`).catch((err) => {
    console.error("[cometchat] quoted message lookup failed:", err);
    return null;
  });
  return found?.sender ?? found?.data?.entities?.sender?.entity?.uid ?? undefined;
}

const ISSUE_PROJECT_QUERY = `
  query IssueProject($id: String!) {
    issue(id: $id) { title project { id } }
  }
`;

type ChatContext = { title: string | null; link: string; memberIds: string[] };

// A ticket's chat (group "issue_<id>") belongs to the customer whose Linear
// projects include that ticket's project. Resolved from our own data — the
// same people getOrCreateIssueGroup adds to the group (the customer and
// everyone assigned to them) — so it doesn't depend on CometChat's API.
async function issueChatContext(issueId: string): Promise<ChatContext | null> {
  const data = await linearRequest(ISSUE_PROJECT_QUERY, { id: issueId });
  const projectId = data?.issue?.project?.id;
  if (!projectId) return null;

  const { data: customer } = await supabase.schema("portal")
    .from("customers")
    .select("customer_id, clientName")
    .contains("linear_projects", [projectId])
    .limit(1)
    .maybeSingle();
  if (!customer?.clientName) return null;

  const { data: customerUser } = await supabase.schema("portal")
    .from("users")
    .select("id")
    .eq("customer_id", customer.customer_id)
    .eq("role", "customer")
    .maybeSingle();
  const { data: assignments } = customerUser?.id
    ? await supabase.schema("portal").from("assignments").select("user_id").eq("customer_id", customerUser.id)
    : { data: [] };

  return {
    title: data.issue.title ?? null,
    link: `/${encodeURIComponent(customer.clientName.toLowerCase())}/chat`,
    memberIds: [customerUser?.id, ...(assignments ?? []).map((a: { user_id: string }) => a.user_id)].filter(Boolean),
  };
}

async function chatPageFor(metadata: { customerId?: string; projectSlug?: string } | undefined): Promise<string> {
  let clientName: string | null = null;
  if (metadata?.customerId) {
    const { data: customerUser } = await supabase.schema("portal")
      .from("users").select("customer_id").eq("id", metadata.customerId).maybeSingle();
    if (customerUser?.customer_id) {
      const { data: customer } = await supabase.schema("portal")
        .from("customers").select("clientName").eq("customer_id", customerUser.customer_id).maybeSingle();
      clientName = customer?.clientName ?? null;
    }
  }
  clientName ??= metadata?.projectSlug ?? null;
  return clientName ? `/${encodeURIComponent(clientName.toLowerCase())}/chat` : "/chat";
}

// Bell notification for a CometChat group message — the group's members and
// every admin, minus the sender (matched by either of their ids, see
// portalUserForUid). One
// unread notification per chat (see upsertNotificationForEvent). Realtime
// chats get the same from the notify_chat_message DB trigger instead.
// Best-effort: errors are logged, never thrown.
async function notifyChatMessage(groupId: string, senderId: string, message: any) {
  try {
    const sender = await portalUserForUid(senderId);
    const senderIds = new Set([senderId, sender?.id].filter(Boolean));

    // Which initiative the chat belongs to, who's in it, and its title:
    // ticket chats from our own data; other (support) chats from CometChat's
    // API. If neither works, the admins still get it (generic link).
    const issueId = decodeIssueIdFromGroupId(groupId);
    let context: ChatContext | null = issueId
      ? await issueChatContext(issueId).catch((err) => {
          console.error("[cometchat] issue chat lookup failed:", err);
          return null;
        })
      : null;
    if (!context) {
      const [group, members] = await Promise.all([
        cometchatGet(`/groups/${encodeURIComponent(groupId)}`).catch((err) => {
          console.error("[cometchat] group lookup failed:", err);
          return null;
        }),
        cometchatGet(`/groups/${encodeURIComponent(groupId)}/members?perPage=100`).catch((err) => {
          console.error("[cometchat] members lookup failed:", err);
          return [];
        }),
      ]);
      context = {
        title: group?.name ?? null,
        link: await chatPageFor(group?.metadata),
        memberIds: (members ?? []).map((m: any) => m.uid),
      };
    }

    const memberUids = context.memberIds.filter(
      (uid: string) => uid && !senderIds.has(uid) && uid !== AI_UID && UUID_RE.test(uid),
    );
    // Only portal users can get a notification row.
    const { data: memberUsers } = memberUids.length
      ? await supabase.schema("portal").from("users").select("id").in("id", memberUids)
      : { data: [] };
    const memberIds = (memberUsers ?? []).map((u: { id: string }) => u.id);

    const rawText = message?.text ?? message?.data?.text;
    const type = message?.type;
    // Mentions read as "@Name" in the preview; the people mentioned get their
    // own "mentioned you" notification instead of the plain one.
    const mentions = await resolveMentions(String(rawText ?? ""));
    const mentionedIds = mentions.userIds.filter((id) => !senderIds.has(id));
    const preview = mentions.text.trim()
      ? mentions.text.slice(0, 140)
      : MEDIA_TYPES.has(type)
        ? "Sent an attachment"
        : "";

    const common = {
      actorEmail: sender?.email ?? "",
      objectId: groupId,
      objectTitle: context.title ?? undefined,
      link: context.link,
      preview,
    };

    if (mentionedIds.length) {
      await notifyUsers({ ...common, userIds: mentionedIds, action: "chat_mention", objectType: "chat_mention" });
    }

    // A reply: whoever wrote the quoted message gets "replied to you" —
    // unless it's their own message, or they were just mentioned in it
    // (one notification per message is enough).
    const quotedUid = await quotedAuthorUid(message);
    const quotedAuthor = quotedUid ? await portalUserForUid(quotedUid) : null;
    const repliedToIds =
      quotedAuthor && !senderIds.has(quotedAuthor.id) && !mentionedIds.includes(quotedAuthor.id) ? [quotedAuthor.id] : [];
    if (repliedToIds.length) {
      // Same object_type as a mention: both are "addressed to you" in that
      // chat (kept apart from its plain notification, see notify.ts).
      await notifyUsers({ ...common, userIds: repliedToIds, action: "chat_reply", objectType: "chat_mention" });
    }

    await notifyUsers({
      ...common,
      userIds: memberIds,
      includeAdmins: true,
      excludeUserIds: [...mentionedIds, ...repliedToIds],
      action: "chat_message",
      objectType: "chat",
    });
  } catch (err) {
    console.error("[cometchat] chat notification failed (non-fatal):", err);
  }
}

Deno.serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const { pathname } = url;

    // ===============================
    // 🔔 COMETCHAT WEBHOOK ENDPOINT
    // ===============================
    if (req.method === "POST" && pathname === "/cometchat") {
      const body = await req.json();
      // CometChat v3 webhooks nest the message under data.message (with the
      // text in message.data.text and sender possibly an object); older
      // payloads put it straight in data. Accept both.
      const message = body?.data?.message ?? body?.data;

      if (!message) {
        console.log("[cometchat] no message in payload:", JSON.stringify(body).slice(0, 500));
        return new Response("No data", { status: 200 });
      }

      const text = message.data?.text ?? message.text;
      const groupId = message.receiver?.guid ?? message.receiver;
      const receiverType = message.receiverType;
      const sender = message.sender?.uid ?? message.sender;
      const data = { ...message, text };

      console.log("📩 Incoming message:", JSON.stringify({ trigger: body?.trigger, groupId, receiverType, sender, type: message.type }));

      // ❌ Only brand-new messages. The webhook also gets a message's edits
      // and deletes (and CometChat's own "action" entries for them) — they
      // must not notify again or get an AI reply. Checked several ways since
      // the payload differs by trigger and webhook version.
      const trigger = String(body?.trigger ?? "").toLowerCase();
      const category = String(message.category ?? "").toLowerCase();
      const isEditOrDelete =
        trigger.includes("edit") ||
        trigger.includes("delet") ||
        !!(message.editedAt || message.editedBy || message.deletedAt || message.deletedBy) ||
        (category !== "" && category !== "message");
      if (isEditOrDelete) {
        return new Response("Edit/delete ignored", { status: 200 });
      }

      // ❌ Nothing to act on: no text and no attachment (what a deleted
      // message looks like if it slips past the check above). Without this
      // it produced a blank "sent a message" notification.
      if (!String(text ?? "").trim() && !MEDIA_TYPES.has(message.type)) {
        return new Response("Empty message ignored", { status: 200 });
      }

      // ❌ Ignore non-group messages
      if (receiverType !== "group") {
        return new Response("Ignored", { status: 200 });
      }

      // ❌ Prevent AI replying to itself
      if (sender === AI_UID) {
        return new Response("AI self-message ignored", {
          status: 200,
        });
      }

      // 🔔 Flag the issue as updated. `sender` (CometChat UID) = portal.users.id,
      // resolved to an email for markIssueUpdated.
      const issueId = decodeIssueIdFromGroupId(groupId);
      if (issueId) {
        const { data: sendingUser } = await supabase
          .schema("portal")
          .from("users")
          .select("email")
          .eq("id", sender)
          .maybeSingle();
        if (sendingUser?.email) {
          await markIssueUpdated(issueId, sendingUser.email);
        }
      }

      // Bell notifications, in the background so the AI reply isn't delayed.
      EdgeRuntime.waitUntil(notifyChatMessage(groupId, sender, data));

      // ===============================
      // 🤖 CALL AI ASSISTANT
      // ===============================
      console.log("calling asistant");

      const aiRes = await fetch(
        `${COMETCHAT_API}/ai/conversations`,
        {
          method: "POST",
          headers: {
            appId: APP_ID,
            apiKey: API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assistantId: AI_UID,
            // Not the raw "<@uid:…>" tokens.
            message: String(text ?? "").replace(MENTION_TOKEN, "@someone"),
            sessionId: groupId,
          }),
        },
      );
      console.log("aiRes", aiRes);

      const aiJson = await aiRes.json();
      const aiText = aiJson?.data?.text || "I couldn't respond.";
      console.log("aiJson", aiJson);

      console.log("🤖 AI Reply:", aiText);

      // ===============================
      // 📤 SEND MESSAGE BACK TO GROUP
      // ===============================
      await fetch(`${COMETCHAT_API}/messages`, {
        method: "POST",
        headers: {
          appId: APP_ID,
          apiKey: API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiver: groupId,
          receiverType: "group",
          category: "message",
          type: "text",
          data: {
            text: aiText,
          },
          sender: AI_UID,
        }),
      });

      return new Response("AI replied", {
        status: 200,
        headers: corsHeaders,
      });
    }

    // ===============================
    // 🔹 EXISTING ROUTES
    // ===============================
    if (req.method === "GET" && pathname === "/storage") {
      return await getStorageData(req);
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error("Webhook error:", err);

    return new Response("Server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
