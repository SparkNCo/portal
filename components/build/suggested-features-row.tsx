"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSuggestedFeatures } from "@/lib/suggested-features-api";
import { SuggestedFeatureCard } from "./suggested-feature-card";

// Ticket: "Place a single horizontally scrollable row of Suggested Features
// cards at the top of the Build page." Renders nothing at all when there are
// no pending suggestions — no empty-state placeholder — so it doesn't add a
// permanent empty section to a page most customers won't have this for yet
// (no weekly-generation cron wired up on the backend either, see
// suggested-features/index.ts).
export function SuggestedFeaturesRow({ slug }: { slug: string }) {
  const { data: features = [] } = useQuery({
    queryKey: ["suggested-features", slug],
    queryFn: () => fetchSuggestedFeatures(slug),
    enabled: !!slug,
  });

  if (features.length === 0) return null;

  return (
    <div className="-mx-4 sm:mx-0 flex gap-4 overflow-x-auto pb-2 px-4 sm:px-0">
      {features.map((feature) => (
        <SuggestedFeatureCard key={feature.id} feature={feature} slug={slug} />
      ))}
    </div>
  );
}
