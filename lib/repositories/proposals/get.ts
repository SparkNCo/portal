import { supabase } from "@/lib/supabase/client";
import { Proposal } from "@/lib/types/db/proposals";

export const getProposalById = async (
  id: string,
): Promise<Proposal | null> => {
  const { data: proposal } = await supabase
    .from("proposals")
    .select().eq("id", id).single();

  return proposal;
};
