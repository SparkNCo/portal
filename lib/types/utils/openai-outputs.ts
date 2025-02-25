export type OpenAIProposalFeature = {
  feature_name: string;
  feature_description: string;
  feature_timeline: string;
  feature_priority: string;
};

export type OpenAIProposalFeaturesOutput = {
  features_description: string;
  proposal_features: OpenAIProposalFeature[];
};
