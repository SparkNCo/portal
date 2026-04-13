"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { SparkButton } from "@/components/ui/spark-button";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);


  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/"), 3000);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg bg-background border border-border p-8 shadow-xl space-y-6">
        <img
          src="/icon2.svg"
          alt="spark/co"
          className="w-20 h-20 object-contain mx-auto"
        />

        {success ? (
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Password updated!
            </h2>
            <p className="text-sm text-muted-foreground">
              Redirecting you to login...
            </p>
          </div>
        ) : !ready ? (
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Verifying link...
            </h2>
            <p className="text-sm text-muted-foreground">
              Please wait while we verify your reset link.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">
                Set new password
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose a new password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  New password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Confirm password
                </label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <SparkButton
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full"
              >
                {loading ? "Updating..." : "Update password"}
              </SparkButton>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
