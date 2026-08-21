"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "context/UserContext";
import {
  Activity,
  Clock,
  GitMerge,
  GitBranch,
  Wrench,
  Bug,
  AlertTriangle,
  TrendingUp,
  Percent,
  ShieldCheck,
  ChevronDown,
  type LucideIcon,
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

interface ManualMetricDetail<T> {
  value: T;
  updated_at: string;
  updated_by: string;
}

interface DoraMetric {
  dorametrics_id: string;
  customer_id: string;
  linear_slug: string;
  averages: {
    change_failure_rate: DoraAverage;
    lead_time_for_changes: DoraAverage;
    mean_time_to_restore: DoraAverage;
    deploy_frequency: DoraAverage;
    feature_cycle_time: DoraAverage;
    fix_cycle_time: DoraAverage;
    defect_escape_rate: DoraAverage;
  };
  cfr_details: CfrDetails | null;
  lead_time_details: Record<string, unknown> | null;
  mttr_details: Record<string, unknown> | null;
  deploy_freq_details: DeployFreqDetails | null;
  // Entered by hand by a developer/admin — never computed, never touched by
  // the dora cron, so these can't be overwritten by a scheduled sync.
  code_coverage_details: ManualMetricDetail<number> | null;
  sonar_quality_gate_details: ManualMetricDetail<"pass" | "fail"> | null;
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
  {
    key: "feature_cycle_time" as const,
    label: "Feature Cycle Time",
    icon: GitBranch,
  },
  {
    key: "fix_cycle_time" as const,
    label: "Fix Cycle Time",
    icon: Wrench,
  },
  {
    key: "defect_escape_rate" as const,
    label: "Defect Escape",
    icon: Bug,
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
  feature_cycle_time: { good: 0, mid: 7 * 24, bad: 14 * 24, higherIsBetter: false },
  fix_cycle_time: { good: 0, mid: 3 * 24, bad: 7 * 24, higherIsBetter: false },
  defect_escape_rate: { good: 0, mid: 25, bad: 100, higherIsBetter: false },
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

async function saveManualMetric(linearSlug: string, metric: "code_coverage" | "sonar_quality_gate", value: number | "pass" | "fail") {
  // manual-metrics resolves the caller's role (admin/developer) from their
  // own session token, not a client-supplied identity — the static anon key
  // API_JSON_HEADERS normally sends isn't a real user, so it always 403s.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manual-metrics`, {
    method: "PATCH",
    headers: {
      ...API_JSON_HEADERS,
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: JSON.stringify({ linear_slug: linearSlug, metric, value }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to save ${metric}`);
  }
  return res.json();
}

// Code Coverage — 0-100 entered by hand, higher is better (opposite
// direction from every computed metric on this panel).
const CODE_COVERAGE_THRESHOLDS = { good: 100, mid: 60, bad: 0, higherIsBetter: true };

function CodeCoverageCard({
  linearSlug,
  detail,
  canEdit,
  onSaved,
}: {
  linearSlug: string;
  detail: ManualMetricDetail<number> | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (nextValue: number) => saveManualMetric(linearSlug, "code_coverage", nextValue),
    onSuccess: () => {
      setEditing(false);
      setError(null);
      onSaved();
    },
    onError: (err: any) => setError(err?.message ?? "Failed to save"),
  });

  const pct = detail?.value ?? null;
  const computedStyle =
    pct === null
      ? { color: "hsl(0, 0%, 60%)", bg: "hsla(0, 0%, 60%, 0.08)", border: "hsla(0, 0%, 60%, 0.2)" }
      : (() => {
          const hue = hueForValue(pct, CODE_COVERAGE_THRESHOLDS);
          return {
            color: `hsl(${hue}, 75%, 45%)`,
            bg: `hsla(${hue}, 75%, 45%, 0.1)`,
            border: `hsla(${hue}, 75%, 45%, 0.25)`,
          };
        })();

  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: computedStyle.bg, borderColor: computedStyle.border }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: computedStyle.color }}>
        <Percent className="h-4 w-4 shrink-0" />
        <span className="smalltext font-medium truncate">Code Coverage</span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="w-24">
            <Input
              autoFocus
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0-100"
              className="h-8 bg-background text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={mutation.isPending || value.trim() === ""}
              onClick={() => mutation.mutate(Number(value))}
            >
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="outline" className="text-foreground" onClick={() => { setEditing(false); setError(null); }} disabled={mutation.isPending}>
              Cancel
            </Button>
          </div>
          {error && <p className="smalltext text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xl font-bold text-foreground">
            {pct !== null ? pct.toFixed(1) : "N/A"}
            <span className="smalltext font-normal text-muted-foreground ml-1">%</span>
          </p>
          {canEdit && (
            <button
              type="button"
              className="smalltext text-muted-foreground underline hover:text-foreground"
              onClick={() => { setValue(pct !== null ? String(pct) : ""); setEditing(true); }}
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SonarQualityGateCard({
  linearSlug,
  detail,
  canEdit,
  onSaved,
}: {
  linearSlug: string;
  detail: ManualMetricDetail<"pass" | "fail"> | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (nextValue: "pass" | "fail") => saveManualMetric(linearSlug, "sonar_quality_gate", nextValue),
    onSuccess: () => {
      setEditing(false);
      setError(null);
      onSaved();
    },
    onError: (err: any) => setError(err?.message ?? "Failed to save"),
  });

  const status = detail?.value ?? null;
  const style =
    status === null
      ? { color: "hsl(0, 0%, 60%)", bg: "hsla(0, 0%, 60%, 0.08)", border: "hsla(0, 0%, 60%, 0.2)" }
      : status === "pass"
        ? { color: "hsl(120, 75%, 45%)", bg: "hsla(120, 75%, 45%, 0.1)", border: "hsla(120, 75%, 45%, 0.25)" }
        : { color: "hsl(0, 75%, 45%)", bg: "hsla(0, 75%, 45%, 0.1)", border: "hsla(0, 75%, 45%, 0.25)" };

  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: style.bg, borderColor: style.border }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: style.color }}>
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span className="smalltext font-medium truncate">Sonar Quality Gate</span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={status === "pass" ? "default" : "outline"}
              className={status === "pass" ? undefined : "text-foreground"}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("pass")}
            >
              Pass
            </Button>
            <Button
              size="sm"
              variant={status === "fail" ? "default" : "outline"}
              className={status === "fail" ? undefined : "text-foreground"}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("fail")}
            >
              Fail
            </Button>
          </div>
          <Button size="sm" variant="outline" className="text-foreground" onClick={() => { setEditing(false); setError(null); }} disabled={mutation.isPending}>
            Cancel
          </Button>
          {error && <p className="smalltext text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xl font-bold text-foreground capitalize">
            {status ?? "N/A"}
          </p>
          {canEdit && (
            <button
              type="button"
              className="smalltext text-muted-foreground underline hover:text-foreground"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// One KPI tile — extracted so its own expand/collapse detail panels (CFR vs.
// deploy-frequency, both optional) don't add to SoftwareKPIs's nesting; this
// component owns exactly one card's worth of branching.
function KpiCard({
  label,
  Icon,
  value,
  unit,
  style,
  cfr,
  deployFreq,
  isExpanded,
  onToggleExpanded,
}: {
  label: string;
  Icon: LucideIcon;
  value: number | null;
  unit: string;
  style: { color: string; bg: string; border: string };
  cfr: CfrDetails | null;
  deployFreq: DoraAverage | null;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const hasExtra = !!(cfr || deployFreq);

  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: style.bg, borderColor: style.border }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0" style={{ color: style.color }}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="smalltext font-medium truncate" title={label}>{label}</span>
        </div>
        {hasExtra && (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
            aria-expanded={isExpanded}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">
        {value !== null ? value.toFixed(1) : "N/A"}
        <span className="smalltext font-normal text-muted-foreground ml-1">{unit}</span>
      </p>
      {isExpanded && cfr && (
        <div className="mt-2 space-y-0.5 border-t border-current/10 pt-2">
          <p className="smalltext text-muted-foreground">
            Failed:{" "}
            <span className="text-foreground font-medium">{cfr.failed_deployments}</span>
            {" / "}
            Total:{" "}
            <span className="text-foreground font-medium">{cfr.total_non_fix_deployments}</span>
          </p>
          <p className="smalltext text-muted-foreground truncate" title={cfr.repo}>
            {cfr.repo}
          </p>
        </div>
      )}
      {isExpanded && deployFreq && (
        <div className="mt-2 space-y-0.5 border-t border-current/10 pt-2">
          <p className="smalltext text-muted-foreground">
            Last 30d:{" "}
            <span className="text-foreground font-medium">
              {deployFreq.last_30_days ?? "N/A"} deployments
            </span>
          </p>
          <p className="smalltext text-muted-foreground">
            Last 90d:{" "}
            <span className="text-foreground font-medium">
              {deployFreq.last_90_days ?? "N/A"} deployments
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

export function SoftwareKPIs({ linearName }: { readonly linearName: string }) {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dora-metrics", linearName],
    queryFn: () => fetchDoraMetrics(linearName),
    enabled: Boolean(linearName),
  });

  // Only Change Failure Rate and Deploy Frequency carry extra detail rows —
  // collapsed by default so every tile in a row starts at the same compact
  // height, and expandable per-tile (not all-or-nothing) so a tile with
  // more data doesn't force its shorter row-mates to stretch and look empty.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const latest = data?.[0];
  const isAdmin = profile?.role === "admin";
  const canEditManualMetrics = isAdmin || profile?.role === "developer";
  // Manual metrics start out unset (N/A) until someone fills them in — only
  // admins need to see that empty placeholder as a reminder to set it.
  // Everyone else just sees the tile once it actually has a value.
  const showCodeCoverage = isAdmin || latest?.code_coverage_details?.value != null;
  const showSonarQualityGate = isAdmin || latest?.sonar_quality_gate_details?.value != null;
  const handleManualMetricSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["dora-metrics", linearName] });
  };

  return (
    <Card className="bg-background border-border flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          SDLC Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <p className="smalltext text-muted-foreground">Loading metrics...</p>
        )}
        {isError && (
          <p className="smalltext text-destructive">Failed to load metrics.</p>
        )}
        {!isLoading && !isError && latest == null && (
          <p className="smalltext text-muted-foreground">No metrics available.</p>
        )}
        {latest && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {KPI_CONFIG.map(({ key, label, icon: Icon }) => {
              const metric = latest.averages[key];
              const style = thresholdStyle(key, colorValueFor(key, metric));
              return (
                <KpiCard
                  key={key}
                  label={label}
                  Icon={Icon}
                  value={metric?.value ?? null}
                  unit={metric?.unit ?? ""}
                  style={style}
                  cfr={key === "change_failure_rate" ? latest.cfr_details : null}
                  deployFreq={key === "deploy_frequency" ? metric ?? null : null}
                  isExpanded={expandedKeys.has(key)}
                  onToggleExpanded={() => toggleExpanded(key)}
                />
              );
            })}
            {showCodeCoverage && (
              <CodeCoverageCard
                linearSlug={latest.linear_slug}
                detail={latest.code_coverage_details}
                canEdit={canEditManualMetrics}
                onSaved={handleManualMetricSaved}
              />
            )}
            {showSonarQualityGate && (
              <SonarQualityGateCard
                linearSlug={latest.linear_slug}
                detail={latest.sonar_quality_gate_details}
                canEdit={canEditManualMetrics}
                onSaved={handleManualMetricSaved}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
