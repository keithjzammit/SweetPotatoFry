"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/auth/supabase-browser";

export function SignInForm({ inviteToken }: { inviteToken?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async () => {
    setBusy(true);
    setErr(null);
    try {
      const supabase = getBrowserSupabase();
      const next = inviteToken ? `/dashboard` : `/dashboard`;
      const params = new URLSearchParams({ next });
      if (inviteToken) params.set("invite", inviteToken);
      const redirectTo = `${window.location.origin}/auth/callback?${params.toString()}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={handle} disabled={busy} size="lg" className="w-full">
        {busy ? "Redirecting…" : "Continue with Google"}
      </Button>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}
