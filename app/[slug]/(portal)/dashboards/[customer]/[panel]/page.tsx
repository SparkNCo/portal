"use client";

import { useParams } from "next/navigation";
import { CustomerSlugProvider } from "context/CustomerSlugContext";
import { PanelRenderer } from "../../page";

export default function CustomerDashboardPage() {
  // Next.js decodes dynamic segment values automatically, so `customer`
  // (the customer's clientName) arrives as-is regardless of how it was
  // encoded in the link that navigated here.
  const { customer, panel } = useParams<{ customer: string; panel: string }>();

  return (
    <CustomerSlugProvider value={customer}>
      <PanelRenderer panel={panel} slug={customer} />
    </CustomerSlugProvider>
  );
}
