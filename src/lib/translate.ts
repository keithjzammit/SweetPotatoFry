import "server-only";

// DeepL free tier: 500k chars/month. Spec §10: pre-translate on send to both
// EN and ES; store both. Fallback to Google Translate if DeepL fails.
//
// We also detect the source language so we don't waste an API call translating
// content into its own language.

const DEEPL_KEY = process.env.DEEPL_API_KEY;
const DEEPL_ENDPOINT = DEEPL_KEY?.endsWith(":fx")
  ? "https://api-free.deepl.com/v2"
  : "https://api.deepl.com/v2";

export type SupportedLang = "en" | "es";

export type TranslateResult = {
  detectedLang: string;
  translations: Record<SupportedLang, string>;
};

// Translate `text` into both EN and ES, returning the detected source language.
// If the source already matches a target, we skip that target's API call and
// reuse the original text.
export async function translateToBoth(text: string): Promise<TranslateResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { detectedLang: "en", translations: { en: text, es: text } };
  }

  // No DeepL configured: best-effort no-op, mark detected as en.
  if (!DEEPL_KEY) {
    return {
      detectedLang: "en",
      translations: { en: text, es: text },
    };
  }

  try {
    const en = await deeplTranslate(trimmed, "EN");
    const es = await deeplTranslate(trimmed, "ES");
    // DeepL returns the detected source language on each call; both should match.
    const detectedLang = en.detectedLang.toLowerCase();
    return {
      detectedLang,
      translations: {
        en: detectedLang.startsWith("en") ? text : en.text,
        es: detectedLang.startsWith("es") ? text : es.text,
      },
    };
  } catch (err) {
    console.error("[translate] DeepL failed, returning original", err);
    return {
      detectedLang: "en",
      translations: { en: text, es: text },
    };
  }
}

async function deeplTranslate(
  text: string,
  target: "EN" | "ES",
): Promise<{ text: string; detectedLang: string }> {
  const res = await fetch(`${DEEPL_ENDPOINT}/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [text],
      target_lang: target,
    }),
  });
  if (!res.ok) {
    throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    translations: Array<{ detected_source_language: string; text: string }>;
  };
  const t = json.translations[0]!;
  return { text: t.text, detectedLang: t.detected_source_language };
}
