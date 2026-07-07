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
};

type UserContextType = {
  user: any;
  profile: Profile | null;
  loading: boolean;
  reloadUser: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
  reloadUser: async () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedUserIdRef = useRef<string | null>(null);

  const loadUser = async () => {
    setLoading(true);

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

        loadedUserIdRef.current = user.id;
        setProfile(data);
      } catch (err) {
        console.error("Context fetch error:", err);
        setProfile(null);
      }
    } else {
      setProfile(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
        setUser(null);
        setProfile(null);
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

  const value = useMemo(() => ({ user, profile, loading, reloadUser: loadUser }), [user, profile, loading]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
