// @ts-nocheck
import {
  AssumptionsAndDependencies,
  AssuranceAndQuality,
  ChangeManagementProcess,
  Deliverables,
  Disclaimer,
  HistoryAndCaseStudies,
  NextSteps,
  ObjectivesAndSuccessCriteria,
  PricingAndCommercial,
  ProblemAndContext,
  RiskAndResponsabilities,
  SolutionOverview,
  Summary,
  TeamAndCommunication,
  TecnologhyAndArchitecture,
  TimelIneAndMileStones,
} from "./newDefaultProposalValues.ts";

export const proposalMockData = {
  "Cover Page": {
    "Client Name": "Acme Corporation",
    "Provider Name": "Spark & Co",
    "Proposal Title": "Customer Engagement Platform Implementation",
    Date: "2026-02-15",
    "Proposal Valid Until": "2026-03-15",
  },

  "Executive Summary": Summary,

  "Problem & Context": ProblemAndContext,
  "Objectives & Success Criteria": ObjectivesAndSuccessCriteria,

  "Solution Overview": SolutionOverview,
  Deliverables: Deliverables,

  "Assumptions & Dependencies": AssumptionsAndDependencies,

  "Timeline & Milestones": TimelIneAndMileStones,

  "Team & Communication": TeamAndCommunication,

  "Technology & Architecture": TecnologhyAndArchitecture,

  "Change Management Process": ChangeManagementProcess,

  "Pricing & Commercial Terms": PricingAndCommercial,

  "Risk & Responsibility Boundaries": RiskAndResponsabilities,

  "Next Steps": NextSteps,

  Disclaimer: Disclaimer,
  AssuranceAndQuality: AssuranceAndQuality,
  HistoryAndCaseStudies: HistoryAndCaseStudies,
  
};
