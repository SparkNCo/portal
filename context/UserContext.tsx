"use client";

import { createContext, useContext, useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "../lib/supabase-client";

type Profile = {
  id: string;
  email: string;
  role: "admin" | "developer" | "customer";
  linear_slug?: string;
  userName?: string;
  customer_id?: string;
};

type UserContextType = {
  user: any;
  profile: Profile | null;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
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
          `${process.env.NEXT_PUBLIC_ENDPOINT}/users?email=${encodeURIComponent(
            user.email,
          )}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
              apikey: process.env.NEXT_PUBLIC_APIKEY!,
              "Content-Type": "application/json",
            },
          },
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

  const value = useMemo(() => ({ user, profile, loading }), [user, profile, loading]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
