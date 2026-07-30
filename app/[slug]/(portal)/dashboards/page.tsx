"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { LoadingDataPanel } from "@/components/loader";
import { DashboardsContent } from "@/components/dashboard/dashboards-content";

function DashboardsPageContent() {
  const { slug: urlSlug } = useParams<{ slug: string }>();
  return <DashboardsContent basePath={`/${urlSlug}/dashboards`} />;
}

export default function DashboardsPage() {
  return (
    <Suspense fallback={<LoadingDataPanel />}>
      <DashboardsPageContent />
    </Suspense>
  );
}
