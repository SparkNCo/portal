"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Mail, Clock } from "lucide-react";
import { Button } from "../components/ui/button";

const teamMembers = [
  {
    name: "Sarah Chen",
    role: "Lead Developer",
    hours: 40,
    status: "active",
    avatar: "SC",
    skills: ["React", "Node.js", "TypeScript"],
  },
  {
    name: "Mike Johnson",
    role: "Backend Developer",
    hours: 32,
    status: "active",
    avatar: "MJ",
    skills: ["Python", "PostgreSQL", "AWS"],
  },
  {
    name: "Emily Davis",
    role: "UI/UX Designer",
    hours: 20,
    status: "active",
    avatar: "ED",
    skills: ["Figma", "Design Systems"],
  },
  {
    name: "Tom Wilson",
    role: "QA Engineer",
    hours: 20,
    status: "pending",
    avatar: "TW",
    skills: ["Testing", "Automation"],
  },
];

const statusColors = {
  active: "bg-success/20 text-success",
  pending: "bg-warning/20 text-warning",
  inactive: "bg-muted text-muted-foreground",
};

export function StaffingSection() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          Team Members
        </CardTitle>
        <Button
          size="sm"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus className="h-4 w-4 mr-1" />
          Request Change
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {teamMembers.map((member) => (
            <div
              key={member.name}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
                  {member.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-card-foreground">
                      {member.name}
                    </p>
                    <Badge
                      variant="secondary"
                      className={
                        statusColors[member.status as keyof typeof statusColors]
                      }
                    >
                      {member.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {member.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm text-card-foreground">
                    <Clock className="h-3 w-3" />
                    {member.hours}h/week
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Weekly Hours</span>
            <span className="font-medium text-card-foreground">112 hours</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
