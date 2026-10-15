"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Plus } from "lucide-react";
import { Header } from "@/components/headerDashboard";
import { Button } from "@/components/components/ui/button";
import { DataSourceForm } from "@/components/query/data-source-form";
import { DataSourcesList, DataSourcesListSkeleton } from "@/components/query/data-sources-list";
import { type DataSource, listDataSources } from "@/lib/data-sources-api";
import { safeDecodeURIComponent } from "@/lib/utils";

// Query: connect a client's own databases and ask them questions in plain
// text. Admins only for now (PAGE_ROLES in lib/route-access.ts).
export default function QueryPage() {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = rawSlug ? safeDecodeURIComponent(rawSlug) : "";
  const queryClient = useQueryClient();

  // The form is open for a new connection ("new") or for one being edited.
  const [formFor, setFormFor] = useState<DataSource | "new" | null>(null);

  const queryKey = ["data-sources", slug.toLowerCase()];
  const { data: dataSources = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => listDataSources(slug),
    enabled: !!slug,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  let content: React.ReactNode;
  if (isLoading) {
    content = <DataSourcesListSkeleton />;
  } else if (error) {
    content = (
      <p role="alert" className="smalltext text-destructive">
        {(error as Error).message}
      </p>
    );
  } else if (dataSources.length === 0) {
    content = (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/40 p-10 text-center">
        <Database className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="smalltext font-medium text-foreground">No databases connected yet</p>
        <p className="smalltext text-muted-foreground">
          Connect one of this client&apos;s databases to start asking it questions.
        </p>
      </div>
    );
  } else {
    content = (
      <DataSourcesList dataSources={dataSources} onEdit={(dataSource) => setFormFor(dataSource)} onDeleted={refresh} />
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Query"
        subtitle="Connect this client's databases and ask them questions in plain text"
        subtitleClassName="smalltext"
        actions={
          <Button size="sm" onClick={() => setFormFor("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Connect database
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-6">{content}</div>

      {formFor && (
        <DataSourceForm
          key={formFor === "new" ? "new" : formFor.id}
          slug={slug}
          dataSource={formFor === "new" ? null : formFor}
          open
          onOpenChange={(open) => !open && setFormFor(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
