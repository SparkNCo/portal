"use client";

import { useParams } from "next/navigation";
import { CustomerSlugProvider } from "context/CustomerSlugContext";
import { safeDecodeURIComponent } from "@/lib/utils";
import { PanelRenderer } from "@/components/dashboard/panel-renderer";

export default function AdminCustomerDashboardPage() {
  // useParams() doesn't reliably hand back a decoded segment here, so
  // `customer` (the customer's clientName) can still be percent-encoded —
  // decode it once so everything downstream (context, fetches, nav links)
  // works off the real, plain clientName.
  const { customer, panel } = useParams<{ customer: string; panel: string }>();
  const decodedCustomer = safeDecodeURIComponent(customer);

  return (
    <CustomerSlugProvider value={decodedCustomer}>
      <PanelRenderer panel={panel} slug={decodedCustomer} />
    </CustomerSlugProvider>
  );
}
