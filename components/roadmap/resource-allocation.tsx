"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"
import { Progress } from "@/components/ui/progress"

const resources = [
  { name: "Frontend Development", allocated: 3, capacity: 4, hours: 120, color: "bg-chart-1" },
  { name: "Backend Development", allocated: 2, capacity: 3, hours: 80, color: "bg-chart-2" },
  { name: "Design", allocated: 1, capacity: 2, hours: 40, color: "bg-chart-3" },
  { name: "QA & Testing", allocated: 1, capacity: 2, hours: 40, color: "bg-chart-4" },
]

export function ResourceAllocation() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          Resource Allocation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {resources.map((resource) => (
          <div key={resource.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-card-foreground">{resource.name}</span>
              <span className="text-xs text-muted-foreground">
                {resource.allocated}/{resource.capacity} engineers · {resource.hours}h/week
              </span>
            </div>
            <div className="relative">
              <Progress value={(resource.allocated / resource.capacity) * 100} className="h-2" />
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${resource.color}`}
                style={{ width: `${(resource.allocated / resource.capacity) * 100}%` }}
              />
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Allocation</span>
            <span className="font-medium text-card-foreground">7 of 11 engineers (64%)</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-muted-foreground">Weekly Hours</span>
            <span className="font-medium text-card-foreground">280h / 440h capacity</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
