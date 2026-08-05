"use client";

import { useQuery } from "@tanstack/react-query";
import { API_HEADERS } from "@/lib/api-headers";
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
  last_30_days?: number;
  last_90_days?: number;
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
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-dora-metrics?linear_name=${encodeURIComponent(linearName)}`,
    {
      headers: API_HEADERS,
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
  },
  {
    key: "lead_time_for_changes" as const,
    label: "Lead Time",
    icon: Clock,
  },
  {
    key: "mean_time_to_restore" as const,
    label: "MTTR",
    icon: Activity,
  },
  {
    key: "change_failure_rate" as const,
    label: "Change Failure Rate",
    icon: AlertTriangle,
  },
];

// Good/mid/bad reference points per metric, taken from the thresholds product
// gave us. `higherIsBetter` flips which side of the scale counts as "good" —
// deploy frequency wants a bigger number, everything else wants a smaller one.
// Deploy frequency's thresholds are a daily rate ("> 1/day", "1/month",
// "< 1/quarter"), but the only rate we have is deployments in the last 30
// days, so that's converted to a per-day rate for comparison — the displayed
// number itself is still the raw lifetime total, unchanged.
const KPI_THRESHOLDS: Record<
  (typeof KPI_CONFIG)[number]["key"],
  { good: number; mid: number; bad: number; higherIsBetter: boolean }
> = {
  deploy_frequency: { good: 1, mid: 1 / 30, bad: 1 / 90, higherIsBetter: true },
  lead_time_for_changes: { good: 0, mid: 14 * 24, bad: 30 * 24, higherIsBetter: false },
  mean_time_to_restore: { good: 0, mid: 8, bad: 24, higherIsBetter: false },
  change_failure_rate: { good: 0, mid: 25, bad: 50, higherIsBetter: false },
};

// Maps a value onto a 0 (red) – 60 (yellow) – 120 (green) hue, linearly
// interpolated between the good/mid/bad reference points so values between
// them render as in-between shades rather than snapping straight to a color.
function hueForValue(
  value: number,
  { good, mid, bad, higherIsBetter }: (typeof KPI_THRESHOLDS)[keyof typeof KPI_THRESHOLDS],
): number {
  const betterSide = higherIsBetter
    ? (v: number) => v >= good
    : (v: number) => v <= good;
  const worseSide = higherIsBetter ? (v: number) => v <= bad : (v: number) => v >= bad;

  if (betterSide(value)) return 120;
  if (worseSide(value)) return 0;

  const inGoodHalf = higherIsBetter ? value >= mid : value <= mid;
  if (inGoodHalf) {
    const t = (value - mid) / (good - mid);
    return 60 + t * 60;
  }
  const t = (value - mid) / (bad - mid);
  return 60 - t * 60;
}

// Returns the CSS to apply for a metric's current value, or a neutral gray
// when there's no value (or no thresholds defined) to judge yet.
function thresholdStyle(key: (typeof KPI_CONFIG)[number]["key"], value: number | null) {
  const thresholds = KPI_THRESHOLDS[key];
  if (value === null || !thresholds) {
    return { color: "hsl(0, 0%, 60%)", bg: "hsla(0, 0%, 60%, 0.08)", border: "hsla(0, 0%, 60%, 0.2)" };
  }

  const hue = hueForValue(value, thresholds);
  return {
    color: `hsl(${hue}, 75%, 45%)`,
    bg: `hsla(${hue}, 75%, 45%, 0.1)`,
    border: `hsla(${hue}, 75%, 45%, 0.25)`,
  };
}

// Deploy frequency's own thresholds are a daily rate, but the stored
// "value" is a lifetime total — the last-30-days count is the closest thing
// to a current rate, so that's what drives its color (the displayed number
// stays the lifetime total).
function colorValueFor(
  key: (typeof KPI_CONFIG)[number]["key"],
  metric: DoraAverage | undefined,
): number | null {
  if (key === "deploy_frequency") {
    return metric?.last_30_days != null ? metric.last_30_days / 30 : null;
  }
  return metric?.value ?? null;
}

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
          SDLC Metrics
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {KPI_CONFIG.map(({ key, label, icon: Icon }) => {
              const metric = latest.averages[key];
              const value = metric?.value ?? null;
              const style = thresholdStyle(key, colorValueFor(key, metric));
              const cfr =
                key === "change_failure_rate" ? latest.cfr_details : null;
              const deployFreq =
                key === "deploy_frequency" ? metric : null;
              return (
                <div
                  key={key}
                  className="rounded-lg border p-4"
                  style={{ backgroundColor: style.bg, borderColor: style.border }}
                >
                  <div className="flex items-center gap-2 mb-2" style={{ color: style.color }}>
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
                  {deployFreq && (
                    <div className="mt-2 space-y-0.5 border-t border-current/10 pt-2">
                      <p className="text-xs text-muted-foreground">
                        Last 30d:{" "}
                        <span className="text-card-foreground font-medium">
                          {deployFreq.last_30_days ?? "N/A"} deployments
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last 90d:{" "}
                        <span className="text-card-foreground font-medium">
                          {deployFreq.last_90_days ?? "N/A"} deployments
                        </span>
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
