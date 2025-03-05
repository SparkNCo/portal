export interface JiraWebhookResponse {
  timestamp: number;
  webhookEvent: EventTypes;
  issue_event_type_name: string;
  user: {
    self: string;
    accountId: string;
    displayName: string;
    active: boolean;
    timeZone: string;
    accountType: string;
  };
  issue: {
    id: string;
    self: string;
    key: string;
    fields: {
      summary: string;
      description: string;
      status: {
        name: string;
      };
      created: string;
      priority: {
        name: string;
      };
      project: {
        name: string;
        key: string;
      };
      issuetype: {
        name: string;
      };
    };
    comments: any[];
  };
  changelog: {
    id: string;
    items: ChangelogItem[];
  };
}
export type EventTypes =
  | 'jira:issue_deleted'
  | 'jira:issue_created'
  | 'jira:issue_updated';

export interface ExtractedIssueData {
  commentCount: number;
  description: string;
  status: string;
  createdAt: string;
  priority: string;
  summary: string;
  assignee?: string;
  project: string;
  issuetype: string;
  issueKey: string;
  createdBy: string;
}

export interface ChangelogItem {
  field: string;
  fieldtype: string;
  fieldId: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}
