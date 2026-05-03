"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/server/profile";
import type { Locale } from "@/i18n/config";

export function LocaleToggle({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: Locale) =>
    startTransition(async () => {
      await setLocale({ locale: next });
      router.refresh();
    });

  return (
    <div className="flex gap-2 text-sm">
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending || current === l}
          onClick={() => change(l)}
          className={`rounded-md border px-3 py-1.5 ${
            current === l
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background hover:bg-accent"
          } disabled:opacity-60`}
        >
          {l === "en" ? "English" : "Español"}
        </button>
      ))}
    </div>
  );
}
