"use client";
import { AuthGate } from "@/components/auth-gate";
import { Sidebar } from "@/components/sidebar";
import ConsentProvider from "@/lib/posthog/ConsentProvider";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import type React from "react";

function LayoutContent({ children }: { readonly children: React.ReactNode }) {
  const { isOpen, close } = useSidebar();
  return (
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
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConsentProvider>
      <AuthGate>
        <SidebarProvider>
          <LayoutContent>{children}</LayoutContent>
        </SidebarProvider>
      </AuthGate>
    </ConsentProvider>
  );
}
