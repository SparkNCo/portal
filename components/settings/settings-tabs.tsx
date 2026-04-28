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

const tabs = [
  { id: "staffing", label: "Staffing", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
];

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState("staffing");
  const { profile } = useUser();

  const {
    data: billingData,
    isLoading,
  } = useQuery({
    queryKey: ["billing", profile?.customer_id],
    queryFn: () => fetchBillingData({ user: profile }),
    enabled: !!profile?.customer_id,
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
        {activeTab === "staffing" && <StaffingSection />}
      </div>
    </div>
  );
}
