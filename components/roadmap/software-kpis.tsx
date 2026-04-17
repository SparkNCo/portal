"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Clock,
  GitMerge,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

interface DoraAverage {
  value: number | null;
  unit: string;
}

interface CfrDetails {
  change_failure_rate: number;
  failed_deployments: number;
  total_non_fix_deployments: number;
  repo: string;
  unit: string;
}

interface DeployFreqDetails {
  total_deployments: number;
  deployments_last_30_days: number;
  deployments_last_90_days: number;
  repo: string;
}

interface DoraMetric {
  dorametrics_id: string;
  customer_id: string;
  averages: {
    change_failure_rate: DoraAverage;
    lead_time_for_changes: DoraAverage;
    mean_time_to_restore: DoraAverage;
    deploy_frequency: DoraAverage;
  };
  cfr_details: CfrDetails | null;
  lead_time_details: Record<string, unknown> | null;
  mttr_details: Record<string, unknown> | null;
  deploy_freq_details: DeployFreqDetails | null;
  created_at: string;
}

async function fetchDoraMetrics(linearName: string): Promise<DoraMetric[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/get-dora-metrics?linear_name=${encodeURIComponent(linearName)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
        apikey: process.env.NEXT_PUBLIC_APIKEY!,
      },
    },
  );
  if (!res.ok) throw new Error("Failed to fetch DORA metrics");
  return res.json();
}

const KPI_CONFIG = [
  {
    key: "deploy_frequency" as const,
    label: "Deploy Frequency",
    icon: GitMerge,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
  },
  {
    key: "lead_time_for_changes" as const,
    label: "Lead Time",
    icon: Clock,
    color: "text-green-400",
    bg: "bg-green-400/10 border-green-400/20",
  },
  {
    key: "mean_time_to_restore" as const,
    label: "MTTR",
    icon: Activity,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/20",
  },
  {
    key: "change_failure_rate" as const,
    label: "Change Failure Rate",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
  },
];

export function SoftwareKPIs({ linearName }: { readonly linearName: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dora-metrics", linearName],
    queryFn: () => fetchDoraMetrics(linearName),
    enabled: Boolean(linearName),
  });

  const latest = data?.[0];

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          DORA Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading metrics...</p>
        )}
        {isError && (
          <p className="text-sm text-destructive">Failed to load metrics.</p>
        )}
        {!isLoading && !isError && latest == null && (
          <p className="text-sm text-muted-foreground">No metrics available.</p>
        )}
        {latest && (
          <div className="grid grid-cols-2 gap-4">
            {KPI_CONFIG.map(({ key, label, icon: Icon, color, bg }) => {
              const metric = latest.averages[key];
              const value = metric?.value ?? null;
              const cfr =
                key === "change_failure_rate" ? latest.cfr_details : null;
              const deployFreq =
                key === "deploy_frequency" ? latest.deploy_freq_details : null;
              return (
                <div key={key} className={`rounded-lg border p-4 ${bg}`}>
                  <div className={`flex items-center gap-2 mb-2 ${color}`}>
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                  <p className="text-2xl font-bold text-card-foreground">
                    {value !== null ? value.toFixed(1) : "N/A"}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {metric?.unit ?? ""}
                    </span>
                  </p>
                  {cfr && (
                    <div className="mt-2 space-y-0.5 border-t border-current/10 pt-2">
                      <p className="text-xs text-muted-foreground">
                        Failed:{" "}
                        <span className="text-card-foreground font-medium">
                          {cfr.failed_deployments}
                        </span>
                        {" / "}
                        Total:{" "}
                        <span className="text-card-foreground font-medium">
                          {cfr.total_non_fix_deployments}
                        </span>
                      </p>
                      <p
                        className="text-xs text-muted-foreground truncate"
                        title={cfr.repo}
                      >
                        {cfr.repo}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
