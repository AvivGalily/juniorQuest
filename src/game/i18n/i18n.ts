import en from "./en.json";
import he from "./he.json";

export type Locale = "en" | "he";
export type TranslateParams = Record<string, string | number>;

type Catalog = Record<string, unknown>;

const STORAGE_KEY = "juniorquest_language_v1";
const DEFAULT_LOCALE: Locale = "en";
const catalogs: Record<Locale, Catalog> = {
  en: en as Catalog,
  he: he as Catalog
};

const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "he";
}

let currentLocale: Locale = readStoredLocale();

function readStoredLocale(): Locale {
  if (typeof localStorage === "undefined") {
    return DEFAULT_LOCALE;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

function readPath(catalog: Catalog, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, catalog);
  return typeof value === "string" ? value : undefined;
}

function format(message: string, params?: TranslateParams): string {
  if (!params) {
    return message;
  }
  return message.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function getLocale(): Locale {
  return currentLocale;
}

export function getDirection(locale: Locale = currentLocale): "ltr" | "rtl" {
  return locale === "he" ? "rtl" : "ltr";
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, locale);
  }
}

export function toggleLocale(): Locale {
  const next = currentLocale === "en" ? "he" : "en";
  setLocale(next);
  return next;
}

export function t(key: string, params?: TranslateParams): string {
  const translated = readPath(catalogs[currentLocale], key);
  if (translated !== undefined) {
    return format(translated, params);
  }

  const fallback = readPath(catalogs.en, key);
  if (isDev) {
    console.warn(`Missing translation key "${key}" for locale "${currentLocale}".`);
  }
  return format(fallback ?? key, params);
}
