// @ts-nocheck
import { createProposal } from "./createProposal.ts";
import { supabase } from "../client.ts";
import { CreateSubmissionSchema } from "./zod.ts";
import { corsHeaders } from "../utils/headers.ts";
import { sendWelcomeMail } from "./sendWelcomeEmail.ts";

Deno.serve(async (req) => {
  console.log("🔥 Incoming request:", req.method, req.url);

  if (req.method === "OPTIONS") {
    console.log("🟡 CORS preflight handled");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📦 Raw body:", body);

    // ✅ Validate request body
    const parsed = CreateSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      console.error("❌ Validation failed:", parsed.error.flatten());

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
    console.log("✅ Parsed data:", data);

    const startDate = new Date(data.selectedTime.start);
    const leadId = crypto.randomUUID();

    console.log("📅 Parsed start date:", startDate.toISOString());
    console.log("🆔 Generated leadId:", leadId);

    /* -------------------------------------------------
     * 1. Scheduling
     * ------------------------------------------------- */
    const bookingPayload = {
      eventTypeId: 4270039,
      start: data.selectedTime.start, // ✅ FIXED (was body)
      attendee: {
        name: data.name,
        email: data.email,
        timeZone: "America/Toronto",
        language: "en",
      },
      metadata: {},
    };

    console.log("📡 Sending booking request:", bookingPayload);

    const bookingRes = await fetch("https://api.cal.com/v2/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("CAL_KEY")}`,
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify(bookingPayload),
    });

    const bookingData = await bookingRes.json();
    console.log("📥 Booking response:", bookingData);

    if (!bookingRes.ok) {
      console.error("❌ Booking API failed:", bookingData);
      throw new Error("Booking failed");
    }

    const schedulingUrl = bookingData?.data?.meetingUrl || body.scheduling_url;

    console.log("🔗 Scheduling URL:", schedulingUrl);

    /* -------------------------------------------------
     * 2. Insert lead into Supabase
     * ------------------------------------------------- */
    console.log("💾 Updating lead in Supabase...");

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .update({
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
        build_scale: data.build_scale,
      })
      .eq("email", data.email)
      .select()
      .limit(1);
    if (leadError) {
      console.error("❌ Supabase error:", leadError);

      return new Response(JSON.stringify({ error: "Failed to create lead" }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log("✅ Lead updated:", lead);
    const leadRow = lead?.[0];
    /* -------------------------------------------------
     * 3. Proposal + email
     * ------------------------------------------------- */
    try {
      console.log("🧠 Creating proposal...");

      const proposalData = await createProposal({
        lead_id: leadRow.lead_id,
        creator_email: leadRow.email,
      });

      console.log("📄 Proposal created:", proposalData);

      const redirectUrl = body.redirect_url || "https://buildwithspark.co";

      const formattedCallTime = new Date(
        data.selectedTime.start,
      ).toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short",
      });

      console.log("📧 Sending welcome email...");

      await sendWelcomeMail({
        email: data.email,
        name: data.name,
        leadId: leadRow.lead_id,
        schedulingUrl,
        proposalLink: `${redirectUrl}/proposal?mode=features&passcode=${proposalData.passcode}`,
        callTime: formattedCallTime,
      });

      console.log("✅ Email sent");

      await supabase
        .from("leads")
        .update({
          email_sent: true,
          email_sent_at: new Date(),
        })
        .eq("lead_id", leadRow.lead_id);

      console.log("✅ Email status updated in DB");
    } catch (emailErr) {
      console.error("❌ Email/proposal error:", emailErr);
    }

    /* -------------------------------------------------
     * 4. Response
     * ------------------------------------------------- */
    console.log("🎉 Success response sent");

    return new Response(
      JSON.stringify({
        id: leadRow.lead_id,
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
    console.error("💥 FATAL ERROR:", err);

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
