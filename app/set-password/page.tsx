"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase, PORTAL_SCHEMA } from "@/lib/supabase-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { KeyRound } from "lucide-react";
import { useUser } from "context/UserContext";

function SetPasswordForm() {
  const router = useRouter();
  const { reloadUser } = useUser();

  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"customer" | "developer" | "admin" | null>(
    null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [clientName, setClientName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const isCustomer = role === "customer";

  async function resolveSession(session: {
    user: { id: string; email?: string };
  }) {
    setEmail(session.user.email ?? "");
    setUserId(session.user.id);

    const { data } = await supabase
      .schema(PORTAL_SCHEMA)
      .from("users")
      .select("role, firstName, lastName, userName, phoneNumber")
      .eq("id", session.user.id)
      .maybeSingle();

    setRole(data?.role ?? null);
    if (data?.firstName) setFirstName(data.firstName);
    if (data?.lastName) setLastName(data.lastName);
    if (data?.userName) setClientName(data.userName);
    if (data?.phoneNumber) setPhoneNumber(data.phoneNumber);
    setReady(true);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) resolveSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        resolveSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (!clientName.trim()) {
      setError("Client name is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
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

    const slugifiedClientName = clientName.trim().replaceAll(" ", "-");
    const profileUpdate: Record<string, string> = {
      firstName,
      lastName,
      userName: slugifiedClientName,
    };
    if (phoneNumber.trim()) profileUpdate.phoneNumber = phoneNumber.trim();

    let redirectPath = `/${slugifiedClientName}/dashboard/dashboards`;
    if (isCustomer) {
      redirectPath = `/${slugifiedClientName}/dashboard/dashboards?customer=${slugifiedClientName}&panel=client`;
    }

    const patchRes = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/users`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: userId, ...profileUpdate }),
    });

    if (!patchRes.ok) {
      setError("Password set, but could not save your profile.");
      setSubmitting(false);
      return;
    }

    setDone(true);
    await reloadUser();
    router.replace(redirectPath);
  }

  const inputClass =
    "w-full rounded border-2 border-transparent focus:border-primary focus:outline-none p-2 bg-secondary text-foreground text-sm";

  const readOnlyClass =
    "w-full rounded p-2 bg-secondary/50 text-muted-foreground text-sm cursor-not-allowed select-none";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-96 bg-background border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            User Data
          </CardTitle>
        </CardHeader>

        <CardContent>
          {!ready && !error && (
            <p className="text-sm text-muted-foreground animate-pulse">
              Verifying invite link...
            </p>
          )}

          {done && (
            <p className="text-sm text-green-500">
              Password set! Redirecting...
            </p>
          )}

          {ready && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email — read only */}
              <input
                className={readOnlyClass}
                type="email"
                value={email}
                readOnly
                tabIndex={-1}
              />

              <div className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <input
                className={inputClass}
                placeholder={isCustomer ? "Client name" : "User name"}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />

              <input
                className={inputClass}
                placeholder="Phone number (optional)"
                value={phoneNumber}
                onChange={(e) =>
                  setPhoneNumber(e.target.value.replaceAll(/[^0-9+\-() ]/g, ""))
                }
              />

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

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    submitting ||
                    !firstName ||
                    !lastName ||
                    !clientName ||
                    !password ||
                    !confirm
                  }
                >
                  {submitting ? "Saving..." : "Save"}
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
