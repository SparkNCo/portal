export type SummaryItem = {
  title: string;
  content: string;
};

export interface ScopeSection {
  title: string;
  bullets: string[];
}

export interface ScopeList {
  title: string;
  items: string[];
}

export interface Deliverable {
  title: string;
  items: string[];
}

export interface Dependency {
  week: string;
  description: string;
}
export interface Milestones {
  phase: string;
  duration: string;
  tasks: string[];
}
export type TeamMember = {
  name: string;
  role: string;
  description: string;
  commitment: string;
};

export type StackItem = {
  label: string;
  value: string;
};
export interface Assumption {
  title: string;
  description: string;
}

export interface PaymentMilestone {
  milestone: string;
  percentage: string;
  amount: string;
  trigger: string;
}
export interface TotalInvestment {
  amount: string;
  note: string;
}
export interface CostBreakdownItem {
  label: string;
  amount: string;
}
