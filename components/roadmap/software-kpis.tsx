"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, TrendingUp } from "lucide-react"

interface Metric {
  id: string
  customer_id: string
  metric_id: string
  source: string
  value: string
  period_start: string
  period_end: string
  benchmark: { target: number; unit: string }[]
  date_collected: { date: string }[]
}

async function fetchMetrics(): Promise<Metric[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/metrics`)
  if (!res.ok) throw new Error("Failed to fetch metrics")
  const json = await res.json()
  return json.data
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "N/A"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "N/A"
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function SoftwareKPIs() {
  const { data: metrics, isLoading, isError } = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
  })

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          Software KPIs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading metrics...</p>
        )}
        {isError && (
          <p className="text-sm text-destructive">Failed to load metrics.</p>
        )}
        {metrics?.length === 0 && (
          <p className="text-sm text-muted-foreground">No metrics available.</p>
        )}
        {metrics && metrics.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <div
                key={metric.id ?? metric.metric_id}
                className="rounded-lg border p-4 bg-chart-1/20 text-chart-1 border-chart-1/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-card-foreground mb-1">
                  {metric.value ?? "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  {metric.source ?? "N/A"}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {formatDate(metric.period_start)} – {formatDate(metric.period_end)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
