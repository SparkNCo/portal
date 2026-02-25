"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/components/ui/button";

const documents = [
  {
    id: "msa",
    name: "Master Service Agreement",
    type: "MSA",
    date: "Jan 15, 2025",
    status: "signed",
    size: "2.4 MB",
  },
  {
    id: "sow-1",
    name: "Statement of Work - Phase 1",
    type: "SOW",
    date: "Jan 20, 2025",
    status: "signed",
    size: "1.8 MB",
  },
  {
    id: "sow-2",
    name: "Statement of Work - Phase 2",
    type: "SOW",
    date: "Feb 1, 2025",
    status: "pending",
    size: "2.1 MB",
  },
  {
    id: "co-1",
    name: "Change Order #001",
    type: "Change Order",
    date: "Feb 5, 2025",
    status: "draft",
    size: "0.8 MB",
  },
];

const statusColors = {
  signed: "bg-success/20 text-success",
  pending: "bg-warning/20 text-warning",
  draft: "bg-muted text-muted-foreground",
};

export function DocumentsDirectory() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          Contract Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{doc.type}</span>
                    <span>•</span>
                    <Calendar className="h-3 w-3" />
                    <span>{doc.date}</span>
                    <span>•</span>
                    <span>{doc.size}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={
                    statusColors[doc.status as keyof typeof statusColors]
                  }
                >
                  {doc.status}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
