"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const velocityData = [
  { week: "W1", completed: 12, planned: 15 },
  { week: "W2", completed: 18, planned: 16 },
  { week: "W3", completed: 14, planned: 16 },
  { week: "W4", completed: 22, planned: 18 },
  { week: "W5", completed: 19, planned: 18 },
  { week: "W6", completed: 24, planned: 20 },
];

const stats = [
  { label: "Avg Velocity", value: "18.2", change: "+12%", positive: true },
  { label: "Sprint Completion", value: "94%", change: "+5%", positive: true },
  { label: "Carryover", value: "2.3", change: "-8%", positive: true },
];

export function VelocityMetrics() {
  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          Velocity & Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-card-foreground">
                  {stat.value}
                </span>
                <span
                  className={`text-xs flex items-center ${stat.positive ? "text-success" : "text-destructive"}`}
                >
                  {stat.positive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {stat.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={velocityData}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="oklch(0.65 0.2 250)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.65 0.2 250)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.13 0 0)",
                  border: "1px solid oklch(0.22 0 0)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "oklch(0.95 0 0)" }}
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="oklch(0.65 0.2 250)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCompleted)"
                name="Completed"
              />
              <Area
                type="monotone"
                dataKey="planned"
                stroke="oklch(0.6 0 0)"
                strokeWidth={1}
                strokeDasharray="4 4"
                fillOpacity={0}
                name="Planned"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
