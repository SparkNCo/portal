"use client";

import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { useUser } from "context/UserContext";
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
// cards at the top of the Build page." Renders nothing at all when there are
// no pending suggestions — no empty-state placeholder — so it doesn't add a
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

  // Nothing at all once we know there are none; placeholders while we don't.
  if (!canManage || (!isLoading && features.length === 0)) return null;

  return (
    <section aria-labelledby="suggested-features-heading" className="space-y-3">
      {/* One heading for the row, instead of a label on every card. */}
      <h2 id="suggested-features-heading" className="body font-semibold flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
        Suggested Features
        {!isLoading && <span className="smalltext font-semibold text-primary tabular-nums">{features.length}</span>}
      </h2>

      <div className="-mx-4 sm:mx-0 flex gap-4 overflow-x-auto pb-2 px-4 sm:px-0">
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
    </section>
  );
}

// Same footprint as a SuggestedFeatureCard: title, description lines, the two
// pickers and the Accept/Decline row.
function SuggestedFeatureSkeleton() {
  const bar = "rounded bg-muted-foreground/20";
  return (
    <div
      role="status"
      className="relative w-80 shrink-0 animate-pulse rounded-lg border border-border bg-background p-4 pl-5 space-y-3"
    >
      <span className="sr-only">Loading suggested features…</span>
      <span className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-primary/40" aria-hidden="true" />
      <div className={`${bar} h-4 w-3/4`} />
      <div className="space-y-2">
        <div className={`${bar} h-3 w-full`} />
        <div className={`${bar} h-3 w-11/12`} />
        <div className={`${bar} h-3 w-2/3`} />
      </div>
      <div className={`${bar} h-8 w-full`} />
      <div className={`${bar} h-8 w-full`} />
      <div className="flex gap-2 pt-1">
        <div className={`${bar} h-8 flex-1`} />
        <div className={`${bar} h-8 flex-1`} />
      </div>
    </div>
  );
}
