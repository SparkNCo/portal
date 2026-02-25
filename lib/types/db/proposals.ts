import { Database } from "./proposal_features";

export type Proposal = Database['public']['Tables']['proposals']['Row'];
export type ProjectStatusType = Database['public']['Enums']['project_status'];
export enum ProjectStatusEnum {
  NEW_IDEA = 'NEW_IDEA',
  GENERATING_REVENUE = 'GENERATING_REVENUE',
  GROWTH_PHASE = 'GROWTH_PHASE',
  INDUSTRY_LEADER = 'INDUSTRY_LEADER',
}
