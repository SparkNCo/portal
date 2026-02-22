type SummaryItem = {
  title: string;
  content: string;
};

interface ScopeSection {
  title: string;
  bullets: string[];
}

interface ScopeList {
  title: string;
  items: string[];
}

interface Deliverable {
  title: string;
  items: string[];
}

interface Dependency {
  week: string;
  description: string;
}
interface Milestones {
  phase: string;
  duration: string;
  tasks: string[];
}
type TeamMember = {
  name: string;
  role: string;
  description: string;
  commitment: string;
};

type StackItem = {
  label: string;
  value: string;
};
interface Assumption {
  title: string;
  description: string;
}

interface PaymentMilestone {
  milestone: string;
  percentage: string;
  amount: string;
  trigger: string;
}
interface TotalInvestment {
  amount: string;
  note: string;
}
interface CostBreakdownItem {
  label: string;
  amount: string;
}
export type StackSection = {
  title: string;
  items: StackItem[];
};
export const DEFAULT_SUMMARY_ITEMS: SummaryItem[] = [
  {
    title: "Client Objectives (Test)",
    content:
      "Acme Corp seeks to modernize their legacy inventory management system to improve operational efficiency, reduce manual errors, and provide real-time visibility across 15 warehouse locations.",
  },
  {
    title: "Opportunity & Value Statement (Test) ",
    content:
      "Our proposed cloud-based solution will reduce inventory processing time by 60%, eliminate duplicate data entry, and provide actionable insights through advanced analytics—translating to estimated annual savings of $450,000 and improved customer satisfaction.",
  },
  {
    title: "High-Level Solution Methodology (Test)",
    content:
      "We will deliver a full-stack web application with mobile-responsive design, built using modern frameworks, integrated with existing ERP systems, and deployed on scalable cloud infrastructure with 99.9% uptime SLA.",
  },
];

export const DEFAULT_SECTIONS: ScopeSection[] = [
  {
    title: "Features & Modules",
    bullets: [
      "Real-time inventory tracking dashboard",
      "Automated purchase order generation",
      "Barcode / QR scanning capabilities",
      "Multi-warehouse management",
      "Advanced reporting and analytics",
      "Role-based access control",
    ],
  },
  {
    title: "User Types & Roles",
    bullets: [
      "System Administrator (full access)",
      "Warehouse Manager (location-specific)",
      "Inventory Specialist (data entry & updates)",
      "Purchasing Agent (PO management)",
      "Executive (read-only analytics)",
    ],
  },
  {
    title: "Integrations",
    bullets: [
      "SAP ERP system (bi-directional sync)",
      "QuickBooks for financial data",
      "Shipping carrier APIs (FedEx, UPS, USPS)",
      "Email notifications (SendGrid)",
    ],
  },
  {
    title: "Platforms",
    bullets: [
      "Web application (Chrome, Firefox, Safari)",
      "Mobile-responsive design (iOS & Android)",
      "Cloud infrastructure (AWS)",
      "RESTful API backend",
    ],
  },
];

export const DEFAULT_SCOPES: ScopeList[] = [
  {
    title: "In-Scope",
    items: [
      "Custom application development",
      "Database design and setup",
      "Third-party integrations",
      "User training (3 sessions)",
      "90 days post-launch support",
      "Security auditing",
    ],
  },
  {
    title: "Out-of-Scope",
    items: [
      "Hardware procurement",
      "Legacy data migration (available as add-on)",
      "Native mobile apps",
      "On-premise deployment",
      "24/7 phone support",
    ],
  },
];

