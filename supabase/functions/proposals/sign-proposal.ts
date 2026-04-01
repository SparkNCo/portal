// sign-proposal.ts
// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { ProposalLookupSchema, SignProposalSchema } from "./zod.ts";

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export async function signProposal(req: Request): Promise<Response> {
  console.log("[signProposal] 🔵 Incoming request:", {
    method: req.method,
    url: req.url,
  });

  if (req.method === "OPTIONS") {
    console.log("[signProposal] 🟡 OPTIONS preflight");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[signProposal] 🟢 Raw body received:", {
      proposalId: body?.proposalId,
      hasSignature: !!body?.signatureBase64,
      signatureLength: body?.signatureBase64?.length,
    });

    /* ----------------------------------
       Validate body
    ----------------------------------- */
    const parsedBody = SignProposalSchema.safeParse(body);

    if (!parsedBody.success) {
      console.error(
        "[signProposal] ❌ Body validation failed:",
        parsedBody.error.flatten(),
      );
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parsedBody.error.flatten(),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const { proposalId, signatureBase64 } = parsedBody.data;
    console.log("[signProposal] ✅ Body validated:", { proposalId });

    /* ----------------------------------
       1. Fetch proposal
    ----------------------------------- */
    console.log("[signProposal] 🔍 Fetching proposal...");

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("passcode, stage")
      .eq("passcode", proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error("[signProposal] ❌ Proposal fetch failed:", proposalError);
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[signProposal] ✅ Proposal fetched:", proposal);

    /* ----------------------------------
       Validate proposal shape
    ----------------------------------- */
    const parsedProposal = ProposalLookupSchema.safeParse(proposal);

    if (!parsedProposal.success) {
      console.error(
        "[signProposal] ❌ Invalid proposal shape:",
        parsedProposal.error,
      );
      return new Response(JSON.stringify({ error: "Invalid proposal data" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[signProposal] 🧠 Proposal stage:", parsedProposal.data.stage);

    if (parsedProposal.data.stage === "accepted") {
      console.warn("[signProposal] ⚠️ Proposal already accepted");
      return new Response(
        JSON.stringify({ error: "Proposal already signed" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    /* ----------------------------------
       2. Check existing signature
    ----------------------------------- */
    const folderPath = `proposal-${proposalId}`;
    console.log("[signProposal] 📁 Checking storage folder:", folderPath);

    const { data: existingFiles, error: listError } = await supabase.storage
      .from("signatures_bucket")
      .list(folderPath);

    if (listError) {
      console.error("[signProposal] ❌ Storage list error:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing signature" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.log("[signProposal] 📂 Existing files:", existingFiles);

    if (existingFiles?.some((file) => file.name === "signature.png")) {
      console.warn("[signProposal] ⚠️ Signature already exists");
      return new Response(
        JSON.stringify({ error: "Signature already exists" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    /* ----------------------------------
       3. Upload signature
    ----------------------------------- */
    console.log("[signProposal] ⬆️ Uploading signature...");

    const bytes = base64ToUint8Array(signatureBase64);
    console.log("[signProposal] 📦 Converted to bytes:", bytes.length);

    const filePath = `${folderPath}/signature.png`;

    const { error: uploadError } = await supabase.storage
      .from("signatures_bucket")
      .upload(filePath, bytes, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("[signProposal] ❌ Upload failed:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload signature" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.log("[signProposal] ✅ Upload successful:", filePath);

    /* ----------------------------------
       4. Get public URL
    ----------------------------------- */
    const { data: publicUrlData } = supabase.storage
      .from("signatures_bucket")
      .getPublicUrl(filePath);

    console.log("[signProposal] 🌐 Public URL:", publicUrlData?.publicUrl);

    /* ----------------------------------
       5. Update proposal
    ----------------------------------- */
    const header = signatureBase64.split(",");

    console.log("[signProposal] 📝 Updating proposal...");

    const { error: updateError } = await supabase
      .from("proposals")
      .update({
        signature_url: publicUrlData.publicUrl,
        signed_at: new Date().toISOString(),
        // signature_header: header,
        stage: "accepted",
      })
      .eq("passcode", proposalId);

    if (updateError) {
      console.error("[signProposal] ❌ Update failed:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update proposal" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.log("[signProposal] 🎉 SUCCESS for proposal:", proposalId);

    return new Response(
      JSON.stringify({
        success: true,
        signatureUrl: publicUrlData.publicUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (err) {
    console.error("[signProposal] 💥 Unexpected error:", err);

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}
