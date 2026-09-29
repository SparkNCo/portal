"use client";

import { useQuery } from "@tanstack/react-query";
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

  const { data: features = [] } = useQuery({
    queryKey: ["suggested-features", slug],
    queryFn: () => fetchSuggestedFeatures(slug),
    enabled: !!slug && canManage,
  });

  if (!canManage || features.length === 0) return null;

  return (
    <div className="-mx-4 sm:mx-0 flex gap-4 overflow-x-auto pb-2 px-4 sm:px-0">
      {features.map((feature) => (
        <SuggestedFeatureCard
          key={feature.id}
          feature={feature}
          slug={slug}
          actorEmail={profile?.email ?? ""}
        />
      ))}
    </div>
  );
}
