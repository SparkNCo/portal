"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SparkButton } from "@/components/ui/spark-button";

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

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState("");

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

      return data;
    },
    enabled: !!sessionEmail,
  });

  useEffect(() => {
    if (customer) {
      if (customer.role === "admin") {
        router.push(`/${customer.userName}/dashboard/admin`);
      } else {
        router.push(`/${customer.userName}/dashboard/client`);
      }
      onLoginSuccess(customer.email);
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

    setSessionEmail(user.email);
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/reset-password`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: resetEmail }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send reset email");
      }

      setResetSent(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setResetEmail("");
    setResetSent(false);
    setResetError("");
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      {/* Forgot password modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-xl space-y-4">
            {resetSent ? (
              <>
                <h2 className="text-lg font-semibold text-foreground">
                  Check your inbox
                </h2>
                <p className="text-sm text-muted-foreground">
                  A password reset link has been sent to{" "}
                  <span className="font-medium text-foreground">
                    {resetEmail}
                  </span>
                  .
                </p>
                <SparkButton className="w-full" onClick={closeForgotModal}>
                  Close
                </SparkButton>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-foreground">
                  Reset your password
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we'll send you a reset link.
                </p>
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {resetError && (
                    <p className="text-xs text-red-500">{resetError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      className="flex-1 rounded border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <SparkButton
                      type="submit"
                      disabled={resetLoading}
                      variant="primary"
                      className="flex-1"
                    >
                      {resetLoading ? "Sending..." : "Send link"}
                    </SparkButton>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={login}
        className="flex flex-col items-center w-[500px] h-[600px] p-8 bg-card shadow-lg space-y-6 relative"
      >
        {/* Public image at the top */}
        <img
          src="/icon2.svg"
          alt="spark/co"
          className="w-36 h-36 object-contain mb-2"
        />

        {/* Title */}
        <h1 className="text-4xl text-background font-bold mb-4">
          Welcome Back
        </h1>

        {/* Username */}
        <div className="w-[85%] flex flex-col  ">
          <label
            htmlFor="email"
            className="text-sm font-medium mb-1 text-background"
          >
            Username
          </label>
          <input
            id="email"
            className="rounded border-2 border-transparent focus:border-3 focus:border-primary focus:outline-none p-2 bg-foreground text-background selection:bg-primary selection:text-background"
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
            className="rounded border-2 border-transparent focus:border-3 focus:border-primary focus:outline-none p-2 bg-foreground text-background selection:bg-primary selection:text-background"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Error */}
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

        {/* Forgot password */}
        <button
          type="button"
          onClick={() => setShowForgotModal(true)}
          className="self-end mr-[7.5%] text-sm font-semibold hover:underline text-background"
        >
          Forgot your password?
        </button>

        {/* Login button */}
        <SparkButton
          type="submit"
          disabled={loading || customerLoading}
          className="w-[85%] mt-4"
        >
          {loading ? "Logging in..." : "Login"}
        </SparkButton>
      </form>
    </div>
  );
}
