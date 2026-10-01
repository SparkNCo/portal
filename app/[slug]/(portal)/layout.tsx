"use client";
import { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { useUser } from "context/UserContext";
import { CustomerSlugProvider } from "context/CustomerSlugContext";
import { safeDecodeURIComponent } from "@/lib/utils";
import { useSelectedProject } from "@/lib/selected-project-context";
import { checkSlugAccess } from "@/lib/route-access";
import { LoadingDataPanel } from "@/components/loader";
import { AccountNotSetUp } from "@/components/account-not-set-up";
import type React from "react";

function LayoutContent({ children }: { readonly children: React.ReactNode }) {
  const { isOpen, close } = useSidebar();
  const { profile, loading, profileStatus } = useUser();
  const { selectedProject } = useSelectedProject();
  const router = useRouter();
  const pathname = usePathname();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;

  // Who may open this initiative and page (lib/route-access.ts): admins any
  // initiative; customers their own; stakeholders and developers their
  // assignments. Some pages are role-specific (Developer: developers only;
  // Settings: not developers). Users without a usable profile/role see
  // "account not set up". Front-end only — the API doesn't check yet.
  const page = pathname.split("/")[2] ?? null;
  const access = loading ? null : checkSlugAccess(profile, urlSlug, selectedProject, page);
  const redirectTo = access?.kind === "redirect" ? access.to : null;
  const redirectReason = access?.kind === "redirect" ? access.reason : null;

  useEffect(() => {
    if (!redirectTo) return;
    if (redirectReason === "page") {
      toast.error("That page isn't available for your role", {
        id: "slug-access-denied",
        description: "You've been taken to this initiative's main page.",
      });
    } else {
      toast.error("You don't have access to that initiative", {
        id: "slug-access-denied",
        description: "You've been taken back to your own pages.",
      });
    }
    router.replace(redirectTo);
  }, [redirectTo, redirectReason, router]);

  const content = (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={close}
        />
      )}
      <main className="lg:pl-60">{children}</main>
    </div>
  );

  if (!access || access.kind === "redirect") return <LoadingDataPanel />;
  if (access.kind === "not-set-up") return <AccountNotSetUp loadFailed={profileStatus === "failed"} />;

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
