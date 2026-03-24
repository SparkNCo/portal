// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export const approvePolicy = async (req: Request) => {
  try {
    const body = await req.json();
    const { userId, notionUrls = [] } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1️⃣ Mark user as approved
    const { data, error } = await supabase
      .from("users")
      .update({ policies_approved: true })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // 2️⃣ Optional: download PDFs from Notion and store in Supabase
    // for (const url of notionUrls) {
    //   const pdfBuffer = await downloadNotionPdf(url);
    //   if (pdfBuffer) {
    //     await supabase.storage
    //       .from("policies-pdfs")
    //       .upload(`${userId}/${encodeURIComponent(url)}.pdf`, pdfBuffer, {
    //         contentType: "application/pdf",
    //         upsert: true,
    //       });
    //   }
    // }

    return new Response(JSON.stringify({ success: true, user: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Approve Policy Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
