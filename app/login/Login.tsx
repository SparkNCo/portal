"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function LoginForm({
  onLoginSuccess,
}: {
  onLoginSuccess: (email: string) => void;
}) {
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

      if (!res.ok) throw new Error("Failed to fetch customer");

      const data = await res.json();
      console.log("Backend response:", data);

      return data;
    },
    enabled: !!sessionEmail,
  });

  useEffect(() => {
    if (customer) {
      console.log("Customer from query:", customer);
      router.push(`/${customer.linear_name}/dashboard/client`);
      onLoginSuccess(customer.email);
    }

    if (customerError) console.error("Customer error:", customerError);
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

    setSessionEmail(user.email);
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <form
        onSubmit={login}
        className="flex flex-col items-center w-[500px] h-[600px] p-8 bg-white rounded-lg shadow-lg space-y-6 relative"
      >
        {/* Public image at the top */}
        <img
          src="/nbarIcon2.png"
          alt="spark/co"
          className="w-36 h-36 object-contain mb-2"
        />

        {/* Title */}
        <h1 className="text-4xl text-background font-bold mb-4">
          Welcome Back
        </h1>

        {/* Username */}
        <div className="w-[85%] flex flex-col">
          <label
            htmlFor="email"
            className="text-sm font-medium mb-1 text-background"
          >
            Username
          </label>
          <input
            id="email"
            className="rounded border-none p-2 bg-primary focus:outline-black focus:outline-2 focus:outline-offset-2 focus:outline-primary"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password */}
        <div className="w-[85%] flex flex-col">
          <label
            htmlFor="password"
            className="text-sm font-medium mb-1 text-background"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            className="rounded border-none p-2 bg-primary focus:outline-black focus:outline-2 focus:outline-offset-2 focus:outline-primary "
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Error */}
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

        {/* Forgot password */}
        <a
          href="#"
          className="self-end mr-[7.5%] text-sm font-semibold hover:underline text-background"
        >
          Forgot your password?
        </a>

        {/* Login button */}
        <button
          type="submit"
          disabled={loading || customerLoading}
          className="w-[85%] rounded bg-background text-foreground p-2 disabled:opacity-50 mt-4"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
