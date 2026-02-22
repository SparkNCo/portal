"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Bug, TrendingUp, AlertTriangle, Clock, CheckCircle2, Server, MessageSquare } from "lucide-react"

const kpis = [
  {
    label: "Code Coverage",
    value: "87%",
    change: "+5%",
    icon: Activity,
    status: "good",
  },
  {
    label: "Defect Rate",
    value: "2.3%",
    change: "-0.4%",
    icon: Bug,
    status: "good",
  },
  {
    label: "Backlog Length",
    value: "47",
    change: "-8",
    icon: TrendingUp,
    status: "good",
  },
  {
    label: "Escaped Defects per Sprint",
    value: "1.2",
    change: "-0.3",
    icon: AlertTriangle,
    status: "excellent",
  },
  {
    label: "Sprint Completion %",
    value: "92%",
    change: "+7%",
    icon: CheckCircle2,
    status: "excellent",
  },
  {
    label: "Uptime",
    value: "99.8%",
    change: "+0.1%",
    icon: Server,
    status: "excellent",
  },
  {
    label: "MTTR",
    value: "2.4h",
    change: "-0.6h",
    icon: Clock,
    status: "good",
  },
  {
    label: "Time to Response",
    value: "8m",
    change: "-2m",
    icon: MessageSquare,
    status: "excellent",
  },
  {
    label: "Time to Resolution",
    value: "4.2h",
    change: "-1.1h",
    icon: Clock,
    status: "good",
  },
]

const statusColors = {
  excellent: "bg-success/20 text-success border-success/30",
  good: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  "needs-attention": "bg-warning/20 text-warning border-warning/30",
}

export function SoftwareKPIs() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          Software KPIs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className={`rounded-lg border p-4 ${statusColors[kpi.status as keyof typeof statusColors]}`}
            >
              <div className="flex items-center justify-between mb-2">
                <kpi.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{kpi.change}</span>
              </div>
              <p className="text-2xl font-bold text-card-foreground mb-1">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
