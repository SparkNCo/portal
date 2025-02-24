import { insertProposalFeatures } from "@/lib/repositories/proposal_features/insert";
import { InsertReponseType } from "@/lib/types/utils/inserts-updates-response";
import { OpenAIProposalFeature } from "@/lib/types/utils/openai-outputs";

export const saveFeaturesFromOpenAI = async ({
  features,
  proposalId,
}: {
  features: Partial<OpenAIProposalFeature>[];
  proposalId: string;
}): Promise<InsertReponseType> => {
  if (!proposalId) {
    return {
      error: "Proposal id is required",
      success: null,
    };
  }
  for (const feature of features) {
    const { error, success } = await insertProposalFeatures({
      title: feature.feature_name,
      description: feature.feature_description,
      priority: feature.feature_priority,
      proposal_id: proposalId,
    });
    if (error) {
      return {
        error: error,
        success: null,
      };
    }
  }
  return {
    error: null,
    success: "Features saved successfully",
  };
};
