"use client";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { useUser } from "context/UserContext";
import { CustomerSlugProvider } from "context/CustomerSlugContext";
import type React from "react";

function LayoutContent({ children }: { readonly children: React.ReactNode }) {
  const { isOpen, close } = useSidebar();
  const { profile } = useUser();
  const { slug: urlSlug } = useParams<{ slug: string }>();

  const content = (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={close}
        />
      )}
      <main className="lg:pl-60">{children}</main>
    </div>
  );

  // An admin browsing a customer's own routes directly (e.g. /lualink/...)
  // has no CustomerSlugProvider wrapping them the way the old nested
  // dashboards/[customer]/[panel] route provided one — without it, hooks
  // like usePinnedPanelsOwnerId() would fall back to the admin's own id
  // instead of the customer being viewed. Every other role already resolves
  // correctly from their own `[slug]`, so this is admin-only.
  return profile?.role === "admin" ? (
    <CustomerSlugProvider value={urlSlug}>{content}</CustomerSlugProvider>
  ) : (
    content
  );
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <SidebarProvider>
        <LayoutContent>{children}</LayoutContent>
      </SidebarProvider>
    </AuthGate>
  );
}