export const DEFAULT_DELIVERABLES: Deliverable[] = [
  {
    title: "Working Application",
    items: [
      "Production v1.0 deployed to AWS",
      "Staging environment for testing",
      "Browser support: Chrome 90+, Firefox 88+, Safari 14+",
      "Mobile responsive (viewport 320px+)",
    ],
  },
  {
    title: "Documentation",
    items: [
      "System architecture diagrams",
      "API documentation (OpenAPI 3.0)",
      "User onboarding guides (PDF & video)",
      "Database schema documentation",
      "DevOps runbooks",
    ],
  },
  {
    title: "Design Assets",
    items: [
      "Figma design files (all screens)",
      "Component library",
      "Brand style guide",
      "Exported assets (PNG, SVG)",
    ],
  },
  {
    title: "Testing Artifacts",
    items: [
      "QA test plans and reports",
      "Automated test suite (Jest, Cypress)",
      "Performance testing results",
      "Security penetration test report",
    ],
  },
  {
    title: "Deployment & Training",
    items: [
      "Production deployment",
      "CI/CD pipeline configuration",
      "3 training sessions (2 hours each)",
      "Training materials and videos",
    ],
  },
];
export const DEFAULT_DEPENDECIES: Dependency[] = [
  {
    week: "Week 1",
    description: "Client must provide SAP API credentials and documentation",
  },
  {
    week: "Week 3",
    description: "Final design approval required to proceed with development",
  },
  {
    week: "Week 12",
    description: "UAT participants identified and scheduled",
  },
];
export const DEFAULT_MILESTONES: Milestones[] = [
  {
    phase: "Discovery & Design",
    duration: "Weeks 1-3",
    tasks: [
      "Requirements finalization",
      "UI/UX design",
      "Technical architecture",
      "Database schema design",
    ],
  },
  {
    phase: "Development - Phase 1",
    duration: "Weeks 4-7",
    tasks: [
      "Core inventory module",
      "User authentication",
      "Dashboard development",
      "API development",
    ],
  },
  {
    phase: "Development - Phase 2",
    duration: "Weeks 8-11",
    tasks: [
      "Reporting & analytics",
      "Third-party integrations",
      "Advanced features",
      "Mobile optimization",
    ],
  },
  {
    phase: "QA & Testing",
    duration: "Weeks 12-14",
    tasks: [
      "Functional testing",
      "Performance testing",
      "Security audit",
      "Bug fixes",
    ],
  },
  {
    phase: "UAT & Training",
    duration: "Week 15",
    tasks: [
      "User acceptance testing",
      "Training sessions",
      "Documentation review",
      "Feedback incorporation",
    ],
  },
  {
    phase: "Launch & Support",
    duration: "Week 16+",
    tasks: [
      "Production deployment",
      "Monitoring setup",
      "90-day support period begins",
      "Performance optimization",
    ],
  },
];
export const DEFAULT_TEAM: TeamMember[] = [
  {
    name: "Sarah Chen",
    role: "Project Manager",
    description:
      "15+ years leading enterprise projects. PMP certified. Your single point of contact.",
    commitment: "25 hrs/week",
  },
  {
    name: "Marcus Rodriguez",
    role: "Tech Lead / Architect",
    description:
      "Former AWS Solutions Architect. Expert in scalable cloud infrastructure and system design.",
    commitment: "40 hrs/week",
  },
  {
    name: "Emily Watson",
    role: "Senior Full-Stack Developer",
    description:
      "10 years building enterprise apps. React, Node.js, PostgreSQL specialist.",
    commitment: "40 hrs/week",
  },
  {
    name: "David Kim",
    role: "Senior Full-Stack Developer",
    description:
      "Backend optimization expert. API design and integration specialist.",
    commitment: "40 hrs/week",
  },
  {
    name: "Priya Sharma",
    role: "UI/UX Designer",
    description:
      "Award-winning designer focused on enterprise UX and accessibility compliance.",
    commitment: "20 hrs/week",
  },
  {
    name: "Alex Thompson",
    role: "QA Engineer",
    description:
      "Automated testing specialist. Security and performance auditing experience.",
    commitment: "30 hrs/week",
  },
];
export const DEFAULT_STACK: StackSection[] = [
  {
    title: "Platform & Frameworks",
    items: [
      {
        label: "Frontend",
        value: "React 18, Next.js 14, TypeScript",
      },
      {
        label: "Backend",
        value: "Node.js, Express, REST API",
      },
      {
        label: "Database",
        value: "PostgreSQL 15 with replication",
      },
      {
        label: "Caching",
        value: "Redis for session and query caching",
      },
    ],
  },
  {
    title: "Infrastructure & Security",
    items: [
      {
        label: "Hosting",
        value: "AWS (EC2, RDS, S3, CloudFront)",
      },
      {
        label: "DevOps",
        value: "Docker, GitHub Actions CI/CD",
      },
      {
        label: "Security",
        value: "SSL/TLS, OAuth 2.0, JWT auth",
      },
      {
        label: "Monitoring",
        value: "CloudWatch, Sentry error tracking",
      },
    ],
  },
];
export const DEFAULT_WHY_THIS_STACK: string =
  "We've chosen battle-tested, enterprise-grade technologies that balance performance, scalability, and maintainability. This stack is used by companies like Airbnb, Netflix, and Uber. React/Next.js provides fast, SEO-friendly interfaces. PostgreSQL offers robust ACID compliance for financial data. AWS ensures 99.99% uptime with easy scaling as you grow.";

export const DEFAULT_ASSUMPTIONS: Assumption[] = [
  {
    title: "Included",
    description:
      "Up to 3 rounds of design revisions, standard features as scoped, 90-day support",
  },
  {
    title: "Additional Costs",
    description:
      "Features beyond agreed scope ($250/hr), legacy data migration ($15,000), extended support after 90 days ($3,500/month)",
  },
  {
    title: "Timeline Changes",
    description:
      "Client delays beyond 5 business days may result in schedule adjustment and potential additional PM costs",
  },
];

export const DEFAULT_PAYMENT_MILESTONES: PaymentMilestone[] = [
  {
    milestone: "Contract Signing",
    percentage: "30%",
    amount: "$55,500",
    trigger: "Upon agreement execution",
  },
  {
    milestone: "Design Approval",
    percentage: "20%",
    amount: "$37,000",
    trigger: "Week 3 - design sign-off",
  },
  {
    milestone: "Development Phase 1 Complete",
    percentage: "20%",
    amount: "$37,000",
    trigger: "Week 7 - core features deployed to staging",
  },
  {
    milestone: "QA & UAT Complete",
    percentage: "20%",
    amount: "$37,000",
    trigger: "Week 15 - UAT sign-off",
  },
  {
    milestone: "Production Launch",
    percentage: "10%",
    amount: "$18,500",
    trigger: "Week 16 - live deployment",
  },
];
export const DEFAULT_TOTAL_INVESTMENT: TotalInvestment = {
  amount: "$185,000",
  note: "Fixed-price, milestone-based",
};
export const DEFAULT_COST_BREACKDOWN: CostBreakdownItem[] = [
  {
    label: "Development (640 hours @ $250/hr)",
    amount: "$160,000",
  },
  {
    label: "Design (80 hours @ $200/hr)",
    amount: "$16,000",
  },
  {
    label: "Project Management",
    amount: "$9,000",
  },
];
