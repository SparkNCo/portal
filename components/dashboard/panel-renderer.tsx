"use client";

import ClientDashboard from "@/app/[slug]/(portal)/dashboard/page";
import RoadmapPage from "@/app/[slug]/(portal)/monitor/page";
import BuildPage from "@/app/[slug]/(portal)/build/page";
import BugsPage from "@/app/[slug]/(portal)/bugs/page";
import DeveloperPage from "@/app/[slug]/(portal)/developer/page";
import DocumentsPage from "@/app/[slug]/(portal)/documents/page";
import SettingsPage from "@/app/[slug]/(portal)/settings/page";
import ChatPage from "@/app/[slug]/(portal)/chat/page";

// Used by the (dormant) `/{devSlug}/dashboards/[customer]/[panel]` route —
// a developer viewing one of their assigned customers. Admins no longer go
// through a nested panel route at all; they browse a customer's own
// `/{clientName}/...` pages directly (see components/sidebar.tsx).
export function PanelRenderer({
  panel,
  slug,
}: {
  readonly panel: string;
  readonly slug: string;
}) {
  switch (panel) {
    case "monitor":
      return <RoadmapPage />;
    case "build":
      return <BuildPage />;
    case "bugs":
      return <BugsPage />;
    case "developer":
      return <DeveloperPage />;
    case "documents":
      return <DocumentsPage />;
    case "settings":
      return <SettingsPage />;
    case "chat":
      return <ChatPage />;
    default:
      return <ClientDashboard />;
  }
}
