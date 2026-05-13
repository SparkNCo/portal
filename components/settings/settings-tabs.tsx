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
import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";

const tabs = [
  { id: "staffing", label: "Staffing", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
];

const apiHeaders = {
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
  apikey: process.env.NEXT_PUBLIC_APIKEY!,
  "Content-Type": "application/json",
};

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState("staffing");
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();

  const isAdminViewingCustomer = profile?.role === "admin" && !!customerSlug;

  // When admin is viewing a customer, fetch the customer list to resolve their IDs
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/users?type=customers`,
        { headers: apiHeaders },
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json() as Promise<{ id: string; clientName: string; email: string; customer_id: string }[]>;
    },
    enabled: isAdminViewingCustomer,
  });

  const targetCustomer = isAdminViewingCustomer
    ? (customers ?? []).find((c) => c.clientName === customerSlug)
    : null;

  // Resolve the IDs to use — customer's when admin is viewing, own profile otherwise
  const effectiveUserId = targetCustomer?.id ?? profile?.id;
  const effectiveCustomerId = targetCustomer?.customer_id ?? profile?.customer_id;

  const { data: billingData, isLoading } = useQuery({
    queryKey: ["billing", effectiveCustomerId],
    queryFn: () => fetchBillingData({ user: { customer_id: effectiveCustomerId } }),
    enabled: !!effectiveCustomerId,
    staleTime: 1000 * 30,
  });

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
          <BillingSection billingData={billingData} isLoading={isLoading} />
        )}
        {activeTab === "staffing" && (
          <StaffingSection customerId={effectiveUserId} />
        )}
      </div>
    </div>
  );
}
