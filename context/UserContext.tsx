"use client";

import { createContext, useContext, useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "../lib/supabase-client";
import { API_JSON_HEADERS } from "../lib/api-headers";

type Assignment = {
  id: string;
  user_id: string;
  customer_id: string;
  role: string;
  allocation?: number | null;
  joined?: string;
  clientName?: string | null;
  linear_slug?: string | null;
};

type Profile = {
  id: string;
  email: string;
  role: "admin" | "developer" | "customer" | "stakeholder";
  linear_slug?: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  customer_id?: string;
  assignment_id?: Assignment[];
  clientName?: string | null;
  stripe_customer_id?: string | null;
  developerType?: "spark_fde" | "internal";
};

// Stakeholders have no client of their own — they land on the dashboard of
// the customer they're assigned to. Null when they have no assignment.
export function getStakeholderClientSlug(profile: Profile | null): string | null {
  const clientName =
    profile?.assignment_id?.[0]?.clientName ??
    profile?.assignment_id?.[0]?.linear_slug ??
    profile?.clientName;
  return clientName ? clientName.toLowerCase() : null;
}

// Outcome of the last profile load, so pages can tell "signed in but no
// portal account" (not-found) apart from "couldn't reach the server"
// (failed) instead of both looking like a silent null profile.
export type ProfileStatus = "loading" | "ok" | "not-found" | "failed" | "signed-out";

// Shown wherever a profile can't be loaded after sign-in (login,
// set-password, portal pages).
export const PROFILE_ERROR_MESSAGES: Record<"not-found" | "failed", string> = {
  "not-found": "Your account isn't set up yet. Contact your administrator.",
  failed: "We couldn't load your account. Please try again.",
};

type UserContextType = {
  user: any;
  profile: Profile | null;
  loading: boolean;
  profileStatus: ProfileStatus;
  reloadUser: () => Promise<ProfileStatus>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
  profileStatus: "loading",
  reloadUser: async () => "loading",
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const loadedUserIdRef = useRef<string | null>(null);

  const loadUser = async (): Promise<ProfileStatus> => {
    setLoading(true);
    setProfileStatus("loading");
    let status: ProfileStatus;

    // 1. Get Supabase auth user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    // 2. Fetch your backend user
    if (user?.email) {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?email=${encodeURIComponent(
            user.email,
          )}`,
          { headers: API_JSON_HEADERS },
        );

        if (!res.ok) throw new Error("Failed to fetch profile");

        const data = await res.json();

        // A 200 with `null` means the auth account has no portal.users row.
        if (data) loadedUserIdRef.current = user.id;
        setProfile(data);
        status = data ? "ok" : "not-found";
      } catch (err) {
        console.error("Context fetch error:", err);
        setProfile(null);
        status = "failed";
      }
    } else {
      setProfile(null);
      status = "signed-out";
    }

    setProfileStatus(status);
    setLoading(false);
    return status;
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
        setUser(null);
        setProfile(null);
        setProfileStatus("signed-out");
        setLoading(false);
        return;
      }
      if (event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        loadUser();
        return;
      }
      if (event === "SIGNED_IN" && session?.user?.id !== loadedUserIdRef.current) {
        loadUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, profileStatus, reloadUser: loadUser }),
    [user, profile, loading, profileStatus],
  );

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
