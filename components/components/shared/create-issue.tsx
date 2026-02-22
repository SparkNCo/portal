"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bug, Lightbulb, FileText, Sparkles, Send } from "lucide-react"

const issueTypes = {
  bug: { icon: Bug, label: "Bug", color: "bg-destructive/20 text-destructive" },
  feature: { icon: Lightbulb, label: "Feature", color: "bg-chart-2/20 text-chart-2" },
  report: { icon: FileText, label: "Report", color: "bg-chart-1/20 text-chart-1" },
}

const similarTickets = [
  { id: "LIN-201", title: "Login page not loading on Safari", type: "bug" },
  { id: "LIN-189", title: "Authentication timeout issues", type: "bug" },
  { id: "LIN-167", title: "Session expires too quickly", type: "bug" },
]

export function CreateIssue() {
  const [description, setDescription] = useState("")
  const [detectedType, setDetectedType] = useState<keyof typeof issueTypes | null>(null)
  const [showSimilar, setShowSimilar] = useState(false)
  const [showFields, setShowFields] = useState(false)
  const [priority, setPriority] = useState("")
  const [assignee, setAssignee] = useState("")

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    const lowerValue = value.toLowerCase()

    // Auto-detect issue type
    if (
      lowerValue.includes("bug") ||
      lowerValue.includes("error") ||
      lowerValue.includes("broken") ||
      lowerValue.includes("not working") ||
      lowerValue.includes("issue") ||
      lowerValue.includes("problem")
    ) {
      setDetectedType("bug")
      setShowSimilar(true)
    } else if (
      lowerValue.includes("feature") ||
      lowerValue.includes("add") ||
      lowerValue.includes("new") ||
      lowerValue.includes("implement")
    ) {
      setDetectedType("feature")
      setShowSimilar(false)
    } else if (lowerValue.includes("report") || lowerValue.includes("analytics") || lowerValue.includes("data")) {
      setDetectedType("report")
      setShowSimilar(false)
    } else {
      setDetectedType(null)
      setShowSimilar(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && description.trim()) {
      e.preventDefault()
      setShowFields(true)
    }
  }

  const TypeIcon = detectedType ? issueTypes[detectedType].icon : Sparkles

  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-3">
          <div className="relative">
            <Textarea
              placeholder="Describe your issue or request... (Press Enter to add details)"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-secondary border-0 min-h-[120px] resize-none text-base pr-20"
            />
            {detectedType && (
              <div className="absolute right-3 top-3 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-accent" />
                <Badge className={issueTypes[detectedType].color}>
                  <TypeIcon className="h-3 w-3 mr-1" />
                  {issueTypes[detectedType].label}
                </Badge>
              </div>
            )}
          </div>

          {showSimilar && similarTickets.length > 0 && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 animate-in fade-in-50 slide-in-from-top-2">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Similar tickets found
              </p>
              <div className="space-y-2">
                {similarTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center gap-2 text-sm p-2 rounded bg-background/50 hover:bg-background transition-colors cursor-pointer"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
                    <span className="text-card-foreground truncate flex-1">{ticket.title}</span>
                    <Bug className="h-3 w-3 text-destructive" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {showFields && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-top-2 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-sm text-muted-foreground">
                    Priority
                  </Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger id="priority" className="bg-secondary border-0">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {detectedType === "bug" && (
                  <div className="space-y-2">
                    <Label htmlFor="severity" className="text-sm text-muted-foreground">
                      Severity
                    </Label>
                    <Select>
                      <SelectTrigger id="severity" className="bg-secondary border-0">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {detectedType === "feature" && (
                  <div className="space-y-2">
                    <Label htmlFor="effort" className="text-sm text-muted-foreground">
                      Estimated Effort
                    </Label>
                    <Select>
                      <SelectTrigger id="effort" className="bg-secondary border-0">
                        <SelectValue placeholder="Select effort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small (1-2 days)</SelectItem>
                        <SelectItem value="medium">Medium (3-5 days)</SelectItem>
                        <SelectItem value="large">Large (1-2 weeks)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {detectedType === "report" && (
                  <div className="space-y-2">
                    <Label htmlFor="frequency" className="text-sm text-muted-foreground">
                      Report Frequency
                    </Label>
                    <Select>
                      <SelectTrigger id="frequency" className="bg-secondary border-0">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">One-time</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignee" className="text-sm text-muted-foreground">
                  Assign to
                </Label>
                <Input
                  id="assignee"
                  placeholder="Search team members..."
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="bg-secondary border-0"
                />
              </div>
            </div>
          )}
        </div>

        <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
          <Send className="h-4 w-4 mr-2" />
          Create Issue
        </Button>
      </CardContent>
    </Card>
  )
}
