"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
  } = useQuery({
    queryKey: ["customer", sessionEmail],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/users?email=${encodeURIComponent(
          sessionEmail!,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
        },
      );

      if (!res.ok) {
        throw new Error("Failed to fetch customer");
      }

      const data = await res.json();

      // ✅ log backend response
      console.log("Backend response:", data);

      return data;
    },
    enabled: !!sessionEmail,
  });

  // ✅ handle side effects properly
  useEffect(() => {
    if (customer) {
      console.log("Customer from query:", customer);

      // 🚫 navigation disabled for now
      router.push(`/${customer.linear_name}/dashboard/client`);
    }

    if (customerError) {
      console.error("Customer error:", customerError);
    }
  }, [customer, customerError]);

  const login = async (e?: React.FormEvent) => {
    e?.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      setErrorMessage("User session not found");
      setLoading(false);
      return;
    }

    setSessionEmail(user.email); // 🔥 triggers React Query
    setLoading(false);
  };

  const signup = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    alert("Check your email 👀");
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <form onSubmit={login} className="w-80 space-y-3">
        <input
          className="w-full rounded border p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full rounded border p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

        <button
          type="submit"
          disabled={loading || customerLoading}
          className="w-full rounded bg-black text-white p-2 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <button
          type="button"
          onClick={signup}
          disabled={loading}
          className="w-full rounded border p-2"
        >
          Sign up
        </button>
      </form>
    </div>
  );
}
