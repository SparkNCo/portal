"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react"

const metrics = [
  {
    label: "Overall Progress",
    value: 68,
    icon: TrendingUp,
    trend: "+12% this month",
    color: "text-chart-1",
  },
  {
    label: "Completed Tasks",
    value: 24,
    total: 36,
    icon: CheckCircle2,
    trend: "6 completed this week",
    color: "text-success",
  },
  {
    label: "In Progress",
    value: 8,
    icon: Clock,
    trend: "3 due this week",
    color: "text-warning",
  },
  {
    label: "Blockers",
    value: 2,
    icon: AlertCircle,
    trend: "Needs attention",
    color: "text-destructive",
  },
]

export function ProgressMetrics() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
            <metric.icon className={`h-4 w-4 ${metric.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">
              {metric.value}
              {metric.total && <span className="text-sm font-normal text-muted-foreground">/{metric.total}</span>}
            </div>
            {metric.label === "Overall Progress" && <Progress value={metric.value} className="mt-2 h-1" />}
            <p className="text-xs text-muted-foreground mt-1">{metric.trend}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
