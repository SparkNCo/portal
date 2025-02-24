import { supabase } from "@/lib/supabase/client";
import { Proposal } from "@/lib/types/db/proposals";
import { InsertReponseType } from "@/lib/types/utils/inserts-updates-response";
import { getErrorMessage } from "@/utils/helpers";

export const insertProposal = async (
  proposal: Partial<Proposal>,
): Promise<InsertReponseType> => {
  const { data, error } = await supabase
    .from("proposals")
    .insert(proposal);
  if (error) {
    const errorMessage = getErrorMessage(error);
    console.error("Error inserting data in proposals table:", errorMessage);
    return {
      error:
        "There was an error while creating the proposal. Please try again later.",
      success: null,
    };
  }
  return {
    success: "Proposal created successfully",
    error: null,
  };
};
