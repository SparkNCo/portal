"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, KeyRound, BarChart3, Github } from "lucide-react"

const tools = [
  { name: "JumpCloud", icon: KeyRound, color: "bg-chart-1/20 text-chart-1", href: "#" },
  { name: "PostHog", icon: BarChart3, color: "bg-chart-2/20 text-chart-2", href: "#" },
  { name: "GitHub", icon: Github, color: "bg-foreground/20 text-foreground", href: "#" },
]

export function ToolShortcuts() {
  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          Tool Shortcuts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {tools.map((tool) => (
            <a
              key={tool.name}
              href={tool.href}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors group"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tool.color}`}>
                <tool.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-card-foreground transition-colors">
                {tool.name}
              </span>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
