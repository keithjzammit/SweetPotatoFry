"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ensureIcalToken, rotateIcalToken } from "@/server/ical";

export function CalendarSection({
  googleConnected,
  icalToken,
}: {
  googleConnected: boolean;
  icalToken: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState(icalToken);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const feedUrl = token ? `${baseUrl}/api/ical/${token}` : null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">Calendar</h2>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Google Calendar (events created from Works push to your primary calendar).</p>
        {googleConnected ? (
          <p className="text-sm">Connected ✓</p>
        ) : (
          <a href="/api/google/connect">
            <Button variant="outline" size="sm">Connect Google Calendar</Button>
          </a>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Public iCal feed URL — copy into Apple Calendar, Outlook, etc.
        </p>
        {feedUrl ? (
          <input
            readOnly
            value={feedUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const t = await ensureIcalToken();
                setToken(t);
                router.refresh();
              })
            }
          >
            Generate iCal feed URL
          </Button>
        )}
        {feedUrl && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const t = await rotateIcalToken();
                setToken(t);
                router.refresh();
              })
            }
          >
            Rotate (invalidates the previous URL)
          </Button>
        )}
      </div>
    </div>
  );
}
