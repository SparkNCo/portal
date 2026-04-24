"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
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
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "USER_UPDATED"
      ) {
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
