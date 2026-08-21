"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff, AlertTriangle, Mail, Building2 } from "lucide-react";
import { useUser } from "context/UserContext";

// Supabase redirects an invite link it can no longer honor (expired/already
// used) back to `redirectTo` with `error_code` in either the query string or
// the hash fragment — it never gets far enough to fire a SIGNED_IN/SIGNED_OUT
// auth event, so without this check the page is stuck on "Verifying invite
// link..." forever.
function getInviteErrorCode(searchParams: URLSearchParams): string | null {
  const fromQuery = searchParams.get("error_code");
  if (fromQuery) return fromQuery;
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_code");
}

function SetPasswordForm() {
  const router = useRouter();
  const { reloadUser } = useUser();
  const searchParams = useSearchParams();

  const [expiredInvite] = useState(() => getInviteErrorCode(searchParams) === "otp_expired");
  const [showExpiredModal, setShowExpiredModal] = useState(expiredInvite);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"customer" | "developer" | "admin" | null>(
    null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [clientName, setClientName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
      .schema("portal")
      .from("users")
      .select("role, firstName, lastName, userName, phoneNumber, customer_id")
      .eq("id", session.user.id)
      .maybeSingle();

    setRole(data?.role ?? null);
    if (data?.firstName) setFirstName(data.firstName);
    if (data?.lastName) setLastName(data.lastName);
    if (data?.userName) setClientName(data.userName);
    if (data?.phoneNumber) setPhoneNumber(data.phoneNumber);
    if (data?.customer_id) setCustomerId(data.customer_id);
    setReady(true);
  }

  useEffect(() => {
    // An expired invite link never establishes a session — no point waiting
    // on one.
    if (expiredInvite) return;

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
      setError(isCustomer ? "Client name is required." : "GitHub handle is required.");
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

    const slugifiedClientName = clientName.trim().toLowerCase().replaceAll(" ", "-");
    const profileUpdate: Record<string, string> = {
      firstName,
      lastName,
      userName: slugifiedClientName,
    };
    if (phoneNumber.trim()) profileUpdate.phoneNumber = phoneNumber.trim();

    let redirectPath = `/${slugifiedClientName}/dashboard/dashboards`;
    if (isCustomer) {
      redirectPath = `/${slugifiedClientName}/dashboard`;
    } else if (role === "admin") {
      redirectPath = "/admin/users";
    } else if (role === "developer") {
      redirectPath = "/dev/developer";
    }

    const patchRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users`, {
      method: "PATCH",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ id: userId, ...profileUpdate }),
    });

    if (!patchRes.ok) {
      setError("Password set, but could not save your profile.");
      setSubmitting(false);
      return;
    }

    if (isCustomer && customerId) {
      try {
        // The edge function derives the caller's own customer_id from this
        // token rather than trusting customer_id in the body — the anon key
        // in API_JSON_HEADERS isn't a real session, so it has to be swapped
        // out here for the one this page already established above.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const customerPatchRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customer`,
          {
            method: "PATCH",
            headers: {
              ...API_JSON_HEADERS,
              Authorization: `Bearer ${session?.access_token ?? ""}`,
            },
            body: JSON.stringify({
              customer_id: customerId,
              clientName: clientName.trim(),
            }),
          },
        );

        if (!customerPatchRes.ok) {
          const body = await customerPatchRes.json().catch(() => null);
          setError(body?.error ?? "Password set, but could not save the client name.");
          setSubmitting(false);
          return;
        }
      } catch {
        setError("Password set, but could not save the client name.");
        setSubmitting(false);
        return;
      }
    }

    setDone(true);
    await reloadUser();
    router.replace(redirectPath);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-96 bg-background text-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="body font-semibold flex items-center gap-2 text-primary">
            <KeyRound className="h-4 w-4 text-primary" />
            User Data
          </CardTitle>
        </CardHeader>

        <CardContent>
          {expiredInvite && (
            <p className="text-sm text-destructive">
              This invite link has expired. Please contact your administrator for a new login link.
            </p>
          )}

          {!expiredInvite && !ready && !error && (
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
              {/* Email is never editable here — shown as a label, not an input. */}
              <div className="flex items-center gap-2 text-primary smalltext font-medium">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{email}</span>
              </div>

              {isCustomer ? (
                // Customers can't rename their own client — shown as a label too.
                <div className="flex items-center gap-2 text-primary smalltext font-medium">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{clientName}</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>GitHub Handle</Label>
                  <Input
                    className="bg-white text-black border-0"
                    placeholder="e.g. janedoe"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>First Name</Label>
                  <Input
                    className="bg-white text-black border-0"
                    placeholder="e.g. Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label>Last Name</Label>
                  <Input
                    className="bg-white text-black border-0"
                    placeholder="e.g. Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Phone Number{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  className="bg-white text-black border-0"
                  placeholder="e.g. (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) =>
                    setPhoneNumber(e.target.value.replaceAll(/[^0-9+\-() ]/g, ""))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    className="bg-white text-black border-0 pr-10"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 text-gray-500 hover:text-black transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <div className="relative">
                  <Input
                    className="bg-white text-black border-0 pr-10"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 text-gray-500 hover:text-black transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

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

      {showExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-96 bg-background text-foreground border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Invite link expired
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This invite link has expired. Please contact your administrator for a new login link.
              </p>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowExpiredModal(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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
