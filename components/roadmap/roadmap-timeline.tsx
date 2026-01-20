"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Map, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

const epics = [
  {
    id: "epic-1",
    name: "Authentication & User Management",
    status: "completed",
    startWeek: 0,
    duration: 3,
    progress: 100,
  },
  {
    id: "epic-2",
    name: "Dashboard & Analytics",
    status: "in-progress",
    startWeek: 2,
    duration: 4,
    progress: 65,
  },
  {
    id: "epic-3",
    name: "API Integration Layer",
    status: "in-progress",
    startWeek: 4,
    duration: 3,
    progress: 40,
  },
  {
    id: "epic-4",
    name: "Payment Processing",
    status: "planned",
    startWeek: 6,
    duration: 3,
    progress: 0,
  },
  {
    id: "epic-5",
    name: "Reporting & Export",
    status: "planned",
    startWeek: 8,
    duration: 2,
    progress: 0,
  },
]

const weeks = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8", "Week 9", "Week 10"]

const statusColors = {
  completed: "bg-success/20 border-success/40 text-success",
  "in-progress": "bg-chart-1/20 border-chart-1/40 text-chart-1",
  planned: "bg-muted border-border text-muted-foreground",
}

const barColors = {
  completed: "bg-success",
  "in-progress": "bg-chart-1",
  planned: "bg-muted-foreground/30",
}

export function RoadmapTimeline() {
  const [currentWeek] = useState(4)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Map className="h-4 w-4 text-accent" />
          Project Timeline
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-1 bg-transparent">
            <Calendar className="h-3 w-3" />
            Q1 2025
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Week headers */}
            <div className="flex border-b border-border pb-2 mb-4">
              <div className="w-56 shrink-0" />
              <div className="flex-1 grid grid-cols-10 gap-1">
                {weeks.map((week, i) => (
                  <div
                    key={week}
                    className={cn(
                      "text-xs text-center py-1 rounded",
                      i === currentWeek ? "bg-accent/20 text-accent font-medium" : "text-muted-foreground",
                    )}
                  >
                    {week}
                  </div>
                ))}
              </div>
            </div>

            {/* Current week indicator line */}
            <div className="relative">
              <div
                className="absolute top-0 bottom-0 w-px bg-accent z-10"
                style={{ left: `calc(14rem + ${(currentWeek / 10) * 100}% + ${currentWeek * 0.4}rem)` }}
              />

              {/* Epics */}
              <div className="space-y-3">
                {epics.map((epic) => (
                  <div key={epic.id} className="flex items-center gap-4">
                    <div className="w-52 shrink-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusColors[epic.status as keyof typeof statusColors]}>
                          {epic.status.replace("-", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-card-foreground mt-1 truncate">{epic.name}</p>
                    </div>
                    <div className="flex-1 grid grid-cols-10 gap-1 items-center">
                      {weeks.map((_, i) => {
                        const isInRange = i >= epic.startWeek && i < epic.startWeek + epic.duration
                        const isStart = i === epic.startWeek
                        const isEnd = i === epic.startWeek + epic.duration - 1

                        return (
                          <div key={i} className="h-8 relative">
                            {isInRange && (
                              <div
                                className={cn(
                                  "absolute inset-y-1 inset-x-0",
                                  barColors[epic.status as keyof typeof barColors],
                                  isStart && "rounded-l-md",
                                  isEnd && "rounded-r-md",
                                )}
                              >
                                {epic.status === "in-progress" && (
                                  <div
                                    className="absolute inset-y-0 left-0 bg-chart-1 opacity-50 rounded-l-md"
                                    style={{ width: `${epic.progress}%` }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="w-12 text-right">
                      <span className="text-xs text-muted-foreground">{epic.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-success" />
            <span className="text-xs text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-chart-1" />
            <span className="text-xs text-muted-foreground">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">Planned</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
