/* NEW VALUESES */

export const Disclaimer: object[] = [
  {
    type: "subtitle",
    content: "About Spark & Co",
  },
  {
    type: "text",
    content:
      "Founded in 2018, Spark & Co is a boutique software development agency specializing in enterprise digital transformation. Our team of 45+ engineers has delivered over 120 successful projects across manufacturing, healthcare, and financial services sectors. We maintain a 98% client satisfaction rate and 87% of our clients engage us for additional projects.",
  },
  {
    type: "subtitle",
    content: "Similar Cases",
  },
];

export const TimelIneAndMileStones = [
  {
    type: "subtitle",
    subtype: "row",
    content: {
      title: "Pricing Mode",
      value: "Fixed Price with milestone-based payments",
    },
  },
];

/* Texts */

export const Summary = [
  {
    type: "text",
    content:
      "Acme Corporation currently operates on a 15-year-old ERP system that has become increasingly difficult to maintain and scale. The system experiences frequent downtime, lacks modern integration capabilities, and cannot support mobile access for your growing remote workforce.",
  },
];

export const ProblemAndContext = [
  {
    type: "text",
    content:
      "Acme Corporation currently operates on a 15-year-old ERP system that has become increasingly difficult to maintain and scale. The system experiences frequent downtime, lacks modern integration capabilities, and cannot support mobile access for your growing remote workforce.",
  },
];
export const SolutionOverview = [
  {
    type: "text",
    content:
      "Acme Corporation currently operates on a 15-year-old ERP system that has become increasingly difficult to maintain and scale. The system experiences frequent downtime, lacks modern integration capabilities, and cannot support mobile access for your growing remote workforce.",
  },
];

/* Table */
export const PricingAndCommercial = [
  {
    type: "subtitle",
    subtype: "row",
    content: {
      title: "Pricing Mode",
      value: "Fixed Price with milestone-based payments",
    },
  },
  {
    type: "table",
    content: {
      headers: ["Item", "Cost", "Billing Frequency"],
      rows: [
        ["Discovery & Architecture", "$160,000", "Due at milestone completion"],
        ["Core Platform Development", "$16,000", "Due at milestone completion"],
        ["Web Application Development", "$9,000", "Due at go-live"],
      ],
      footer: ["Total Investment", "$185,000"],
    },
  },
];

export const ObjectivesAndSuccessCriteria = [
  {
    type: "table",
    content: {
      headers: ["Objective", "Metric", "Target"],
      rows: [
        [
          "Reduce system downtime",
          "Monthly system availability",
          "99.9% uptime",
        ],
        [
          "Improve user productivity",
          "Average task completion time",
          "30% reduction",
        ],
      ],
      footer: ["Total Investment", "$185,000"],
    },
  },
];

/* LISTS */
export const NextSteps = [
  {
    type: "list",
    content: {
      subtype: "numbered",
      items: [
        "Review this proposal thoroughly and discuss any questions with your team",
        "Sign the Master Service Agreement if not already in place",
        "Accept this proposal using the button below or schedule a call to discuss",
        "Provide initial system access and credentials",
        "Schedule project kickoff meeting for week of March 11, 2026",
      ],
    },
  },
];
export const AssuranceAndQuality = [
  {
    type: "list",
    title: "Assurance & Quality",
    content: {
      subtype: "numbered",
      items: [
        "Weekly security vulnerability scans throughout development",
        "Automated backup systems with 99.999% durability guarantee",
        "Multi-region failover capability for business continuity",
        "Comprehensive error handling and logging",
        "Capacity planning and load testing before launch",
      ],
    },
  },
];

export const RiskAndResponsabilities = [
  {
    type: "list",
    content: {
      subtype: "bullet",
      items: [
        "Provider is not responsible for third-party service outages (AWS, Salesforce, QuickBooks)",
        "Provider is not responsible for inaccurate client-provided data or delays caused by incomplete information",
        "Provider is not responsible for post-delivery changes in third-party systems or API deprecations",
        "Performance depends on infrastructure selected and configured according to specifications",
        "Client is responsible for ongoing AWS infrastructure costs after delivery",
        "Provider liability is limited to fees paid for the specific milestone where issues occurred",
      ],
    },
  },
];

