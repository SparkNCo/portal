export const generateProposalFeaturesPrompt = ({
  project_description,
  budget,
  timeline,
  project_requirements,
  project_owner_name,
  project_owner_email,
}: any) => {
  const prompt =
    `I need you to take the following information about a project proposal and break it down on a report with a detailed description of all the development features needed for the project. Generate the proposal features by following the format below the information:
  
  Information about the proposal:
  - Project Description: ${project_description}
  - Project Budget: ${budget}
  - Project Timeline: ${timeline}
  
  Format the output as:
  {
    "features_description": "A detailed explanation of why the platform needs the following features. ",
    "proposal_features": [
      {
        "feature_name": "Feature 1",
        "feature_description": "Description of feature 1",
        "feature_timeline": "expected time for the feature to be ready, can be in weeks or months, and can be a range",
        "feature_priority": "priority of the feature taking into account the current state of the project and other features",
      },
      ...rest of the features
    ]
  }
  
  MOST IMPORTANTLY: Ensure that all the needed features for the project development are included in the response.`;

  return prompt;
};
