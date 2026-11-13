// Technical review (SPA-586) — every question, as data. IDs and wording match
// marketing-site/docs/TECHNICAL_REVIEW_FLOW.md; change that file first.
import type {
  AreaId,
  CheckDef,
  Context,
  ModuleId,
  Option,
  Question,
  Stage,
  TechStage,
} from "./types.ts";

const opts = (...pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

// ── Option lists (values are stable IDs; labels are what people see) ────────

export const INDUSTRY = opts(
  ["saas", "SaaS / B2B software"],
  ["fintech", "Fintech / financial services"],
  ["healthcare", "Healthcare / wellness"],
  ["insurance", "Insurance"],
  ["ecommerce", "E-commerce / retail"],
  ["education", "Education"],
  ["real_estate", "Real estate"],
  ["legal", "Legal"],
  ["media", "Media / content"],
  ["marketplace", "Marketplace"],
  ["government", "Government / public sector"],
  ["internal_tool", "Internal tool"],
  ["other", "Other"],
);

export const USERS = opts(
  ["public", "The public (consumers)"],
  ["small_business", "Small businesses"],
  ["enterprise", "Large enterprises"],
  ["internal", "Our internal team only"],
  ["government", "Government / public sector"],
);

export const SCALE = opts(
  ["under_100", "Under 100"],
  ["100_10k", "100–10,000"],
  ["10k_100k", "10,000–100,000"],
  ["100k_plus", "100,000+"],
);

export const REGION = opts(
  ["us", "US"],
  ["canada", "Canada"],
  ["eu_uk", "EU / UK"],
  ["au_nz", "Australia / NZ"],
  ["other", "Other"],
  ["not_sure", "Not sure yet"],
);

export const YES_NO_NOT_SURE = opts(["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]);
export const YES_NO_UNSURE = opts(["yes", "Yes"], ["no", "No"], ["unsure", "Unsure"]);

export const FEATURES = opts(
  ["payments", "Take payments"],
  ["personal_data", "Store personal data"],
  ["ai_features", "Use AI features (chat, generation, etc.)"],
  ["uploads", "Let users upload files"],
  ["admin", "Have an admin area"],
  ["multi_tenant", "Serve multiple companies / teams"],
  ["none", "None of these"],
);

export const AI_TOOLS = opts(
  ["lovable", "Lovable"],
  ["bolt", "Bolt"],
  ["v0", "V0"],
  ["replit", "Replit"],
  ["cursor", "Cursor"],
  ["claude_code", "Claude Code"],
  ["copilot", "GitHub Copilot"],
  ["windsurf", "Windsurf"],
  ["other", "Other"],
  ["none", "None"],
);

// ── Shared pages (all branches) ─────────────────────────────────────────────

export const INTRO: Question[] = [
  { id: "intro_email", text: "Where should we send your personalized report?", type: "email", required: true, placeholder: "bob@example.com" },
  { id: "intro_name", text: "Your name", type: "text", required: true, placeholder: "Bob Smith" },
  { id: "intro_company", text: "Company name", type: "text", required: false, placeholder: "Acme Inc." },
  {
    id: "intro_role",
    text: "What best describes you?",
    type: "single",
    required: true,
    // Internal only: never changes questions, wording, routing or results.
    options: opts(
      ["founder", "Founder"],
      ["cto", "CTO / Head of Engineering"],
      ["product", "Product owner / PM"],
      ["operations", "Operations"],
      ["other", "Other"],
    ),
  },
];

export const STAGE_QUESTION: Question = {
  id: "stage",
  text: "Where is your product today?",
  type: "single",
  required: true,
  options: opts(
    ["idea", "Just an idea — haven't started building"],
    ["building", "Building — work has started, not yet in users' hands"],
    ["mvp", "MVP — live with early users or customers"],
    ["scaling", "Scaling — growing usage, team or customers"],
  ),
};

// Required in Idea, optional elsewhere. Multiline, with a sample answer as
// the placeholder.
export function aboutQuestions(stage: Stage): Question[] {
  const required = stage === "idea";
  return [
    {
      id: "about_company",
      text: "What does your company do?",
      type: "long_text",
      required,
      placeholder: "e.g. We help independent physiotherapy clinics run their practice online.",
    },
    {
      id: "about_product",
      text: "What does (or will) your product do?",
      type: "long_text",
      required,
      placeholder: "e.g. Patients book appointments and get exercise plans; clinics manage their schedule and patient records.",
    },
    {
      id: "about_audience",
      text: "Who is it for?",
      type: "long_text",
      required,
      placeholder: "e.g. Small physiotherapy clinics and their patients.",
    },
  ];
}

export const SCOPE: Question[] = [
  { id: "scope_industry", text: "Industry", type: "single", required: true, options: INDUSTRY },
  { id: "scope_users", text: "Who uses it?", type: "multi", required: true, options: USERS },
  {
    id: "scope_scale",
    text: "How many users do you have, or expect within 12 months?",
    type: "single",
    required: true,
    options: SCALE,
  },
  { id: "scope_region", text: "Where are your users?", type: "multi", required: true, options: REGION },
  {
    id: "scope_children",
    text: "Could children (under 16) use it?",
    type: "single",
    required: true,
    options: YES_NO_NOT_SURE,
    // Hidden when users are only businesses / enterprises / internal team.
    showIf: { q: "scope_users", anyOf: ["public", "government"] },
  },
];

// ── Technical intake T1–T3 (Building, MVP, Scaling) ─────────────────────────

export const INTAKE: Question[] = [
  {
    id: "t1_team",
    text: "Who is working on the product?",
    type: "multi",
    required: true,
    options: opts(
      ["myself", "Myself"],
      ["cofounder", "Co-founder"],
      ["freelancer", "Freelancer / agency"],
      ["internal_team", "Internal team"],
      ["vendor", "Outsourced vendor"],
    ),
  },
  { id: "t2_ai_tools", text: "Did you use any AI tools to build it?", type: "multi", required: true, options: AI_TOOLS },
  {
    id: "t2_hosting",
    text: "Where is it hosted?",
    type: "single",
    required: true,
    options: opts(
      ["vercel", "Vercel"],
      ["netlify", "Netlify"],
      ["cloudflare", "Cloudflare"],
      ["aws", "AWS"],
      ["gcp", "Google Cloud"],
      ["azure", "Azure"],
      ["supabase", "Supabase"],
      ["firebase", "Firebase"],
      ["railway_render", "Railway / Render"],
      ["ai_platform", "Inside the AI tool's platform"],
      ["dont_know", "Don't know"],
    ),
  },
  {
    id: "t2_stack",
    text: "What is it built with?",
    type: "multi",
    required: true,
    options: opts(
      ["react_next", "React / Next.js"],
      ["vue_nuxt", "Vue / Nuxt"],
      ["node", "Node"],
      ["python", "Python"],
      ["supabase", "Supabase"],
      ["firebase", "Firebase"],
      ["mobile", "Mobile (iOS / Android / React Native / Flutter)"],
      ["other", "Other"],
      ["dont_know", "Don't know"],
    ),
  },
  { id: "t2_features", text: "Does your product…", type: "multi", required: true, options: FEATURES },
];

// ── Checks (Yes / No / Unsure unless `options`) ─────────────────────────────
// One entry per check ID; the same ID keeps the same meaning in every stage,
// so a module and a core question dedupe.

const C = (def: CheckDef) => def;

export const CHECKS: Record<string, CheckDef> = Object.fromEntries(
  [
    // Ownership (T3) — asked in the intake, scored as the Ownership area.
    C({
      id: "t3_code_control",
      text: "Who controls your code?",
      subtitle: "Code ownership",
      topic: "security",
      // Assumption #8.
      options: [
        { value: "self", label: "I own and manage it myself", score: 2 },
        { value: "in_house", label: "Our in-house engineering team manages it", score: 2 },
        { value: "agency", label: "An external agency / freelancer manages it", score: 1 },
        { value: "ai_platform_only", label: "It lives only inside an AI tool's platform (e.g. a Lovable or Bolt account)", score: 0 },
        { value: "mixed", label: "Mixed / shared", score: 1 },
        { value: "not_sure", label: "Not sure", score: 0 },
      ],
    }),
    C({ id: "t3_accounts_owned", text: "Are your hosting account and domain registered to the company?", subtitle: "Account and IP ownership", topic: "security" }),
    C({ id: "t3_takeover", text: "If the person or vendor managing it left tomorrow, could someone else take over?", subtitle: "Documentation, bus factor", topic: "general" }),

    // Security
    C({ id: "access_control", text: "Have you checked that one user can never see another user's data?", subtitle: "Access control, row-level security", topic: "security" }),
    C({ id: "auth_provider", text: "Is login handled by a trusted provider (e.g. Supabase Auth, Clerk, Auth0) rather than custom-built?", subtitle: "Authentication", topic: "security" }),
    C({ id: "secrets_audit", text: "Have you checked that no passwords or API keys are visible in your code or website?", subtitle: "Secrets audit", topic: "security" }),
    C({
      id: "mfa_infra",
      text: "Do the accounts that control your product (hosting, code, database, domain) require two-step login?",
      textByStage: { scaling: "Do the accounts that control your product require two-step login?" },
      subtitle: "MFA on infrastructure accounts",
      topic: "security",
    }),
    C({ id: "input_validation", text: "Is what users type into forms checked before it's saved or shown?", subtitle: "Input validation, SQL injection, XSS", topic: "security" }),
    C({ id: "dependency_scan", text: "Do you check the third-party packages you use for known security problems?", subtitle: "Dependency vulnerability scanning", topic: "security" }),
    C({ id: "admin_access", text: "Is the admin area locked down so only the right people can reach it?", subtitle: "Admin access control", topic: "security", requires: "admin" }),
    C({
      id: "upload_security",
      text: "Are uploaded files checked for type and size, and kept private where needed?",
      textByStage: { building: "Are uploaded files kept in proper file storage, checked for type and size, and private where needed?" },
      subtitle: "Object storage, upload security",
      topic: "security",
      requires: "uploads",
    }),
    C({ id: "least_privilege", text: "Does each person and service only have access to what they need?", subtitle: "Least privilege / RBAC", topic: "security" }),
    C({ id: "pentest", text: "Has anyone tried to break into it on purpose in the last year?", subtitle: "Penetration test, SAST/DAST", topic: "security" }),
    C({ id: "audit_trail", text: "Can you see who changed important data or settings, and when?", subtitle: "Audit trail", topic: "security" }),

    // Data & architecture
    C({ id: "data_model", text: "Will your data structure still work if usage grows 10x or you add major features?", subtitle: "Data model / schema design", topic: "general" }),
    C({ id: "tenant_isolation", text: "Is each company's data clearly kept separate?", subtitle: "Multi-tenancy / tenant isolation", topic: "security", requires: "multi_tenant" }),
    C({ id: "idempotency", text: "Are you protected against charging a customer twice if a payment or webhook is sent twice?", subtitle: "Idempotency", topic: "general", requires: "payments" }),
    C({
      id: "race_conditions",
      text: "If two people do the same thing at the same moment, does the app handle it correctly?",
      textByStage: { mvp: "If two people do the same thing at the same moment (e.g. book the last slot, edit the same record), does the app handle it correctly?" },
      subtitle: "Race conditions, concurrency",
      topic: "general",
    }),

    // Launch readiness / reliability
    C({ id: "staging", text: "Is there a separate test version of the app, apart from the live one?", textByStage: { building: "Is there a separate test version of the app, apart from the one users will use?" }, subtitle: "Staging environment", topic: "general" }),
    C({ id: "backups", text: "Are automatic database backups switched on?", subtitle: "Backups", topic: "backups" }),
    C({
      id: "backup_restore",
      text: "If your database disappeared tomorrow, could you restore it — and have you tried?",
      textByStage: { scaling: "If your database disappeared tomorrow, could you restore it — and have you tested it recently?" },
      subtitle: "Backups and tested restore",
      topic: "backups",
    }),
    C({
      id: "error_monitoring",
      text: "Would you find out if the app broke at 2am — before a customer told you?",
      textByStage: { building: "Once you launch, would you find out if the app broke — before a user told you?" },
      subtitle: "Error monitoring, alerting",
      topic: "general",
    }),
    C({ id: "uptime", text: "Would you know if the whole site went down?", subtitle: "Uptime monitoring", topic: "general" }),
    C({ id: "rollback", text: "Can you undo a bad release quickly?", subtitle: "Rollback", topic: "general" }),
    C({ id: "third_party_failure", text: "If a service you depend on (payments, email, AI provider) goes down, does your app handle it gracefully?", subtitle: "Third-party failure handling", topic: "general" }),
    C({ id: "incident_runbook", text: "Is there a written plan for what to do when something goes badly wrong?", subtitle: "Incident response / runbook", topic: "general" }),
    C({ id: "no_spof", text: "Could the app keep running if any single part of it failed?", subtitle: "No single points of failure", topic: "scale" }),
    C({ id: "retries", text: "When outside services fail or are slow, does the app retry sensibly instead of breaking?", subtitle: "Retries, timeouts, circuit breakers", topic: "general" }),
    C({ id: "cross_browser", text: "Have you tested on different browsers and phones?", subtitle: "Cross-browser / device testing", topic: "general" }),

    // Privacy & legal
    C({ id: "legal_basics", text: "Do you have a privacy policy and terms of service?", textByStage: { building: "Do you have a privacy policy and terms of service ready?" }, subtitle: "Legal basics", topic: "privacy" }),
    C({
      id: "consent",
      text: "Do you ask users for permission before collecting their data (e.g. cookies, emails)?",
      textByStage: { building: "Will you ask users for permission before collecting their data (e.g. cookies, emails)?" },
      subtitle: "Consent management",
      topic: "privacy",
    }),
    C({
      id: "pci_scope",
      text: "Are card details handled entirely by your payment provider, never stored by you?",
      textByStage: { building: "Are card details handled entirely by your payment provider (e.g. Stripe), never stored by you?" },
      subtitle: "PCI scope",
      topic: "security",
      requires: "payments",
    }),
    C({ id: "gdpr_deletion", text: "Could you delete everything you hold about a user if they asked?", subtitle: "GDPR / data subject requests", topic: "privacy" }),
    C({ id: "pii_masking", text: "Do you hide sensitive information (names, emails, card details) in logs and screens where it isn't needed?", subtitle: "PII masking / redaction", topic: "privacy" }),
    C({ id: "dpas", text: "Do you have data agreements with the services that handle your users' data?", subtitle: "DPAs with sub-processors", topic: "privacy" }),
    C({ id: "data_residency", text: "Do you know which country your users' data is stored in?", subtitle: "Data residency", topic: "privacy" }),
    C({ id: "data_retention", text: "Do you have a rule for how long you keep data?", subtitle: "Data retention policy", topic: "privacy" }),
    C({ id: "accessibility", text: "Can people using screen readers or keyboards use your product?", subtitle: "Accessibility / WCAG", topic: "general" }),
    C({
      id: "soc2",
      text: "Have customers asked for security certifications?",
      subtitle: "SOC 2 / ISO 27001",
      topic: "security",
      // Assumption #9.
      options: [
        { value: "have_one", label: "Yes, we have one", score: 2 },
        { value: "dont_have", label: "Yes, we don't yet", score: 0 },
        { value: "not_asked", label: "Not yet asked", score: null },
        { value: "unsure", label: "Unsure", score: 1 },
      ],
    }),

    // Abuse & cost
    C({ id: "rate_limit", text: "Is it protected against one person (or a bot) overloading it with requests?", subtitle: "Rate limiting", topic: "security" }),
    C({ id: "cost_alerts", text: "Do you get an alert if your hosting or service bills spike?", subtitle: "Cloud cost alerts, budget caps", topic: "general" }),

    // Releasing & engineering process
    C({ id: "code_review", text: "Does someone review code changes before they go live?", subtitle: "Code review / pull requests", topic: "general" }),
    C({ id: "e2e_tests", text: "Are the most important flows (sign-up, login, payment) tested automatically?", subtitle: "E2E tests on critical paths", topic: "general" }),
    C({ id: "db_migrations", text: "Are database changes made in a controlled, reversible way?", subtitle: "Database migrations", topic: "general" }),
    C({ id: "cicd", text: "Are releases automated and reviewed, rather than done by hand?", subtitle: "CI/CD, code review", topic: "general" }),
    C({ id: "regression_tests", text: "When you change something, is there an automatic check that you didn't break something else?", subtitle: "Automated regression tests", topic: "general" }),
    C({ id: "feature_flags", text: "Can you turn a new feature on for some users only?", subtitle: "Feature flags", topic: "general" }),
    C({ id: "prod_access", text: "Is it clear who is allowed to release to the live app?", subtitle: "Production access control", topic: "security" }),

    // Visibility & vendors
    C({ id: "logging", text: "If something went wrong last week, could you look up what happened?", subtitle: "Logging", topic: "general" }),
    C({
      id: "product_analytics",
      text: "Do you know how people actually use the product (which features, where they drop off)?",
      textByStage: { building: "Will you be able to see how people use the product (which features, where they drop off)?" },
      subtitle: "Product analytics",
      topic: "general",
    }),
    C({ id: "vendor_sbom", text: "Do you have a list of every outside service and library your product depends on?", subtitle: "Vendor audit / SBOM", topic: "general" }),
    C({ id: "log_retention", text: "Are logs kept long enough to investigate problems from weeks or months ago?", subtitle: "Log retention", topic: "general" }),

    // Performance & scale
    C({ id: "load_testing", text: "Do you know how many users it can handle at once?", subtitle: "Load testing", topic: "scale" }),
    C({ id: "autoscaling", text: "Can the app automatically handle a sudden spike in traffic?", subtitle: "Auto-scaling", topic: "scale" }),
    C({ id: "db_performance", text: "Do pages stay fast as your data grows?", subtitle: "Database indexing, query performance", topic: "scale" }),
    C({
      id: "background_jobs",
      text: "Are slow tasks (emails, reports, AI processing) run in the background, so users aren't left waiting?",
      subtitle: "Background jobs / queues",
      topic: "scale",
    }),
    C({ id: "cdn", text: "Are images and static files served from a CDN?", subtitle: "Caching, CDN", topic: "scale" }),

    // AI features (only with "Use AI features")
    C({ id: "ai_prompt_injection", text: "Could a user trick the AI into ignoring its instructions or leaking data? (We've checked)", subtitle: "Prompt injection", topic: "security", requires: "ai_features" }),
    C({ id: "ai_data_exposure", text: "Do you know what customer data gets sent to the AI provider?", subtitle: "Data exposure to model vendors", topic: "privacy", requires: "ai_features" }),
    C({
      id: "ai_token_quota",
      text: "Do you know what each user costs you in AI usage, and is there a cap?",
      textByStage: { building: "Is there a cap on how much AI usage one user can run up?" },
      subtitle: "Token quotas, LLM cost per user",
      topic: "general",
      requires: "ai_features",
    }),
    C({
      id: "ai_output_validation",
      text: "Do you check AI answers before they're shown or acted on (e.g. wrong facts, unsafe content)?",
      textByStage: { scaling: "Do you check AI answers before they're shown or acted on?" },
      subtitle: "Output validation, guardrails",
      topic: "general",
      requires: "ai_features",
    }),
    C({
      id: "ai_human_loop",
      text: "Is there a human check for high-stakes AI actions (e.g. sending emails, changing records, money)?",
      textByStage: { scaling: "Is there a human check for high-stakes AI actions?" },
      subtitle: "Human-in-the-loop",
      topic: "general",
      requires: "ai_features",
    }),
    C({ id: "ai_vendor_retention", text: "Is the AI provider prevented from training on or keeping your customers' data?", subtitle: "Vendor data retention / training opt-out", topic: "privacy", requires: "ai_features" }),
    C({ id: "ai_fallback", text: "If the AI provider is down or slow, does your app still work?", subtitle: "Model fallback, timeouts", topic: "general", requires: "ai_features" }),
    C({ id: "ai_evals", text: "Do you have a way to test whether AI quality changes when you update prompts or models?", subtitle: "Evals / AI regression testing", topic: "general", requires: "ai_features" }),

    // Module-only checks
    C({ id: "hc_hipaa_scope", text: "Do you know whether the health information you handle is legally protected (e.g. HIPAA in the US)?", subtitle: "HIPAA / PHI scope", topic: "privacy" }),
    C({ id: "hc_baa", text: "Do the services that touch health data (hosting, database, email, AI provider) sign agreements to protect it?", subtitle: "Business Associate Agreements (BAAs)", topic: "privacy" }),
    C({ id: "hc_phi_min", text: "Is health information kept out of logs, analytics and AI prompts unless it's needed?", subtitle: "PHI minimization", topic: "privacy" }),
    C({ id: "hc_audit_log", text: "Is every view or change of health records recorded?", subtitle: "Access audit logging", topic: "privacy" }),
    C({ id: "hc_gdpr_art9", text: "Are you treating health data as \"special category\" data with extra protections?", subtitle: "GDPR Article 9", topic: "privacy" }),
    C({ id: "fin_reg_scope", text: "Do you know which financial regulations apply to you (e.g. money transmission, lending, investment advice)?", subtitle: "Regulatory scope", topic: "privacy" }),
    C({ id: "fin_kyc", text: "Is identity checking handled by a specialist provider rather than built yourself?", subtitle: "KYC / AML provider", topic: "security" }),
    C({ id: "fin_ledger", text: "Is every change to money or account balances recorded and impossible to edit after the fact?", subtitle: "Immutable ledger, audit trail", topic: "security" }),
    C({ id: "fin_open_banking", text: "Do you use a bank-data provider (e.g. Plaid) rather than storing users' bank logins?", subtitle: "Open banking / credential handling", topic: "security" }),
    C({ id: "edu_parental_consent", text: "Do you get a parent's permission before collecting a child's data?", subtitle: "COPPA (US), GDPR-K / Age Appropriate Design Code (UK/EU)", topic: "privacy" }),
    C({ id: "edu_age_check", text: "Do you check users' ages at sign-up?", subtitle: "Age assurance", topic: "privacy" }),
    C({ id: "edu_ferpa", text: "Do you know your obligations for student records?", subtitle: "FERPA", topic: "privacy" }),
    C({ id: "mkt_payouts", text: "Are payouts to sellers handled by a payment platform built for marketplaces?", subtitle: "Stripe Connect / split payments, KYC of sellers", topic: "security", requires: "payments" }),
    C({ id: "mkt_reporting", text: "Can users report bad listings, people or content, and does someone review reports?", subtitle: "Trust & safety, content moderation", topic: "general" }),
    C({ id: "mkt_fraud", text: "Do you have checks for fake accounts and fraudulent transactions?", subtitle: "Fraud detection", topic: "security" }),
    C({ id: "gov_accessibility", text: "Do you know the accessibility standard your public-sector customers require?", subtitle: "Section 508 / WCAG 2.1 AA / EN 301 549", topic: "general" }),
    C({ id: "gov_sovereignty", text: "Do customers require data to stay in their country, or a government security approval?", subtitle: "Data sovereignty, FedRAMP / IRAP / G-Cloud", topic: "privacy" }),
    C({ id: "ent_sso", text: "Can customers log in with their company accounts (e.g. Okta, Microsoft)?", subtitle: "SSO / SAML", topic: "security" }),
    C({ id: "ent_rbac", text: "Can customer admins control what each of their staff can see and do?", subtitle: "Role-based permissions", topic: "security" }),
    C({ id: "ent_export_delete", text: "Can a customer export or fully delete their company's data?", subtitle: "Data portability, offboarding", topic: "privacy" }),
    C({ id: "reg_ccpa", text: "Do you let California users opt out of their data being sold or shared?", subtitle: "CCPA / CPRA", topic: "privacy" }),
    C({ id: "reg_pipeda", text: "Do you know your obligations for personal data and breach reporting?", subtitle: "PIPEDA, Quebec Law 25", topic: "privacy" }),
    C({ id: "reg_au_privacy", text: "Do you know your obligations under the Privacy Act, including breach notification?", subtitle: "Notifiable Data Breaches scheme", topic: "privacy" }),
    C({ id: "pub_bot_protection", text: "Is sign-up protected against bots and fake accounts?", subtitle: "Bot protection, CAPTCHA, email verification", topic: "security" }),
    C({ id: "pub_ugc_moderation", text: "If users post content others can see, can it be reported and removed?", subtitle: "User-generated content moderation", topic: "general" }),
  ].map((c) => [c.id, c]),
);

export const OWNERSHIP_CHECKS = ["t3_code_control", "t3_accounts_owned", "t3_takeover"];

// ── Areas and stage layouts ─────────────────────────────────────────────────

export const AREA_LABELS: Record<AreaId, string> = {
  ownership: "Ownership",
  security: "Security",
  data: "Data & architecture",
  launch: "Launch readiness",
  reliability: "Reliability & recovery",
  abuse: "Abuse & cost",
  privacy: "Privacy & compliance",
  quality: "Releasing & quality",
  visibility: "Visibility",
  architecture: "Architecture",
  performance: "Performance & scale",
  cost: "Cost",
  compliance: "Compliance & enterprise readiness",
  vendors: "Visibility & vendors",
  engineering: "Engineering process",
  ai: "AI features",
};

type Layout = { area: AreaId; label?: string; checks: string[] }[];

// Core checks per stage, in the order they're asked. Ownership (T3) is
// asked in the intake and scored, so it's not listed here.
export const STAGE_LAYOUT: Record<TechStage, Layout> = {
  building: [
    { area: "security", label: "Security foundations", checks: ["access_control", "auth_provider", "secrets_audit", "mfa_infra", "input_validation"] },
    { area: "data", label: "Data & architecture foundations", checks: ["data_model", "tenant_isolation", "idempotency", "upload_security"] },
    { area: "launch", checks: ["staging", "backups", "error_monitoring", "legal_basics", "consent", "pci_scope", "cross_browser", "product_analytics"] },
    { area: "ai", checks: ["ai_prompt_injection", "ai_data_exposure", "ai_token_quota"] },
  ],
  mvp: [
    { area: "security", checks: ["access_control", "secrets_audit", "dependency_scan", "mfa_infra", "admin_access", "upload_security"] },
    { area: "reliability", checks: ["backup_restore", "error_monitoring", "uptime", "rollback", "third_party_failure"] },
    { area: "abuse", checks: ["rate_limit", "cost_alerts", "ai_token_quota"] },
    { area: "privacy", checks: ["consent", "legal_basics", "gdpr_deletion", "pii_masking", "pci_scope"] },
    { area: "quality", checks: ["staging", "code_review", "e2e_tests", "db_migrations"] },
    { area: "visibility", checks: ["logging", "product_analytics"] },
    { area: "architecture", checks: ["race_conditions", "idempotency"] },
    { area: "ai", checks: ["ai_prompt_injection", "ai_data_exposure", "ai_output_validation", "ai_human_loop"] },
  ],
  scaling: [
    { area: "security", checks: ["least_privilege", "pentest", "dependency_scan", "mfa_infra", "audit_trail"] },
    { area: "reliability", checks: ["backup_restore", "incident_runbook", "no_spof", "retries"] },
    { area: "performance", checks: ["load_testing", "autoscaling", "db_performance", "background_jobs", "race_conditions", "idempotency"] },
    { area: "cost", checks: ["cost_alerts", "ai_token_quota"] },
    { area: "compliance", checks: ["soc2", "dpas", "data_residency", "data_retention", "gdpr_deletion", "accessibility"] },
    { area: "vendors", checks: ["vendor_sbom", "log_retention"] },
    { area: "engineering", checks: ["cicd", "regression_tests", "feature_flags", "prod_access", "db_migrations"] },
    { area: "ai", checks: ["ai_vendor_retention", "ai_output_validation", "ai_fallback", "ai_evals", "ai_human_loop"] },
  ],
};

// ── Context modules ─────────────────────────────────────────────────────────

// Where a module question sits, by what it's about. Building has no privacy
// area, so compliance questions go to Launch readiness (assumption #7).
type Kind = "compliance" | "security" | "scale" | "abuse";

const KIND_AREA: Record<TechStage, Record<Kind, AreaId>> = {
  building: { compliance: "launch", security: "security", scale: "data", abuse: "security" },
  mvp: { compliance: "privacy", security: "security", scale: "architecture", abuse: "abuse" },
  scaling: { compliance: "compliance", security: "security", scale: "performance", abuse: "security" },
};

export function moduleArea(stage: TechStage, kind: Kind): AreaId {
  return KIND_AREA[stage][kind];
}

const B: TechStage = "building";
const M: TechStage = "mvp";
const S: TechStage = "scaling";

export type ModuleQuestion = { id: string; stages: TechStage[]; kind: Kind; when?: (ctx: Context) => boolean };

export type ModuleDef = {
  id: ModuleId;
  label: string;
  // The AI backup detector may add this module from the free text.
  aiDetectable: boolean;
  trigger: (ctx: Context) => boolean;
  questions: ModuleQuestion[];
};

const has = (list: string[] | undefined, v: string) => !!list?.includes(v);
export const childrenMayUse = (ctx: Context) => ctx.children === "yes" || ctx.children === "not_sure"; // assumption #2
export const isLargeUserBase = (ctx: Context) => ctx.scale === "10k_100k" || ctx.scale === "100k_plus";

export const MODULES: ModuleDef[] = [
  {
    id: "healthcare",
    label: "Healthcare / wellness",
    aiDetectable: true,
    trigger: (ctx) => ctx.industry === "healthcare",
    questions: [
      { id: "hc_hipaa_scope", stages: [B, M, S], kind: "compliance" },
      { id: "hc_baa", stages: [B, M, S], kind: "compliance", when: (ctx) => has(ctx.region, "us") },
      { id: "hc_phi_min", stages: [M, S], kind: "compliance" },
      { id: "hc_audit_log", stages: [M, S], kind: "compliance" },
      { id: "hc_gdpr_art9", stages: [B, M, S], kind: "compliance", when: (ctx) => has(ctx.region, "eu_uk") },
    ],
  },
  {
    id: "children",
    label: "Education and children",
    aiDetectable: false,
    trigger: (ctx) => childrenMayUse(ctx) || ctx.industry === "education",
    questions: [
      { id: "edu_parental_consent", stages: [B, M, S], kind: "compliance", when: childrenMayUse },
      { id: "edu_age_check", stages: [B, M], kind: "compliance", when: childrenMayUse },
      // Assumption #3: "schools are customers (US)".
      { id: "edu_ferpa", stages: [B, M, S], kind: "compliance", when: (ctx) => ctx.industry === "education" && has(ctx.region, "us") },
    ],
  },
  {
    id: "fintech",
    label: "Fintech / financial services / insurance",
    aiDetectable: true,
    trigger: (ctx) => ctx.industry === "fintech" || ctx.industry === "insurance",
    questions: [
      { id: "fin_reg_scope", stages: [B, M, S], kind: "compliance" },
      { id: "fin_kyc", stages: [B, M, S], kind: "security" },
      { id: "fin_ledger", stages: [M, S], kind: "security" },
      { id: "fin_open_banking", stages: [B, M], kind: "security" },
    ],
  },
  {
    id: "government",
    label: "Government / public sector",
    aiDetectable: true,
    trigger: (ctx) => ctx.industry === "government" || has(ctx.users, "government"),
    questions: [
      { id: "gov_accessibility", stages: [B, M, S], kind: "compliance" },
      { id: "gov_sovereignty", stages: [M, S], kind: "compliance" },
    ],
  },
  {
    id: "enterprise",
    label: "Large enterprises as customers",
    aiDetectable: false,
    trigger: (ctx) => has(ctx.users, "enterprise"),
    questions: [
      { id: "ent_sso", stages: [M, S], kind: "security" },
      { id: "ent_rbac", stages: [B, M, S], kind: "security" },
      { id: "soc2", stages: [M], kind: "compliance" }, // moved forward
      { id: "ent_export_delete", stages: [M, S], kind: "compliance" },
      { id: "dpas", stages: [M], kind: "compliance" }, // moved forward
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    aiDetectable: true,
    trigger: (ctx) => ctx.industry === "marketplace",
    questions: [
      { id: "mkt_payouts", stages: [B, M, S], kind: "security" },
      { id: "mkt_reporting", stages: [M, S], kind: "abuse" },
      { id: "mkt_fraud", stages: [M, S], kind: "abuse" },
    ],
  },
  {
    id: "region",
    label: "Where your users are",
    aiDetectable: false,
    trigger: (ctx) => ["eu_uk", "us", "canada", "au_nz"].some((r) => has(ctx.region, r)),
    questions: [
      { id: "gdpr_deletion", stages: [B, M, S], kind: "compliance", when: (ctx) => has(ctx.region, "eu_uk") },
      { id: "data_residency", stages: [B, M, S], kind: "compliance", when: (ctx) => has(ctx.region, "eu_uk") },
      { id: "dpas", stages: [B, M, S], kind: "compliance", when: (ctx) => has(ctx.region, "eu_uk") },
      { id: "reg_ccpa", stages: [M, S], kind: "compliance", when: (ctx) => has(ctx.region, "us") && has(ctx.users, "public") },
      { id: "reg_pipeda", stages: [M, S], kind: "compliance", when: (ctx) => has(ctx.region, "canada") },
      { id: "reg_au_privacy", stages: [M, S], kind: "compliance", when: (ctx) => has(ctx.region, "au_nz") },
    ],
  },
  {
    id: "public",
    label: "The public (consumers)",
    aiDetectable: false,
    trigger: (ctx) => has(ctx.users, "public"),
    questions: [
      { id: "pub_bot_protection", stages: [B, M, S], kind: "security" },
      { id: "pub_ugc_moderation", stages: [M, S], kind: "abuse" }, // assumption #10
    ],
  },
  {
    id: "scale",
    label: "Large user base",
    aiDetectable: false,
    trigger: isLargeUserBase,
    questions: [
      { id: "load_testing", stages: [B, M], kind: "scale" },
      { id: "autoscaling", stages: [B, M], kind: "scale" },
      { id: "db_performance", stages: [M], kind: "scale" },
      { id: "cdn", stages: [B, M, S], kind: "scale" },
      { id: "background_jobs", stages: [B, M], kind: "scale" },
      { id: "no_spof", stages: [M], kind: "scale", when: (ctx) => ctx.scale === "100k_plus" },
      { id: "incident_runbook", stages: [M], kind: "scale", when: (ctx) => ctx.scale === "100k_plus" },
    ],
  },
];

// ── Idea branch ─────────────────────────────────────────────────────────────

export const IDEA_QUESTIONS: { group: string; questions: Question[] }[] = [
  {
    group: "Your users",
    questions: [
      {
        id: "i1_talked",
        text: "Have you talked to your target users about this problem?",
        type: "single",
        required: true,
        options: opts(["yes_10", "Yes, 10+"], ["a_few", "A few"], ["not_yet", "Not yet"]),
        aiEnrich: "Name the audience they gave, e.g. \"Have you talked to independent physiotherapists about this?\"",
      },
      {
        id: "i1_needs", placeholder: "e.g. Fewer no-shows, faster booking",
        text: "What did they say they needed most?",
        type: "text",
        required: false,
        showIf: { q: "i1_talked", in: ["yes_10", "a_few"] },
        aiEnrich: "Example needs as placeholder, e.g. \"e.g. fewer no-shows, faster booking\"",
      },
    ],
  },
  {
    group: "Existing options",
    questions: [
      {
        id: "i2_looked",
        text: "Have you looked at existing tools that might already solve this?",
        type: "single",
        required: true,
        options: opts(["none_fit", "Yes, none fit"], ["partly_fit", "Yes, some partly fit"], ["not_yet", "Not yet"]),
        aiEnrich: "Name likely real alternatives, e.g. \"e.g. Jira or Linear\" for a ticketing app",
      },
      {
        id: "i2_missing", placeholder: "e.g. They don't handle recurring appointments",
        text: "What's missing from them?",
        type: "text",
        required: false,
        showIf: { q: "i2_looked", in: ["partly_fit"] },
        aiEnrich: "Placeholder with typical gaps for that category",
      },
    ],
  },
  {
    group: "Getting it adopted",
    questions: [
      {
        id: "i3_who",
        text: "Who will use it?",
        type: "single",
        required: true,
        options: opts(["external", "External customers"], ["internal", "Internal team"], ["both", "Both"]),
        aiEnrich: "Pre-select the likely answer from the product description",
      },
      {
        id: "i3_plan",
        text: "Do you have a go-to-market plan to get it into their hands?",
        type: "single",
        required: true,
        options: opts(["yes", "Yes"], ["rough", "Rough idea"], ["not_yet", "Not yet"]),
        // Assumption #13: "Both" uses the go-to-market wording.
        textVariants: [{ when: { q: "i3_who", in: ["internal"] }, text: "Do you have a rollout / change-management plan to get it into their hands?" }],
        aiEnrich: "Mention a relevant example channel, e.g. \"e.g. app marketplaces, industry associations\"",
      },
    ],
  },
  {
    group: "Integrations and data",
    questions: [
      {
        id: "i4_depends",
        text: "Does it depend on any data source or other system to work?",
        type: "single",
        required: true,
        options: YES_NO_UNSURE,
        aiEnrich: "Suggest likely integrations, e.g. \"e.g. Stripe, Xero, Google Calendar\" for a booking tool",
      },
      { id: "i4_names", placeholder: "e.g. Stripe, Google Calendar", text: "Which ones?", type: "text", required: false, showIf: { q: "i4_depends", in: ["yes"] } },
    ],
  },
  {
    group: "Blockers",
    questions: [
      {
        id: "i5_blockers",
        text: "What's stopped you from getting started so far?",
        type: "multi",
        required: true,
        options: opts(
          ["time", "Time"],
          ["budget", "Budget"],
          ["how_to_build", "Not sure how to build it"],
          ["worth_building", "Not sure it's worth building"],
          ["people", "Finding the right people"],
          ["other", "Other"],
        ),
      },
      { id: "i5_other", placeholder: "e.g. Waiting on funding", text: "What else?", type: "text", required: false, showIf: { q: "i5_blockers", anyOf: ["other"] } },
    ],
  },
  {
    group: "Scope",
    questions: [
      { id: "i6_must", placeholder: "One per line, e.g.\nOnline booking\nEmail reminders", text: "What are the must-have features?", type: "long_text", required: true, aiEnrich: "Placeholder with 2–3 typical core features for that product type" },
      { id: "i6_nice", placeholder: "One per line, e.g.\nMobile app\nReports for clinic owners", text: "What would be nice to have?", type: "long_text", required: false, aiEnrich: "Placeholder with typical \"later\" features" },
    ],
  },
  {
    group: "Build approach",
    questions: [
      {
        id: "i7_build",
        text: "How are you thinking of building it?",
        type: "multi",
        required: true,
        options: opts(
          ["ai_tools", "AI tools myself"],
          ["freelancer", "Hire a freelancer / agency"],
          ["internal_team", "Internal team"],
          ["buy", "Buy / configure an existing tool"],
          ["undecided", "Haven't decided"],
        ),
      },
    ],
  },
];