export const AssumptionsAndDependencies = [
  { type: "subtitle", content: "Assumptions" },
  {
    type: "list",
    content: {
      subtype: "bullet",
      items: [
        "Third-party services (AWS, Salesforce, QuickBooks) remain available and stable",
        "Provider is not responsible for inaccurate client-provided data or delays caused by incomplete information",
        "Provider is not responsible for post-delivery changes in third-party systems or API deprecations",
        "Performance depends on infrastructure selected and configured according to specifications",
        "Client is responsible for ongoing AWS infrastructure costs after delivery",
        "Provider liability is limited to fees paid for the specific milestone where issues occurred",
      ],
    },
  },
  { type: "subtitle", content: "Dependencies" },
  {
    type: "list",
    content: {
      subtype: "bullet",
      items: [
        "Client will provide timely feedback and approvals within 5 business days",
        "Client will provide required credentials and system access within 2 business days of request",
        "Stakeholders are available for scheduled reviews and UAT sessions",
      ],
    },
  },
  { type: "subtitle", content: "Client Responsibilities" },
  {
    type: "list",
    content: {
      subtype: "bullet",
      items: [
        "Provide a primary point of contact with decision-making authority",
        "Provide access to required systems and environments",
        "Review deliverables within agreed timelines (5 business days)",
        "Ensure accuracy of provided data and content",
      ],
    },
  },
];

/* not sure this goes here */
export const ChangeManagementProcess = [
  {
    type: "list",
    content: {
      subtype: "titled",
      items: [
        {
          title: "Request Method",
          content:
            "All changes must be submitted through Jira with detailed description and business justification",
        },
        {
          title: "Impact Assessment",
          content:
            "Spark & Co will evaluate impact on scope, timeline, and cost within 3 business days and provide written assessment",
        },
        {
          title: "Pricing Adjustment",
          content:
            "Changes may require a written change order and adjustment to fees or schedule. Minor changes (< 4 hours) may be accommodated within sprint flexibility.",
        },
        {
          title: "Acceptance & Completion Criteria",
          content:
            "Work is considered accepted unless written feedback with specific issues is provided within 5 business days of deliverable submission. Acceptance does not waive rights for defects discovered within 90-day warranty period. All deliverables must meet agreed acceptance criteria before milestone payment is due.",
        },
      ],
    },
  },
];

/* Cards */
export const HistoryAndCaseStudies = [
  {
    type: "subtitle",
    content: "About Spark & Co",
  },
  {
    type: "text",
    content:
      "Founded in 2018, Spark & Co is a boutique software development agency specializing in enterprise digital transformation. Our team of 45+ engineers has delivered over 120 successful projects across manufacturing, healthcare, and financial services sectors. We maintain a 98% client satisfaction rate and 87% of our clients engage us for additional projects.",
  },
  {
    type: "subtitle",
    content: "Similar Cases",
  },
  {
    type: "Card",
    subtype: "Cases",
    title: "TechManufacturing Inc.",
    content: [
      {
        title: "Challenge",
        content: "Legacy ERP system causing 15+ hours of monthly downtime",
      },
      {
        title: "Solution",
        content: "Legacy ERP system causing 15+ hours of monthly downtime",
      },
      {
        title: "Results",
        content:
          "99.97% uptime achieved, 42% reduction in order processing time, $2.1M annual cost savings",
      },
    ],
  },
  {
    type: "Card",
    subtype: "Cases",
    title: "TechManufacturing Inc.",
    content: [
      {
        title: "Challenge",
        content: "Legacy ERP system causing 15+ hours of monthly downtime",
      },
      {
        title: "Solution",
        content: "Legacy ERP system causing 15+ hours of monthly downtime",
      },
      {
        title: "Results",
        content:
          "99.97% uptime achieved, 42% reduction in order processing time, $2.1M annual cost savings",
      },
    ],
  },
  {
    type: "Card",
    subtype: "Reference",
    content: [
      {
        author: "Jane Doe, CTO of TechManufacturing Inc.",
        position: "CTO",
        company: "TechManufacturing Inc.",
        quote:
          "Spark & Co transformed our operations with a custom solution that integrated seamlessly with our existing systems. Their team's expertise and dedication were evident throughout the project, resulting in significant efficiency gains and cost savings. We highly recommend Spark & Co for any enterprise software development needs.",
      },
    ],
  },
  {
    type: "Card",
    subtype: "Reference",
    content: [
      {
        author: "Jane Doe, CTO of TechManufacturing Inc.",
        position: "CTO",
        company: "TechManufacturing Inc.",
        quote:
          "Spark & Co transformed our operations with a custom solution that integrated seamlessly with our existing systems. Their team's expertise and dedication were evident throughout the project, resulting in significant efficiency gains and cost savings. We highly recommend Spark & Co for any enterprise software development needs.",
      },
    ],
  },
];

