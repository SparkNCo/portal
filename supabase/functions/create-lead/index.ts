// @ts-nocheck
import { createProposal } from "./createProposal.ts";
import { sendWelcomeMail } from "./sendWelcomeEmail.ts";
import { supabase } from "../client.ts";
import { CreateSubmissionSchema } from "./zod.ts";
import { corsHeaders } from "../utils/headers.ts";

/* -------------------------------------------------
 * 1. (Optional) Cal.com booking
 * ------------------------------------------------- */

/* const bookingRes = await fetch("https://api.cal.com/v2/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("CAL_KEY")}`,
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify(bookingPayload),
    });

    const bookingData = await bookingRes.json();
    const schedulingUrl = bookingData?.data?.meetingUrl ?? body.scheduling_url; */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // ✅ Validate request body
    const parsed = CreateSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parsed.error.flatten(),
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const data = parsed.data;

    const startDate = new Date(data.selectedTime.start);
    const leadId = crypto.randomUUID();

    /* -------------------------------------------------
     * 1. Scheduling (hardcoded for now)
     * ------------------------------------------------- */

    //* Change to bookingRes commented on top for real booking
    const schedulingUrl = "https://cal.com/kabir-malkani-glnivq/15min";

    /* -------------------------------------------------
     * 2. Insert lead into Supabase
     * ------------------------------------------------- */

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        lead_id: leadId,
        first_name: data.name,
        email: data.email,
        company: data.companyName,
        industry: data.industry,
        budget_min: data.monthlybudget?.min,
        budget_max: data.monthlybudget?.max,
        estimateTime_min: data.estimateTimeline?.min,
        estimateTime_max: data.estimateTimeline?.max,
        description: data.productIdea,
        formatted_date: startDate,
        scheduling_url: schedulingUrl,
        booking_status: "confirmed",
        email_sent: false,
      })
      .select()
      .single();

    if (leadError) {
      return new Response(JSON.stringify({ error: "Failed to create lead" }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    /* -------------------------------------------------
     * 3. Proposal + email
     * ------------------------------------------------- */

    try {
      const proposalData = await createProposal({
        lead_id: lead.lead_id,
        creator_email: lead.email,
      });

      await sendWelcomeMail({
        email: data.email,
        name: data.name,
        leadId: lead.lead_id,
        schedulingUrl,
        proposalLink: `http://localhost:4321/proposal?mode=features&passcode=${proposalData.passcode}`,
      });

      await supabase
        .from("leads")
        .update({
          email_sent: true,
          email_sent_at: new Date(),
        })
        .eq("lead_id", lead.lead_id);
    } catch (emailErr) {
      console.error("Failed to send welcome email:", emailErr);
    }

    /* -------------------------------------------------
     * 4. Response
     * ------------------------------------------------- */

    return new Response(
      JSON.stringify({
        id: lead.lead_id,
        scheduling_url: schedulingUrl,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err: any) {
    console.error("[supabase] Error creating submission:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
});
