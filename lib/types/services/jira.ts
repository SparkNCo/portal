// Define types for the component props
export type JiraPriorityType = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
export type JiraIssueType =
  | 'Bug'
  | 'Task'
  | 'Story'
  | 'Epic'
  | 'Feature'
  | 'Improvement'
  | 'Documentation'
  | 'Product';

export type JiraIssueStatusType =
  | 'To Do'
  | 'In Progress'
  | 'In Review'
  | 'Deleted'
  | 'Done'
  | 'Blocked';

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
        name: JiraIssueType;
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
  status: JiraIssueStatusType;
  createdAt: string;
  priority: JiraPriorityType;
  summary: string;
  assignee?: string;
  deleted: boolean;
  deletedAt?: string;
  project: string;
  issuetype: JiraIssueType;
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
