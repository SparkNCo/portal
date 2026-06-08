"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Search,
  Filter,
  FileSpreadsheet,
  FileImage,
  File,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentRow } from "./document-list-panel";
import { useSearchParams } from "next/navigation";
import { useUser } from "context/UserContext";

/* -----------------------------
   Helpers
--------------------------------*/

const formatIcons = {
  pdf: FileText,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  docx: FileText,
  xlsx: FileSpreadsheet,
  zip: File,
};

const categories = ["All", "Reports", "Technical", "Design"];

function getFileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function fetchDocuments(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/storage?user_id=${id}`,
  );

  if (!res.ok) {
    throw new Error("Failed to fetch documents");
  }

  return res.json();
}

export function DocumentsList() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(slug: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }
  const searchParams = useSearchParams();
  const initiativeId = searchParams.get("id");
  const { user, profile, loading } = useUser();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["documents", initiativeId],
    queryFn: () => fetchDocuments(profile?.id!),
    enabled: !!profile?.id,
  });

  const documents = useMemo(() => {
    if (!data?.documents) return [];

    return data.documents.map((doc: any) => ({
      id: doc.id,
      name: doc.file_name,
      category: doc.category,
      date: new Date(doc.created_at).toLocaleDateString(),
      size: doc.size,
      link: doc.link,
      permission: doc.permission,
      format: getFileExtension(doc.file_name),
      project_slug: doc.project_slug ?? null,
    }));
  }, [data]);

  const filteredDocs = documents.filter((doc: any) => {
    const name = doc.name?.toLowerCase() ?? "";
    const matchesSearch = name.includes(searchQuery.trim().toLowerCase());
    const matchesCategory =
      activeCategory === "All" || doc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedDocs = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const doc of filteredDocs) {
      const key = doc.project_slug ?? "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(doc);
    }
    return groups;
  }, [filteredDocs]);

  return (
    <Card className="bg-background border-border">
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
                activeCategory === category
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {category}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading documents…</p>
        )}

        {isError && (
          <p className="text-sm text-destructive">Failed to load documents</p>
        )}

        {!isLoading && filteredDocs.length === 0 && (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents found</p>
          </div>
        )}

        {Array.from(groupedDocs.entries()).map(([slug, docs]) => {
          const isCollapsed = !expandedGroups.has(slug);

          return (
            <div key={slug} className="mb-4">
              <button
                onClick={() => toggleGroup(slug)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors mb-2 group"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-accent shrink-0" />
                  <span className="text-sm font-medium text-foreground capitalize">
                    {slug}
                  </span>
                  <span className="text-xs text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">
                    {docs.length} {docs.length === 1 ? "file" : "files"}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    isCollapsed && "-rotate-90",
                  )}
                />
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  isCollapsed ? "max-h-0" : "max-h-[9999px]",
                )}
              >
                <DocumentRow filteredDocs={docs} userId={profile?.id} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
