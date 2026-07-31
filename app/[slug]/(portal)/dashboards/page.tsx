"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { LoadingDataPanel } from "@/components/loader";
import { DashboardsContent } from "@/components/dashboard/dashboards-content";
import { safeDecodeURIComponent } from "@/lib/utils";

function DashboardsPageContent() {
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  return <DashboardsContent basePath={`/${urlSlug}/dashboards`} />;
}

export default function DashboardsPage() {
  return (
    <Suspense fallback={<LoadingDataPanel />}>
      <DashboardsPageContent />
    </Suspense>
  );
}
