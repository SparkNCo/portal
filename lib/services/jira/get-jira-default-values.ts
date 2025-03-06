type IssueType = 'Task' | 'Bug' | 'Story' | string;
type ProjectKey = string;

type Endpoints = 'rest/api/3/issue' | `rest/api/3/issue/${string}`;
type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface DescriptionContent {
  type: string;
  version: number;
  content: Array<{
    type: string;
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

interface GetJiraDefaultValuesParams {
  method?: Methods;
  endpoint: Endpoints;
  issueType?: IssueType;
  projectKey?: ProjectKey;
  priority: string;
  summary: string;
  description: string;
  additionalFields?: Record<string, any>;
}

interface JiraDefaultValuesReturn {
  method: Methods;
  params: {
    endpoint: string;
  };
  body?: {
    fields?: {
      project: {
        key: ProjectKey;
      };
      summary: string;
      priority: {
        name: string;
      };
      description: DescriptionContent | string;
      issuetype: {
        name: IssueType;
      };
      [key: string]: any;
    };
    update?: {
      [key: string]: any;
    };
  };
}

export const getJiraDefaultValues = ({
  method = 'GET',
  endpoint,
  issueType = 'Task',
  projectKey = 'TEST',
  summary,
  priority,
  description = 'A Description',
  additionalFields = {},
}: GetJiraDefaultValuesParams): JiraDefaultValuesReturn => {
  if (!endpoint) throw new Error('Endpoint is required.');

  const baseBody = {
    method,
    params: { endpoint },
  };

  if (method === 'GET') {
    return baseBody;
  }

  if (method === 'POST') {
    // POST body construction
    return {
      ...baseBody,
      body: {
        fields: {
          project: { key: projectKey },
          summary: summary || 'Default Summary',
          priority: {
            name: priority,
          },
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: description,
                  },
                ],
              },
            ],
          },
          issuetype: { name: issueType },
          ...additionalFields,
        },
      },
    };
  }

  if (method === 'PUT') {
    // PUT body construction
    return {
      ...baseBody,
      body: {
        update: {
          summary: [
            {
              set: summary,
            },
          ],
          description: [
            {
              set: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: description,
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    };
  }

  return baseBody;
};
