"use client";
import { AuthGate } from "@/components/components/auth-gate";
import { Sidebar } from "@/components/sidebar";
import ConsentProvider from "@/lib/posthog/ConsentProvider";
import type React from "react";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConsentProvider>
      <AuthGate>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <main className="pl-60">{children}</main>
        </div>
      </AuthGate>
    </ConsentProvider>
  );
}
