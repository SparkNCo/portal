// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

const AI_UID = Deno.env.get("AI_UID")!;
const APP_ID = Deno.env.get("COMETCHAT_APP_ID")!;
const API_KEY = Deno.env.get("COMETCHAT_API_KEY")!;
const REGION = Deno.env.get("COMETCHAT_REGION")!;

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
