"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search } from "lucide-react";
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

export function DocumentsList({
  projectSlug,
}: {
  readonly projectSlug?: string;
}) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
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

  return (
    <Card className="bg-background border-border text-foreground">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="body font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
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
                className="w-full sm:w-48 bg-muted border-0 pl-9 smalltext text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-4">
          {categories.map((category) => (
            <Button
              key={category}
              variant="ghost"
              size="sm"
              onClick={() => setActiveCategory(category)}
              data-testid={`category-tab-${category.toLowerCase()}`}
              className={cn(
                "smalltext",
                activeCategory === category
                  ? "bg-primary text-primary-foreground"
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
          <p className="smalltext text-muted-foreground">Loading documents…</p>
        )}

        {isError && (
          <p className="smalltext text-destructive">Failed to load documents</p>
        )}

        {!isLoading && filteredDocs.length === 0 && (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="smalltext text-muted-foreground">No documents found</p>
          </div>
        )}

        {filteredDocs.length > 0 && (
          <DocumentRow filteredDocs={filteredDocs} userId={profile?.id} />
        )}
      </CardContent>
    </Card>
  );
}
