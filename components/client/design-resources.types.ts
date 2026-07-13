// Types for design resources (Figma, v0 links)
export type DesignResourceType = "figma" | "v0";

export type DesignResource = {
  id: string;
  issue_id: string;
  project_slug: string;
  resource_type: DesignResourceType;
  url: string;
  title?: string | null;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateDesignResourceInput = {
  issue_id: string;
  project_slug: string;
  resource_type: DesignResourceType;
  url: string;
  title?: string;
  description?: string;
  email: string;
};

export type UpdateDesignResourceInput = {
  id: string;
  title?: string;
  description?: string;
  url?: string;
};

// Existing diagram types (for reference)
export type Service = {
  id: string;
  project_slug: string;
  name: string;
};

export type Diagram = {
  id: string;
  service_id: string;
  issue_id: string;
  version: number;
  mermaid_source: string | null;
  created_at: string;
};
