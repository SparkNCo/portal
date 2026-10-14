"use client";

import { Database } from "lucide-react";
import { Header } from "@/components/headerDashboard";

// Query: connect a client's own databases and ask them questions in plain
// text. Admins only for now (PAGE_ROLES in lib/route-access.ts).
export default function QueryPage() {
  return (
    <div className="min-h-screen">
      <Header
        title="Query"
        subtitle="Connect this client's databases and ask them questions in plain text"
        subtitleClassName="smalltext"
      />

      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/40 p-10 text-center">
          <Database className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="smalltext font-medium text-foreground">No databases connected yet</p>
          <p className="smalltext text-muted-foreground">
            Connected databases will appear here, ready to be queried.
          </p>
        </div>
      </div>
    </div>
  );
}
