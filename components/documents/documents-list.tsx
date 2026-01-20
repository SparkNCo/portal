"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText,
  Download,
  ExternalLink,
  Search,
  Filter,
  FileSpreadsheet,
  FileImage,
  File,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"

const documents = [
  {
    id: "doc-1",
    name: "Q1 Progress Report",
    type: "report",
    category: "Reports",
    date: "Feb 28, 2025",
    size: "1.2 MB",
    format: "pdf",
  },
  {
    id: "doc-2",
    name: "Technical Architecture Diagram",
    type: "artifact",
    category: "Technical",
    date: "Feb 15, 2025",
    size: "3.5 MB",
    format: "png",
  },
  {
    id: "doc-3",
    name: "User Flow Documentation",
    type: "artifact",
    category: "Design",
    date: "Feb 10, 2025",
    size: "2.1 MB",
    format: "pdf",
  },
  {
    id: "doc-4",
    name: "Sprint Retrospective Notes",
    type: "report",
    category: "Reports",
    date: "Feb 5, 2025",
    size: "0.5 MB",
    format: "docx",
  },
  {
    id: "doc-5",
    name: "API Endpoints Spreadsheet",
    type: "artifact",
    category: "Technical",
    date: "Jan 28, 2025",
    size: "0.8 MB",
    format: "xlsx",
  },
  {
    id: "doc-6",
    name: "Brand Assets Package",
    type: "artifact",
    category: "Design",
    date: "Jan 20, 2025",
    size: "15.2 MB",
    format: "zip",
  },
]

const categories = ["All", "Reports", "Technical", "Design"]

const formatIcons = {
  pdf: FileText,
  png: FileImage,
  jpg: FileImage,
  docx: FileText,
  xlsx: FileSpreadsheet,
  zip: File,
}

const categoryColors = {
  Reports: "bg-chart-1/20 text-chart-1",
  Technical: "bg-chart-2/20 text-chart-2",
  Design: "bg-chart-3/20 text-chart-3",
}

export function DocumentsList() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === "All" || doc.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            Project Documents
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 bg-secondary border-0 pl-9 text-sm"
              />
            </div>
            <Button variant="outline" size="icon" className="bg-transparent">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-1 mt-4">
          {categories.map((category) => (
            <Button
              key={category}
              variant="ghost"
              size="sm"
              onClick={() => setActiveCategory(category)}
              className={cn(
                "text-sm",
                activeCategory === category ? "bg-secondary text-foreground" : "text-muted-foreground",
              )}
            >
              {category}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {filteredDocs.map((doc) => {
            const FormatIcon = formatIcons[doc.format as keyof typeof formatIcons] || File
            return (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <FormatIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground group-hover:text-accent transition-colors">
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="secondary"
                        className={categoryColors[doc.category as keyof typeof categoryColors]}
                      >
                        {doc.category}
                      </Badge>
                      <span>•</span>
                      <Calendar className="h-3 w-3" />
                      <span>{doc.date}</span>
                      <span>•</span>
                      <span>{doc.size}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {filteredDocs.length === 0 && (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents found</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
