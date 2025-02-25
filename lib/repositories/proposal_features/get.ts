import { supabase } from '@/lib/supabase/client';
import { ProposalFeature } from '@/lib/types/db/proposal_features';

export const getProposalFeaturesByProposalId = async (
  id: string
): Promise<ProposalFeature[] | null> => {
  const { data: proposal_features } = await supabase
    .from('proposal_features')
    .select()
    .eq('proposal_id', id);
  return (proposal_features || []).sort((a, b) => {
    const priorityOrder: Record<string, number> = {
      High: 1,
      Medium: 2,
      Low: 3,
    };

    return (
      priorityOrder[a.feature_priority] - priorityOrder[b.feature_priority]
    );
  });
};
