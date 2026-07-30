"use client";

import { Suspense } from "react";
import { LoadingDataPanel } from "@/components/loader";
import { DashboardsContent } from "@/components/dashboard/dashboards-content";

export default function AdminDashboardsPage() {
  return (
    <Suspense fallback={<LoadingDataPanel />}>
      <DashboardsContent basePath="/admin/dashboards" />
    </Suspense>
  );
}
