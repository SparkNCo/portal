"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, FileText, Database } from "lucide-react";

const links = [
  /*   {
    title: "Project Documentation",
    description: "Notion workspace with specs and requirements",
    icon: FileText,
    href: "#",
    type: "Notion",
  },
  {
    title: "Client Intake Form",
    description: "Airtable form for new requirements",
    icon: Database,
    href: "#",
    type: "Airtable",
  },
  {
    title: "Sprint Planning",
    description: "Notion page for sprint goals",
    icon: FileText,
    href: "#",
    type: "Notion",
  }, */

  {
    title: "Daily Tracker",
    description: "Airtable form for daily work tracking",
    icon: Database,
    href: "https://airtable.com/appFz7B4zPErBwIDt/pagxhdKdx4Vx9NFc0/form",
    type: "Airtable",
  },
  {
    title: "PTO Request",
    description: "Submit paid time off requests",
    icon: Database,
    href: "https://airtable.com/appFz7B4zPErBwIDt/pagRuKnt4BRHtYDAy/form",
    type: "Airtable",
  },
  {
    title: "Client Escalation",
    description: "Escalate client issues and blockers",
    icon: Database,
    href: "https://airtable.com/appFz7B4zPErBwIDt/pagWPbefvATbKvMVJ/form",
    type: "Airtable",
  },
];

export function QuickLinks() {
  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-accent" />
          Quick Links
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {links.map((link) => (
          <a
            key={link.title}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10">
              <link.icon className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground group-hover:text-accent transition-colors">
                {link.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {link.description}
              </p>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {link.type}
            </span>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
