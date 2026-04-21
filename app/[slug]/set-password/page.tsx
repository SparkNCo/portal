"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { KeyRound } from "lucide-react";

export default function SetPasswordPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase detects the #access_token hash and fires SIGNED_IN automatically.
    // Wait for that before showing the form.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setReady(true);
      } else if (event === "SIGNED_OUT") {
        setError("Invite link is invalid or has expired.");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.replace(`/${slug}/dashboard/client`), 1500);
  }

  const inputClass =
    "w-full rounded border-2 border-transparent focus:border-primary focus:outline-none p-2 bg-secondary text-foreground text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-96 bg-background border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            Set your password
          </CardTitle>
        </CardHeader>

        <CardContent>
          {!ready && !error && (
            <p className="text-sm text-muted-foreground animate-pulse">
              Verifying invite link...
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {done && (
            <p className="text-sm text-green-500">
              Password set! Redirecting...
            </p>
          )}

          {ready && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                className={inputClass}
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <input
                className={inputClass}
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={submitting || !password || !confirm}>
                  {submitting ? "Saving..." : "Set password"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
