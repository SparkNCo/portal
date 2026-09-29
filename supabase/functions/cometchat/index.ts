// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";
import { markIssueUpdated } from "../utils/issueUpdates.ts";

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
      const data = body?.data;

      if (!data) {
        return new Response("No data", { status: 200 });
      }
      const dataRaw = data;

      const text = data.text;
      const groupId = data.receiver;
      const receiverType = data.receiverType;
      const sender = data.sender;

      console.log("📩 Incoming message:", dataRaw);

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

      // ===============================
      // 🤖 CALL AI ASSISTANT
      // ===============================
      console.log("calling asistant");

      const aiRes = await fetch(
        `https://api-${REGION}.cometchat.io/v3/ai/conversations`,
        {
          method: "POST",
          headers: {
            appId: APP_ID,
            apiKey: API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assistantId: AI_UID,
            message: text,
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
      await fetch(`https://api-${REGION}.cometchat.io/v3/messages`, {
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
