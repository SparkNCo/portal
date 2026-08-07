"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CreditCard, Users } from "lucide-react";
import { DocumentsDirectory } from "@/components/settings/documents-directory";
import {
  BillingSection,
  fetchBillingData,
} from "@/components/settings/billing-section";
import { StaffingSection } from "@/components/settings/staffing-section";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";

const tabs = [
  { id: "staffing", label: "Staffing", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
];

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState("staffing");
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const queryClient = useQueryClient();

  const isAdminViewingCustomer = profile?.role === "admin" && !!customerSlug;

  // When admin is viewing a customer, fetch the customer list to resolve their IDs
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json() as Promise<{ id: string; clientName: string; email: string; customer_id: string; stripe_customer_id: string }[]>;
    },
    enabled: isAdminViewingCustomer,
  });

  const targetCustomer = isAdminViewingCustomer
    ? (customers ?? []).find((c) => c.clientName?.toLowerCase() === customerSlug?.toLowerCase())
    : null;

  // Resolve the IDs to use — customer's when admin is viewing, own profile otherwise
  const effectiveUserId = targetCustomer?.id ?? profile?.id;
  const effectiveStripeId = targetCustomer?.stripe_customer_id ?? profile?.stripe_customer_id;
  const effectiveCustomerId = targetCustomer?.customer_id ?? profile?.customer_id;
  const isAdmin = profile?.role === "admin";

  // SPA-384: billing_mode lives behind its own `stripe-edit` endpoint for now
  // (kept out of `users` so that function stays untouched while it's being
  // tested) — fetched separately rather than from the `customers` list above.
  const { data: billingModeData } = useQuery({
    queryKey: ["billing-mode", effectiveCustomerId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-edit?customer_id=${effectiveCustomerId}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch billing mode");
      return res.json() as Promise<{
        billing_mode: "automatic" | "manual";
        invoice_amount: number | null;
        invoice_interval: "day" | "week" | "month" | "year" | null;
        invoice_interval_count: number | null;
      }>;
    },
    enabled: !!effectiveCustomerId,
  });

  const effectiveBillingMode = billingModeData?.billing_mode ?? "automatic";

  const handleStripeIdSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["billing"] });
  };

  const handleBillingSettingsSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["billing-mode", effectiveCustomerId] });
    queryClient.invalidateQueries({ queryKey: ["billing"] });
  };

  console.log("[SettingsTabs][billing debug]", {
    isAdminViewingCustomer,
    customerSlug,
    customersLoaded: customers?.length ?? null,
    targetCustomer,
    profileStripeId: profile?.stripe_customer_id,
    effectiveStripeId,
    queryEnabled: !!effectiveStripeId,
  });

  const { data: billingData, isLoading } = useQuery({
    queryKey: ["billing", effectiveStripeId],
    queryFn: () => {
      console.log("[SettingsTabs][billing debug] queryFn firing with stripeId:", effectiveStripeId);
      return fetchBillingData({ user: { stripe_customer_id: effectiveStripeId } });
    },
    enabled: !!effectiveStripeId && effectiveBillingMode === "automatic",
    staleTime: 1000 * 30,
  });

  console.log("[SettingsTabs][billing debug] query state", { isLoading, hasData: !!billingData });

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "documents" && <DocumentsDirectory />}
        {activeTab === "billing" && (
          <BillingSection
            billingData={billingData}
            isLoading={isLoading}
            stripeCustomerId={effectiveStripeId}
            customerId={effectiveCustomerId}
            billingMode={effectiveBillingMode}
            invoiceAmount={billingModeData?.invoice_amount ?? null}
            invoiceInterval={billingModeData?.invoice_interval ?? null}
            invoiceIntervalCount={billingModeData?.invoice_interval_count ?? null}
            isAdmin={isAdmin}
            onStripeIdSaved={handleStripeIdSaved}
            onBillingModeSaved={handleBillingSettingsSaved}
            onInvoiceSettingsSaved={handleBillingSettingsSaved}
          />
        )}
        {activeTab === "staffing" && (
          <StaffingSection customerId={effectiveUserId} />
        )}
      </div>
    </div>
  );
}
