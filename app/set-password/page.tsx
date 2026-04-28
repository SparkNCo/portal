"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { KeyRound } from "lucide-react";

function SetPasswordForm() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The SIGNED_IN event often fires before this listener is registered
    // (Supabase processes the hash synchronously on load), so check immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionEmail(session.user.email ?? "");
        setEmail(session.user.email ?? "");
        setReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        setSessionEmail(session.user.email ?? "");
        setEmail(session.user.email ?? "");
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (email !== sessionEmail) {
      setError("Email does not match the invited address.");
      return;
    }
    if (!userName.trim()) {
      setError("Username is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    const headers = {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
      apikey: process.env.NEXT_PUBLIC_APIKEY!,
      "Content-Type": "application/json",
    };

    const getRes = await fetch(
      `${process.env.NEXT_PUBLIC_ENDPOINT}/users?email=${encodeURIComponent(email)}`,
      { headers }
    );

    if (!getRes.ok) {
      setError("Password set, but could not load your profile.");
      setSubmitting(false);
      return;
    }

    const userData = await getRes.json();

    const patchRes = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/users`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: userData.id, userName }),
    });

    if (!patchRes.ok) {
      setError("Password set, but could not save your username.");
      setSubmitting(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.replace(`/${userName}/dashboard/client`), 1500);
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

          {done && (
            <p className="text-sm text-green-500">Password set! Redirecting...</p>
          )}

          {ready && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                className={inputClass}
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                className={inputClass}
                type="text"
                placeholder="Choose a username"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                autoComplete="username"
              />
              <input
                className={inputClass}
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !email || !userName || !password}
                >
                  {submitting ? "Saving..." : "Set password"}
                </Button>
              </div>
            </form>
          )}

          {!ready && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm />
    </Suspense>
  );
}
