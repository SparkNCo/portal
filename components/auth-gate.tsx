"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return null; 
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6 text-center">
          <h1 className="text-xl font-semibold">Welcome 👋</h1>
          <p className="text-sm text-muted-foreground">
            Please log in or create an account to continue
          </p>

          <Link
            href="/dashboard/roadmap?id=db853ded0f7b"
            className="block w-full rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Login / Sign up
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
