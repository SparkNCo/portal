"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
     // router.push("/dashboard/client?id=f12c1e4fa44b");
    }
  };

  const signup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (!error) alert("Check your email 👀");
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

        <button
          type="submit"
          className="w-full rounded bg-black text-white p-2"
        >
          Login
        </button>

        <button
          type="button"
          onClick={signup}
          className="w-full rounded border p-2"
        >
          Sign up
        </button>
      </form>
    </div>
  );
}