export const TecnologhyAndArchitecture = [
  {
    type: "subtitle",
    content: "Technology Stack",
  },
  {
    type: "Card",
    subtype: "Technology",
    title: "AWS (EC2, RDS, S3, CloudFront)",
    content: [
      {
        Purpose: "Cloud infrastructure and hosting",
        Motive:
          "Industry-leading reliability, scalability, and comprehensive security compliance (SOC 2, HIPAA, ISO 27001)",
      },
    ],
  },
  {
    type: "Card",
    subtype: "Technology",
    title: "Node.js + TypeScript",
    content: [
      {
        Purpose: "Backend API services",
        Motive:
          "High performance, excellent ecosystem, strong typing for maintainability",
      },
    ],
  },
];
export const TeamAndCommunication = [
  {
    type: "subtitle",
    content: "Team Members",
  },
  {
    type: "Card",
    subtype: "Team",
    title: "Sarah Chen",
    content: [
      {
        Purpose: "Project Manager",
        Motive: "25% (10 hrs/week)",
      },
    ],
  },
  {
    type: "Card",
    subtype: "Team",
    title: "Sarah Chen",
    content: [
      {
        Purpose: "Project Manager",
        Motive: "25% (10 hrs/week)",
      },
    ],
  },
  {
    type: "Card",
    subtype: "Team",
    title: "Sarah Chen",
    content: [
      {
        Purpose: "Project Manager",
        Motive: "25% (10 hrs/week)",
      },
    ],
  },
  {
    type: "Card",
    subtype: "Team",
    title: "Sarah Chen",
    content: [
      {
        Purpose: "Project Manager",
        Motive: "25% (10 hrs/week)",
      },
    ],
  },
  {
    type: "Card",
    subtype: "Team",
    title: "Sarah Chen",
    content: [
      {
        Purpose: "Project Manager",
        Motive: "25% (10 hrs/week)",
      },
    ],
  },
  {
    type: "Card",
    subtype: "Team",
    title: "Sarah Chen",
    content: [
      {
        Purpose: "Project Manager",
        Motive: "25% (10 hrs/week)",
      },
    ],
  },
  {
    type: "subtitle",
    content: "Project Governance (RACI Matrix)",
  },

  {
    type: "table",
    content: {
      headers: [
        "Activity",
        "Responsible",
        "Accountable",
        "Consulted",
        "Informed",
      ],
      rows: [
        [
          "Project Planning & Strategy",
          "Project Manager",
          "Solution Architect",
          "Client Stakeholders",
          "Development Team",
        ],
        [
          "Project Planning & Strategy",
          "Project Manager",
          "Solution Architect",
          "Client Stakeholders",
          "Development Team",
        ],
        [
          "Project Planning & Strategy",
          "Project Manager",
          "Solution Architect",
          "Client Stakeholders",
          "Development Team",
        ],
      ],
      footer: ["Total Investment", "$185,000"],
    },
  },
  {
    type: "subtitle",
    content: "Communication Channels",
  },

  {
    type: "list",
    content: {
      subtype: "numbered",
      items: [
        "Review this proposal thoroughly and discuss any questions with your team",
        "Sign the Master Service Agreement if not already in place",
        "Accept this proposal using the button below or schedule a call to discuss",
        "Provide initial system access and credentials",
        "Schedule project kickoff meeting for week of March 11, 2026",
      ],
    },
  },
  {
    type: "subtitle",
    content: "Meeting Cadence",
  },
  {
    type: "text",
    content:
      "Bi-weekly sprint reviews (2 hours), weekly status calls (30 minutes), and monthly steering committee meetings with executive stakeholders",
  },
];

export const Deliverables = [
  {
    type: "subtitle",
    content: "Scope Overview",
  },
  {
    type: "subtitle",
    content: "Included Modules",
  },
  {
    type: "card",
    subtype: "timeline",
    title: "Core ERP Platform",
    content: {
      text: "Cloud-native backend services handling inventory management, order processing, procurement, and financial transactions. Includes RESTful APIs, database architecture, and authentication/authorization framework.",
    },
  },
  {
    type: "card",
    subtype: "timeline",
    title: "Web Application",

    content: {
      text: "Responsive Progressive Web App (PWA) providing full ERP functionality across desktop and tablet devices. Features role-based dashboards, advanced search, and bulk operations.",
    },
  },
  {
    type: "subtitle",
    content: "Exclusions",
  },
  { type: "subtitle", content: "Client Responsibilities" },
  {
    type: "list",
    content: {
      subtype: "bullet",
      items: [
        "Provide a primary point of contact with decision-making authority",
        "Provide access to required systems and environments",
        "Review deliverables within agreed timelines (5 business days)",
        "Ensure accuracy of provided data and content",
      ],
    },
  },
  {
    type: "subtitle",
    content: "Deliverable Items",
  },
  {
    type: "card",
    subtype: "Deliverable",
    title: "Technical Architecture Document",
    content: {
      text: "Comprehensive documentation detailing system architecture, technology stack, security model, and deployment strategy.",
      acceptanceCriteria:
        "Document reviewed and approved by Acme's CTO and IT leadership team.",
    },
  },
  {
    type: "card",
    subtype: "Deliverable",
    title: "Web Application",
    content: {
      text: "Production-ready web application deployed and accessible via secure URL.",
      acceptanceCriteria:
        "Application passes UAT testing by designated Acme users. All priority 1 and 2 bugs resolved.",
    },
  },
];
