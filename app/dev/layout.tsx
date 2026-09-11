"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { SelectedProjectProvider } from "@/lib/selected-project-context";
import { useUser } from "context/UserContext";
import { LoadingDataPanel } from "@/components/loader";
import type React from "react";

function LayoutContent({ children }: { readonly children: React.ReactNode }) {
  const { isOpen, close } = useSidebar();
  const { profile, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile?.role !== "developer") {
      router.replace("/");
    }
  }, [loading, profile, router]);

  if (loading) return <LoadingDataPanel />;
  if (profile?.role !== "developer") return null;

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

export default function DevLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <SelectedProjectProvider>
        <SidebarProvider>
          <LayoutContent>{children}</LayoutContent>
        </SidebarProvider>
      </SelectedProjectProvider>
    </AuthGate>
  );
}
