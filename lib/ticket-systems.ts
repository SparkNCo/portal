// Which ticket system a customer's work lives in, picked in Add/Edit
// Customer. Stored on `customers.systems.tickets` (missing = Linear); Jira's
// URL and account email on `customers.systems.jira`, its API token in Vault.
// The customer's id in that system (Linear slug / Jira project key) stays in
// `customers.linear_slug`. See supabase/functions/lib/tickets/ticketSystem.ts.

export type TicketSystem = "linear" | "jira";

type TicketSystemInfo = {
  value: TicketSystem;
  label: string;
  idLabel: string;
  idPlaceholder: string;
  idHelp: string;
};

const LINEAR: TicketSystemInfo = {
  value: "linear",
  label: "Linear",
  idLabel: "Linear Slug",
  idPlaceholder: "e.g. acme",
  idHelp: "The initiative's slug in Spark & Co's Linear workspace.",
};

const JIRA: TicketSystemInfo = {
  value: "jira",
  label: "Jira",
  idLabel: "Jira project key",
  idPlaceholder: "e.g. ACME",
  idHelp: "The letters before the ticket numbers — ACME for ACME-12.",
};

export const TICKET_SYSTEMS: TicketSystemInfo[] = [LINEAR, JIRA];

export function ticketSystemInfo(system: TicketSystem): TicketSystemInfo {
  return system === "jira" ? JIRA : LINEAR;
}

export type CustomerSystems = {
  chat?: string;
  vector?: string;
  tickets?: string;
  jira?: { base_url?: string; email?: string };
} | null;

export function ticketSystemOf(systems: CustomerSystems | undefined): TicketSystem {
  return systems?.tickets === "jira" ? "jira" : "linear";
}

// What the Add/Edit Customer forms hold for the ticket system. `apiToken`
// blank when editing keeps the stored one.
export type TicketSettings = {
  system: TicketSystem;
  projectId: string;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
};

export function ticketSettingsFrom(systems: CustomerSystems | undefined, projectId?: string | null): TicketSettings {
  return {
    system: ticketSystemOf(systems),
    projectId: projectId ?? "",
    jiraBaseUrl: systems?.jira?.base_url ?? "",
    jiraEmail: systems?.jira?.email ?? "",
    jiraApiToken: "",
  };
}

// Everything the form needs before it can save. `hasStoredToken`: editing a
// customer already on Jira, whose token can be kept.
export function ticketSettingsComplete(settings: TicketSettings, hasStoredToken = false): boolean {
  if (!settings.projectId.trim()) return false;
  if (settings.system === "linear") return true;
  return !!settings.jiraBaseUrl.trim() && !!settings.jiraEmail.trim() && (hasStoredToken || !!settings.jiraApiToken.trim());
}

// The body fields the `users` function reads (ticket_system, linear_slug, jira).
export function ticketSettingsBody(settings: TicketSettings) {
  return {
    ticket_system: settings.system,
    linear_slug: settings.projectId.trim(),
    ...(settings.system === "jira" && {
      jira: {
        base_url: settings.jiraBaseUrl.trim(),
        email: settings.jiraEmail.trim(),
        ...(settings.jiraApiToken.trim() && { api_token: settings.jiraApiToken.trim() }),
      },
    }),
  };
}
