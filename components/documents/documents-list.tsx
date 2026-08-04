"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Filter, ChevronDown, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentRow } from "./document-list-panel";
import { useSearchParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { usePinnedPanelsOwnerId } from "@/hooks/use-pinned-panels";
import { API_HEADERS } from "@/lib/api-headers";

/* -----------------------------
   Helpers
--------------------------------*/

const categories = ["All", "Reports", "Technical", "Design"];

function getFileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function fetchDocuments(id: string, projectSlug?: string) {
  const params = new URLSearchParams({ user_id: id });
  if (projectSlug) params.set("project_slug", projectSlug);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage?${params.toString()}`,
    { headers: API_HEADERS },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch documents");
  }

  return res.json();
}

type CustomerSummary = { clientName: string; linear_slug: string | null };

export function DocumentsList({
  projectSlug,
  customers,
}: {
  readonly projectSlug?: string;
  readonly customers?: CustomerSummary[];
}) {
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
  // Whose `document_permissions` rows decide which documents show up —
  // the customer being viewed (admin/dev browsing their dashboard), or the
  // logged-in user's own when not viewing anyone. Previously this always
  // used the logged-in user's own id, so an admin viewing a customer's
  // Documents panel saw the admin's own (near-empty) permission set instead
  // of the customer's documents.
  const documentsOwnerId = usePinnedPanelsOwnerId();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["documents", initiativeId, projectSlug, documentsOwnerId],
    queryFn: () => fetchDocuments(documentsOwnerId!, projectSlug),
    enabled: !!documentsOwnerId,
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

  // `project_slug` is the customer's Linear initiative slug, not a display
  // name. Developers/stakeholders resolve it via their `assignment_id` list
  // (one entry per assigned customer); a customer isn't in their own
  // assignment_id, so fall back to their own profile's clientName/linear_slug.
  // Neither source has anything for an admin (admins aren't assigned to
  // customers) — that's why an admin viewing a customer's Documents panel
  // used to see the raw slug as the group header instead of a name; the
  // `customers` list (passed down when available) covers that case too.
  const slugToInitiativeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of profile?.assignment_id ?? []) {
      if (a.linear_slug && a.clientName) map.set(a.linear_slug.toLowerCase(), a.clientName);
    }
    if (profile?.linear_slug && profile?.clientName) {
      map.set(profile.linear_slug.toLowerCase(), profile.clientName);
    }
    for (const c of customers ?? []) {
      if (c.linear_slug && c.clientName) map.set(c.linear_slug.toLowerCase(), c.clientName);
    }
    return map;
  }, [profile?.assignment_id, profile?.linear_slug, profile?.clientName, customers]);

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
                aria-label="Search documents"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 bg-secondary border-0 pl-9 text-sm"
              />
            </div>
            <Button variant="outline" size="icon" className="bg-transparent" data-testid="document-filter-btn" aria-label="Filter documents">
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
              data-testid={`category-tab-${category.toLowerCase()}`}
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
            <div key={slug} data-testid={`document-folder-${slug}`} className="mb-4">
              <button
                onClick={() => toggleGroup(slug)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors mb-2 group"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-accent shrink-0" />
                  <span className="text-sm font-medium text-foreground capitalize">
                    {slugToInitiativeName.get(slug.toLowerCase()) ?? slug}
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
