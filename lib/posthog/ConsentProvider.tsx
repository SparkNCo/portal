"use client";

import { ConsentManagerProvider, CookieBanner } from "@c15t/react";
import posthog from "@/lib/posthog";

export default function ConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline", // ✅ REQUIRED

        callbacks: {
          onConsentSet({ preferences }) {
            if (preferences?.measurement) {
              posthog.opt_in_capturing();
            } else {
              posthog.opt_out_capturing();
            }
          },
        },
      }}
    >
      {children}
      <CookieBanner />
    </ConsentManagerProvider>
  );
}
