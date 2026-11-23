"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "context/UserContext";
import { usePanelExpanded } from "@/hooks/use-user-layout";
import { fetchSuggestedFeatures } from "@/lib/suggested-features-api";
import { SuggestedFeatureCard } from "./suggested-feature-card";

// Accepting/declining a suggestion (or overriding its milestone) is a
// product/roadmap decision, not an engineering one — admins, customers, and
// stakeholders get it, developers don't. Same restriction is enforced
// server-side (see supabase/functions/suggested-features/authorize.ts) —
// this just keeps a developer from ever fetching/seeing the section at all,
// rather than showing it read-only.
const CAN_MANAGE_ROLES = new Set(["admin", "customer", "stakeholder"]);

// Ticket: "Place a single horizontally scrollable row of Suggested Features
// cards at the top of the Build page", then "Keep suggested features
// minimized until opened": only the heading (with the count) shows until it's
// clicked. Renders nothing at all when there are no pending suggestions — no
// empty-state placeholder — so it doesn't add a
// permanent empty section to a page most customers won't have this for yet
// (no weekly-generation cron wired up on the backend either, see
// suggested-features/index.ts).
export function SuggestedFeaturesRow({ slug }: { readonly slug: string }) {
  const { profile } = useUser();
  const canManage = !!profile?.role && CAN_MANAGE_ROLES.has(profile.role);

  const { data: features = [], isLoading } = useQuery({
    queryKey: ["suggested-features", slug],
    queryFn: () => fetchSuggestedFeatures(slug),
    enabled: !!slug && canManage,
  });

  // Minimized until opened; open or closed is kept per user (portal.user_layout).
  const { expanded: open, toggle } = usePanelExpanded("build", "suggested_features");

  // Nothing at all once we know there are none; placeholders while we don't.
  if (!canManage || (!isLoading && features.length === 0)) return null;

  return (
    // Same panel as Request a Feature above it on the Build page.
    <Card
      role="region"
      aria-labelledby="suggested-features-heading"
      className="bg-background text-foreground border-transparent sm:border-border rounded-none sm:rounded-xl"
    >
      <CardHeader className={open ? undefined : "py-4"}>
        {/* One heading for the row, instead of a label on every card. The
            whole heading opens and closes it. */}
        <CardTitle id="suggested-features-heading" level={2} className="body font-semibold">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="suggested-features-content"
            className="flex w-full items-center gap-2 text-left"
          >
            <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
            Suggested Features
            {!isLoading && <span className="smalltext font-semibold text-primary tabular-nums">{features.length}</span>}
            <ChevronDown
              className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            <span className="sr-only">{open ? "Minimize" : "Show"}</span>
          </button>
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent id="suggested-features-content">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {isLoading
              ? [0, 1, 2].map((i) => <SuggestedFeatureSkeleton key={i} />)
              : features.map((feature) => (
                  <SuggestedFeatureCard
                    key={feature.id}
                    feature={feature}
                    slug={slug}
                    actorEmail={profile?.email ?? ""}
                  />
                ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Same footprint as a SuggestedFeatureCard: title, preview, project line and
// the View / Decline row.
function SuggestedFeatureSkeleton() {
  const bar = "rounded bg-muted-foreground/20";
  return (
    <div
      role="status"
      className="relative w-[280px] sm:w-80 shrink-0 animate-pulse rounded-lg border border-border bg-background p-4 pl-5 space-y-3"
    >
      <span className="sr-only">Loading suggested features…</span>
      <span className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-primary/40" aria-hidden="true" />
      <div className={`${bar} h-4 w-3/4`} />
      <div className="space-y-2">
        <div className={`${bar} h-3 w-full`} />
        <div className={`${bar} h-3 w-2/3`} />
      </div>
      <div className={`${bar} h-3 w-1/2`} />
      <div className="flex gap-2">
        <div className={`${bar} h-8 flex-1`} />
        <div className={`${bar} h-8 flex-1`} />
      </div>
    </div>
  );
}
