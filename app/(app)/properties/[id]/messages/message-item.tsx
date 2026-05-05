"use client";
import { useState } from "react";
import { FormattedDate } from "@/components/date";
import type { Locale } from "@/i18n/config";

type Props = {
  message: {
    id: string;
    senderName: string;
    bodyOriginal: string;
    bodyLang: string;
    translation: string | null;
    createdAt: string;
  };
  activeLocale: Locale;
};

// Spec §10: original always shown; "Translate" toggle reveals translation inline.
export function MessageItem({ message, activeLocale }: Props) {
  const [showTranslation, setShowTranslation] = useState(false);
  const sameLang = message.bodyLang.startsWith(activeLocale);
  const canTranslate = !sameLang && !!message.translation && message.translation !== message.bodyOriginal;

  return (
    <li className="rounded-lg border bg-card p-3">
      <header className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{message.senderName}</span>
        <FormattedDate value={message.createdAt} />
      </header>
      <p className="mt-1 whitespace-pre-wrap text-sm">{message.bodyOriginal}</p>
      {canTranslate && (
        <>
          <button
            type="button"
            onClick={() => setShowTranslation((v) => !v)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            {showTranslation
              ? activeLocale === "es"
                ? "Ver original"
                : "Show original"
              : activeLocale === "es"
                ? "Traducir"
                : "Translate"}
          </button>
          {showTranslation && (
            <p className="mt-1 whitespace-pre-wrap rounded bg-muted px-2 py-1 text-sm text-muted-foreground">
              {message.translation}
            </p>
          )}
        </>
      )}
    </li>
  );
}
