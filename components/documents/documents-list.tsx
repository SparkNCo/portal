"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Sparkles } from "lucide-react";
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

// Waits for a pause in typing before firing an AI search — a plain filename
// filter can react on every keystroke since it's free (client-side), but
// this hits the vector index (see queryTopDocumentMatches), so it's worth
// debouncing the same way SimilarIssuesHint does for issue search.
const SEARCH_DEBOUNCE_MS = 400;

function getFileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function fetchDocuments(id: string, projectSlug?: string, viewerId?: string, search?: string) {
  const params = new URLSearchParams({ user_id: id });
  if (projectSlug) params.set("project_slug", projectSlug);
  // The actual logged-in caller (as opposed to `id`, whose permissions the
  // list is scoped by) — lets the backend give an admin the full initiative
  // list instead of only what the previewed user has a permission row for.
  if (viewerId) params.set("viewer_id", viewerId);
  // AI search (SPA-513-Cycle20) — ranked server-side against each
  // document's vectorized title/category/content, see fetch-storage-data.ts.
  if (search) params.set("search", search);

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["documents", initiativeId, projectSlug, documentsOwnerId, profile?.id, debouncedSearch],
    queryFn: () => fetchDocuments(documentsOwnerId!, projectSlug, profile?.id, debouncedSearch),
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

  // The name/AI text match already happened server-side (see
  // fetchDocuments/fetch-storage-data.ts) — this only narrows by category,
  // and preserves the relevance order the backend returned for a search.
  const filteredDocs = documents.filter((doc: any) => {
    const matchesCategory =
      activeCategory === "All" || doc.category === activeCategory;
    return matchesCategory;
  });

  return (
    <Card className="bg-background border-transparent sm:border-border rounded-none sm:rounded-xl text-foreground">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="body font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Project Documents
          </CardTitle>

          <div className="w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
              <Input
                aria-label="AI-powered document search"
                placeholder="Ask AI to find a document…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted border-0 pl-9 pr-8 smalltext text-foreground placeholder:text-muted-foreground focus-visible:ring-accent"
              />
              {isFetching && debouncedSearch && (
                <div className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              )}
            </div>
            <p className="mt-1 smalltext text-muted-foreground/70">
              AI search — matches meaning, not just filenames.
            </p>
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
          <DocumentRow
            filteredDocs={filteredDocs}
            userId={profile?.id}
            customerId={documentsOwnerId}
          />
        )}
      </CardContent>
    </Card>
  );
}
