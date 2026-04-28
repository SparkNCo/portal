"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { SparkButton } from "@/components/ui/spark-button";
import { Eye, EyeOff, LinkIcon } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();

  // Params come in the hash (#error=...&error_code=...), not the query string
  const hashParams = new URLSearchParams(
    (globalThis.window?.location.hash ?? "").slice(1),
  );

  const isExpired =
    hashParams.get("error_code") === "otp_expired" ||
    hashParams.get("error") === "access_denied";

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isExpired) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [isExpired]);

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

  let content: React.ReactNode;

  if (isExpired) {
    content = (
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto">
          <LinkIcon className="h-5 w-5 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">Link expired</h2>
          <p className="text-sm text-muted-foreground">
            This password reset link is no longer valid. Request a new one from the login page.
          </p>
        </div>
        <SparkButton
          variant="primary"
          className="w-full"
          onClick={() => router.push("/")}
        >
          Back to login
        </SparkButton>
      </div>
    );
  } else if (success) {
    content = (
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Password updated!</h2>
        <p className="text-sm text-muted-foreground">Redirecting you to login...</p>
      </div>
    );
  } else if (ready) {
    content = (
      <>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">Set new password</h2>
          <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="new-password" className="text-sm font-medium text-foreground">New password</label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-2 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">Confirm password</label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-2 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <SparkButton type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? "Updating..." : "Update password"}
          </SparkButton>
        </form>
      </>
    );
  } else {
    content = (
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Verifying link...</h2>
        <p className="text-sm text-muted-foreground">Please wait while we verify your reset link.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg bg-background border border-border p-8 shadow-xl space-y-6">
        <img src="/icon2.svg" alt="spark/co" className="w-20 h-20 object-contain mx-auto" />
        {content}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
