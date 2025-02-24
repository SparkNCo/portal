import { supabase } from "@/lib/supabase/client";
import { ProposalFeature } from "@/lib/types/db/proposal_features";
import { InsertReponseType } from "@/lib/types/utils/inserts-updates-response";
import { getErrorMessage } from "@/utils/helpers";

export const insertProposalFeatures = async (
  proposal_features: Partial<ProposalFeature>,
): Promise<InsertReponseType> => {
  const { data, error } = await supabase
    .from("proposal_features")
    .insert(proposal_features);

  if (error) {
    const errorMessage = getErrorMessage(error);
    console.error("Error inserting data in proposals table:", errorMessage);
    return {
      error:
        "There was an error while creating the proposal features. Please try again later.",
      success: null,
    };
  }
  return {
    success: "Proposal features created successfully",
    error: null,
  };
};
