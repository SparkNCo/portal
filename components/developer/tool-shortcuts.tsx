"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, KeyRound, BarChart3, Github } from "lucide-react"

const tools = [
  { name: "JumpCloud", icon: KeyRound, href: "#" },
  { name: "PostHog", icon: BarChart3, href: "#" },
  { name: "GitHub", icon: Github, href: "#" },
]

export function ToolShortcuts() {
  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
          <Zap className="h-4 w-4 text-primary" />
          Tool Shortcuts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {tools.map((tool) => (
            <a
              key={tool.name}
              href={tool.href}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card/90 p-4 transition-colors group"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted transition-all group-hover:scale-105">
                <tool.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="smalltext font-medium text-card-foreground">
                {tool.name}
              </span>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
