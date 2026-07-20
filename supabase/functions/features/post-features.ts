// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { sendAdminsEmail } from "./sendAdminsEmail.ts";
import { CreateRequirementsSchema } from "./zod.ts";

/* --------------------------------
 * Helpers
 * -------------------------------- */

// Features the client already fetched (from GET /features) carry their real
// DB id — resubmitting the whole list (edit + add-new flows) would otherwise
// re-insert those as brand-new duplicate rows every time. Only features with
// no id, or an id that doesn't match an existing row, are actually new.
const findNewFeatures = async (features) => {
  const incomingIds = features.map((f) => f.id).filter(Boolean);
  if (!incomingIds.length) return features;

  const { data: existing, error } = await supabase.schema("marketing")
    .from("requirements")
    .select("id")
    .in("id", incomingIds);

  if (error) {
    console.error("[createRequirements] ❌ Existing-check error:", error);
    throw new Error("CHECK_EXISTING_FEATURES_FAILED");
  }

  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const newFeatures = features.filter((f) => !f.id || !existingIds.has(f.id));

  console.log(
    `[createRequirements] 🔎 ${features.length - newFeatures.length} feature(s) already saved, skipping`,
  );

  return newFeatures;
};

const buildInsertPayload = (features, proposal_id, submission_id) => {
  return features.map((item, index) => {
    const mapped = {
      ...(item.id && { id: item.id }),
      proposal_id,
      submission_id,
      feature_name: item.title ?? null,
      integration_text: item.integrations ?? null,
      description: item.description ?? null,
      purpose: item.purpose ?? null,
      tech_constraints: item.tech_constraints ?? null,
    };

    console.log(`[createRequirements] 🧩 Mapping feature[${index}]`, mapped);
    return mapped;
  });
};

const insertRequirements = async (payload) => {
  if (!payload.length) {
    console.log("[createRequirements] ℹ️ No new features to insert");
    return 0;
  }

  console.log(
    "[createRequirements] 📤 Inserting requirements:",
    payload.length,
  );

  const { error, count } = await supabase.schema("marketing")
    .from("requirements")
    .insert(payload, { count: "exact" });

  if (error) {
    console.error("[createRequirements] ❌ Insert error:", error);
    throw new Error("INSERT_REQUIREMENTS_FAILED");
  }

  console.log("[createRequirements] ✅ Insert success:", { count });
  return count;
};

const updateLead = async (lead_id, data) => {
  console.log("[createRequirements] 🔄 Updating lead:", lead_id);

  const { error } = await supabase.schema("marketing")
    .from("leads")
    .update(data)
    .eq("lead_id", lead_id);

  if (error) {
    console.error("[createRequirements] ❌ Lead update error:", error);
    throw new Error("UPDATE_LEAD_FAILED");
  }

  console.log("[createRequirements] ✅ Lead updated");
};

const updateProposalStage = async (lead_id) => {
  console.log("[createRequirements] 🔄 Updating proposal stage:", lead_id);

  const { error } = await supabase.schema("marketing")
    .from("proposals")
    .update({ stage: "draft" })
    .eq("lead_id", lead_id);

  if (error) {
    console.error("[createRequirements] ❌ Proposal update error:", error);
    return false;
  }

  console.log("[createRequirements] ✅ Proposal updated to draft");
  return true;
};

const getProposalPasscode = async (lead_id) => {
  const { data, error } = await supabase.schema("marketing")
    .from("proposals")
    .select("passcode")
    .eq("lead_id", lead_id)
    .maybeSingle();

  if (error) {
    console.error("[createRequirements] ❌ Error fetching proposal:", error);
    return null;
  }

  console.log("[createRequirements] 📦 Retrieved passcode:", data?.passcode);

  return data?.passcode ?? null;
};

/* --------------------------------
 * Main handler
 * -------------------------------- */

export async function createRequirements(req: Request): Promise<Response> {
  console.log("[createRequirements] 🚀 Function triggered");

  try {
    const body = await req.json();
    console.log("[createRequirements] 📥 Raw body:", body);

    const parsed = CreateRequirementsSchema.safeParse(body);

    if (!parsed.success) {
      console.warn(
        "[createRequirements] ❌ Validation failed:",
        parsed.error.flatten(),
      );

      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parsed.error.flatten(),
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

    console.log("[createRequirements] ✅ Validation success");

    const {
      proposal_id,
      submission_id,
      features,
      discovery_state,
      estimateTime_min,
      estimateTime_max,
      budget_min,
      budget_max,
      description,
      lead_id,
    } = parsed.data;

    console.log("[createRequirements] 📊 Parsed payload:", {
      proposal_id,
      submission_id,
      featuresCount: features?.length,
      lead_id,
    });

    /* -----------------------------
       1. Insert only genuinely new requirements
    ------------------------------ */
    const newFeatures = await findNewFeatures(features);

    const insertPayload = buildInsertPayload(
      newFeatures,
      proposal_id,
      submission_id,
    );

    const count = await insertRequirements(insertPayload);

    /* -----------------------------
       2. Update lead + proposal
    ------------------------------ */
    if (lead_id) {
      await updateLead(lead_id, {
        discovery_state,
        estimateTime_min,
        estimateTime_max,
        budget_min,
        budget_max,
        description,
      });

      /* -----------------------------
         3. Send admin emails
      ------------------------------ */
      await updateProposalStage(lead_id);
      // if (updated) {
      //   const passcode = await getProposalPasscode(lead_id);

      //   if (passcode) {
      //     await sendAdminsEmail(passcode);
      //   } else {
      //     console.warn(
      //       "[createRequirements] ⚠️ No passcode found, skipping email",
      //     );
      //   }
      // }
    } else {
      console.log(
        "[createRequirements] ℹ️ No lead_id provided, skipping updates",
      );
    }

    console.log("[createRequirements] 🎉 Done");

    return new Response(
      JSON.stringify({
        inserted: count ?? newFeatures.length,
        skipped: features.length - newFeatures.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error) {
    console.error("[createRequirements] 💥 Unexpected error:", error);

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
}
