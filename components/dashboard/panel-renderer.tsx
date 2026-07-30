"use client";

import ClientDashboard from "@/app/[slug]/(portal)/dashboard/page";
import RoadmapPage from "@/app/[slug]/(portal)/monitor/page";
import BuildPage from "@/app/[slug]/(portal)/build/page";
import BugsPage from "@/app/[slug]/(portal)/bugs/page";
import DeveloperPage from "@/app/[slug]/(portal)/developer/page";
import DocumentsPage from "@/app/[slug]/(portal)/documents/page";
import SettingsPage from "@/app/[slug]/(portal)/settings/page";
import ChatPage from "@/app/[slug]/(portal)/chat/page";

// Shared between the `/{slug}/dashboards/[customer]/[panel]` route (developer
// viewing an assigned customer) and `/admin/dashboards/[customer]/[panel]`
// (admin viewing any customer) — both scope the viewed customer via
// CustomerSlugContext, so the underlying panel pages don't need their own
// `[slug]` ancestor to resolve who they're showing data for.
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
