-- Create design_resources table to store Figma and v0 links
CREATE TABLE IF NOT EXISTS portal.design_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text NOT NULL,
  project_slug text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('figma', 'v0')),
  url text NOT NULL,
  title text,
  description text,
  created_by uuid REFERENCES portal.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_design_resources_issue_id ON portal.design_resources(issue_id);
CREATE INDEX IF NOT EXISTS idx_design_resources_project_slug ON portal.design_resources(project_slug);
CREATE INDEX IF NOT EXISTS idx_design_resources_created_at ON portal.design_resources(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION portal.update_design_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_design_resources_updated_at
  BEFORE UPDATE ON portal.design_resources
  FOR EACH ROW
  EXECUTE FUNCTION portal.update_design_resources_updated_at();
