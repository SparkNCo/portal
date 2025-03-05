export const generateProposalFeaturesPrompt = ({
  project_description,
  budget,
  timeline,
  project_requirements,
  project_owner_name,
  project_owner_email,
}: any) => {
  const prompt = `I need you to take the following information about a project proposal and break it down on a report with a detailed description of all the development features needed for the project. Generate the proposal features by following the format below the information:
  
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

export const generateClientAssistantPrompt = ({
  input,
  option,
  priority,
}: {
  input: string;
  option: string;
  priority: string;
}) => {
  const systemPrompt = `You are a software architect with a master in computer science and 15 years of experience in software development. You are a professional software developer and software architect.
  
The user is going to provide an input with one of the following options:
* Create new request: (This means the user wants to create a new request). For this, your work is to generate a brief but detailed description of the request based on the user's input. Also you need to generate a brief title for the new request. The title should be short and to the point.
* Report Bug: (The user wants to report a new bug). For this, your work is to generate a brief but detailed description of the bug based on the user's input, this description will be used to get closest 3 bug items in a Pinecone Database, so make sure the description is clear and concise, but brief. Also you need to generate a brief title for the new bug. The title should be short and to the point.

For bug reports, the output should be formatted as:
{
  "title": "Title of the bug",
  "description": "Description of the bug",
  "priority": "Priority of the bug" (from Low, Medium, High),
  type: "bug"
}

For feature requests, the output should be formatted as:
{
  "title": "Title of the feature",
  "description": "Description of the feature",
  "priority": "Priority of the feature" (from Low, Medium, High),
  type: "feature"
}

I need you to take into consideration the following:
- If the user's has no selected one of the options above, your work is to infer the user's intent based on the user's input and generate the appropriate output.

MOSTLY IMPORTANT: You need to generate the output in one string so I can parse it. Do not split the output into multiple strings or using backsticks. The output should be a valid JSON object.
`;

  const userPrompt = `
I want you to generate a the information for a Jira Ticket based on the following information:

Input: ${input}
Option: ${option}
Priority: ${priority}
`;
  return {
    systemPrompt,
    userPrompt,
  };
};
