import { TranslationStrings } from './types';
import { ko } from './locales/ko';
import { en } from './locales/en';

export interface LanguageOption {
  code: string;
  name: string;
}

/**
 * Detects current Obsidian UI language code.
 * Strict Policy: Korean is only returned if explicitly detected.
 * All other languages or unknown states strictly fallback to 'en'.
 */
export function getObsidianLanguage(): string {
  // 1. HTML lang attribute (Obsidian sets <html lang="..."> according to user preference)
  if (typeof document !== 'undefined' && document.documentElement?.lang) {
    const htmlLang = document.documentElement.lang.toLowerCase();
    if (htmlLang) {
      return htmlLang;
    }
  }

  // 2. Moment locale from Obsidian window (only if explicitly starts with ko)
  const win = typeof window !== 'undefined' ? (window as unknown as { moment?: { locale?: () => string } }) : null;
  if (win?.moment?.locale) {
    const mLocale = win.moment.locale();
    if (mLocale && mLocale.toLowerCase().startsWith('ko')) {
      return 'ko';
    }
  }

  // 3. Navigator language (only if explicitly starts with ko)
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.toLowerCase().startsWith('ko')) {
      return 'ko';
    }
  }

  // STRICT DEFAULT: English. Korean only when explicitly configured or detected!
  return 'en';
}

/**
 * Returns translation resource strictly following the policy:
 * - Korean (ko) when Korean is configured/detected
 * - 100% English (en) for all other languages
 */
export function getTranslation(configuredLang?: string): TranslationStrings {
  const langCode = configuredLang && configuredLang !== 'auto'
    ? configuredLang.toLowerCase()
    : getObsidianLanguage();

  if (langCode.startsWith('ko')) {
    return ko;
  }

  // Pure 100% English for any non-Korean selection
  return en;
}

/**
 * Returns localized source language list
 */
export function getSourceLanguages(t: TranslationStrings): LanguageOption[] {
  return [
    { code: 'auto', name: t.languages.auto },
    { code: 'ko', name: t.languages.ko },
    { code: 'en', name: t.languages.en },
    { code: 'ja', name: t.languages.ja },
    { code: 'zh', name: t.languages.zh },
    { code: 'zh-tw', name: t.languages.zhTw },
    { code: 'de', name: t.languages.de },
    { code: 'fr', name: t.languages.fr },
    { code: 'es', name: t.languages.es },
    { code: 'ru', name: t.languages.ru }
  ];
}

/**
 * Returns localized target language list
 */
export function getSupportedLanguages(t: TranslationStrings): LanguageOption[] {
  return [
    { code: 'ko', name: t.languages.ko },
    { code: 'en', name: t.languages.en },
    { code: 'ja', name: t.languages.ja },
    { code: 'zh', name: t.languages.zh },
    { code: 'zh-tw', name: t.languages.zhTw },
    { code: 'de', name: t.languages.de },
    { code: 'fr', name: t.languages.fr },
    { code: 'es', name: t.languages.es },
    { code: 'ru', name: t.languages.ru }
  ];
}

/**
 * Normalizes language names and codes into standard language keys (auto, ko, en, ja, zh, etc.)
 */
export function normalizeLanguageCode(lang: string): string {
  if (!lang) return '';
  const l = lang.trim().toLowerCase();
  if (l === 'auto' || l === '언어 감지' || l === '자동 감지' || l.includes('detect')) return 'auto';
  if (l.includes('한국') || l === 'ko' || l.includes('korean')) return 'ko';
  if (l.includes('영') || l === 'en' || l.includes('english')) return 'en';
  if (l.includes('일본') || l === 'ja' || l.includes('japanese')) return 'ja';
  if (l.includes('간체') || l === 'zh-cn' || l === 'zh' || l.includes('chinese')) return 'zh';
  if (l.includes('번체') || l === 'zh-tw') return 'zh-tw';
  if (l.includes('독일') || l === 'de' || l.includes('german')) return 'de';
  if (l.includes('프랑스') || l === 'fr' || l.includes('french')) return 'fr';
  if (l.includes('스페인') || l === 'es' || l.includes('spanish')) return 'es';
  if (l.includes('러시아') || l === 'ru' || l.includes('russian')) return 'ru';
  return l;
}

/**
 * Resolves any language identifier (code, Korean name, English name) to the localized name
 * matching the provided TranslationStrings.
 */
export function getLocalizedLanguageName(lang: string | undefined, t: TranslationStrings): string {
  if (!lang) return '';
  const trimmed = lang.trim();
  const code = normalizeLanguageCode(trimmed);
  if (code === 'auto') {
    return t.languages.auto;
  }
  const supported = getSupportedLanguages(t);
  const matched = supported.find((item) => item.code === code);
  if (matched) {
    return matched.name;
  }
  return trimmed;
}

/**
 * Returns default target language name based on Obsidian menu/UI language.
 */
export function getDefaultTargetLanguageName(t?: TranslationStrings): string {
  const activeT = t || getTranslation();
  const code = getObsidianLanguage();
  const baseCode = code.split('-')[0];
  const list = getSupportedLanguages(activeT);
  const matched = list.find((l) => l.code === code || l.code === baseCode);
  if (matched) return matched.name;
  return code.startsWith('ko') ? activeT.languages.ko : activeT.languages.en;
}



