// sign-proposal.ts
// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { ProposalLookupSchema, SignProposalSchema } from "./zod.ts";

/* ----------------------------------
   Deno-safe base64 → Uint8Array
----------------------------------- */
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json();

    // ✅ Validate request body
    const parsedBody = SignProposalSchema.safeParse(body);

    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parsedBody.error.flatten(),
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const { proposalId, signatureBase64 } = parsedBody.data;

    /* ----------------------------------
       1. Fetch proposal
    ----------------------------------- */
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("passcode, stage")
      .eq("passcode", proposalId)
      .single();

    if (proposalError || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // ✅ Validate proposal shape
    const parsedProposal = ProposalLookupSchema.safeParse(proposal);

    if (!parsedProposal.success) {
      console.error(
        "[signProposal] Invalid proposal shape:",
        parsedProposal.error,
      );
      return new Response(JSON.stringify({ error: "Invalid proposal data" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    if (parsedProposal.data.stage === "accepted") {
      return new Response(
        JSON.stringify({ error: "Proposal already signed" }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    /* ----------------------------------
       2. Check existing signature
    ----------------------------------- */
    const folderPath = `proposal-${proposalId}`;

    const { data: existingFiles, error: listError } = await supabase.storage
      .from("signatures_bucket")
      .list(folderPath);

    if (listError) {
      console.error(listError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing signature" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    if (existingFiles?.some((file) => file.name === "signature.png")) {
      return new Response(
        JSON.stringify({ error: "Signature already exists" }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    /* ----------------------------------
       3. Upload signature
    ----------------------------------- */
    const bytes = base64ToUint8Array(signatureBase64);
    const filePath = `${folderPath}/signature.png`;

    const { error: uploadError } = await supabase.storage
      .from("signatures_bucket")
      .upload(filePath, bytes, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error(uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload signature" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    /* ----------------------------------
       4. Get public URL
    ----------------------------------- */
    const { data: publicUrlData } = supabase.storage
      .from("signatures_bucket")
      .getPublicUrl(filePath);

    /* ----------------------------------
       5. Update proposal
    ----------------------------------- */

    const header = signatureBase64.split(",");

    const { error: updateError } = await supabase
      .from("proposals")
      .update({
        signature_url: publicUrlData.publicUrl,
        signed_at: new Date().toISOString(),
        signature_header: header,
        stage: "accepted",
      })
      .eq("passcode", proposalId);

    if (updateError) {
      console.error(updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update proposal" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        signatureUrl: publicUrlData.publicUrl,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (err) {
    console.error("[POST /sign-proposal] Unexpected error:", err);

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
}
