"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushEnable() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setEnabled(!!sub);
    });
    if (isIos() && !isStandalone()) {
      setHint("On iPhone, install the app first (Share → Add to Home Screen) to receive push notifications.");
    }
  }, []);

  if (!supported) return null;

  const enable = async () => {
    if (!PUBLIC_KEY) {
      setHint("Push not configured on this server (missing VAPID key).");
      return;
    }
    setBusy(true);
    try {
      // Register the SW lazily — root layout doesn't ship it to keep the
      // bundle minimal; service worker is served from /sw.js.
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setHint("Permission denied.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) as unknown as ArrayBuffer,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify(sub.toJSON()),
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      setEnabled(true);
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Failed to enable push");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={enable} disabled={busy || enabled} variant="outline">
        {enabled ? "Push enabled" : busy ? "Enabling…" : "Enable push notifications"}
      </Button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
