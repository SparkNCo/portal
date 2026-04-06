"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Code2,
  Map,
  MessageSquare,
  Settings,
  FileText,
  ChevronDown,
  Building2,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";

const clientNavItems = [
  { href: "client", label: "Dashboard", icon: LayoutDashboard },
  { href: "roadmap", label: "Roadmap", icon: Map },
  //  { href: "chat", label: "Chat", icon: MessageSquare },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "settings", label: "Settings", icon: Settings },
];

const developerNavItems = [
  { href: "client", label: "Dashboard", icon: LayoutDashboard },
  { href: "roadmap", label: "Roadmap", icon: Map },
  { href: "developer", label: "Developer", icon: Code2 },
  // { href: "chat", label: "Chat", icon: MessageSquare },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "settings", label: "Settings", icon: Settings },
];

type PortalType = "client" | "developer";

type AppUser = User & {
  supabase?: {
    role?: string;
  };
};

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = searchParams.toString();
  const router = useRouter();

  const [portalType, setPortalType] = useState<PortalType>("client");

  const navItems = portalType === "client" ? clientNavItems : developerNavItems;

  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const initUser = async () => {
      const { data } = await supabase.auth.getUser();
      const authUser = data.user;

      if (!authUser) {
        setUser(null);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/users?email=${authUser.email}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
        },
      );

      if (!res.ok) {
        throw new Error("Failed to fetch user from DB");
      }

      const dbUser = await res.json();

      // 🔥 Combinar usuarios
      const mergedUser: AppUser = {
        ...authUser,
        supabase: dbUser,
      };

      setUser(mergedUser);

      // 🔥 Setear portal según role
      if (dbUser?.role === "admin" || dbUser?.role === "developer") {
        setPortalType("developer");
      } else {
        setPortalType("client");
      }
    };

    initUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* -------------------------
     Logout
  --------------------------*/
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!user) {
    return null;
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Building2 className="h-5 w-5 text-accent" />
        <span className="font-semibold text-sidebar-foreground">
          Agency Portal
        </span>
      </div>
      <div className="p-3">
        <button
          onClick={() =>
            setPortalType(portalType === "developer" ? "client" : "developer")
          }
          className="flex w-full items-center justify-between rounded-md bg-sidebar-accent px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/80 transition-colors"
        >
          <span className="capitalize">{portalType} Portal</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive =
            pathname === `/dashboard/${item.href}` ||
            pathname.startsWith(`/dashboard/${item.href}/`);

          const hrefWithParams = params ? `${item.href}?${params}` : item.href;

          return (
            <Link
              key={item.href}
              href={hrefWithParams}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-medium text-accent">
              {user.email?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
