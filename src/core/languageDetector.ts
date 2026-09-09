import { getTranslation } from '../i18n';

/**
 * 마크다운 본문의 문자 집합 빈도수를 분석하여 출발 문서의 언어를 감지합니다.
 * - 코드 블록, URL, YAML 프론트매터를 배제하여 오탐지(False Positive)를 방지
 * - 한글, 히라가나/가타카나, 한자, 키릴 문자, 유럽 특수문자 비율 기반 판별
 * @param text 분석할 마크다운 원문
 * @param displayLang UI 표시 언어
 * @returns 감지된 언어 코드 및 로컬라이즈된 언어명 ({ code: 'ko', name: '한국어' })
 */
export function detectDocumentLanguage(text: string, displayLang?: string): { code: string; name: string } {
  const t = getTranslation(displayLang);

  if (!text || !text.trim()) {
    const isKo = (displayLang && displayLang.startsWith('ko')) || (t.languages.auto === '언어 감지');
    return isKo ? { code: 'ko', name: t.languages.ko } : { code: 'en', name: t.languages.en };
  }

  // Strip markdown code blocks, URLs, and frontmatter to avoid false detection from code
  const cleanText = text
    .replace(/^---[\s\S]*?---/m, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();

  // Character regex patterns
  const hangulMatches = cleanText.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || [];
  const hiraganaKatakanaMatches = cleanText.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || [];
  const hanziMatches = cleanText.match(/[\u4E00-\u9FFF]/g) || [];
  const cyrillicMatches = cleanText.match(/[\u0400-\u04FF]/g) || [];
  const germanSpecialMatches = cleanText.match(/[äöüßÄÖÜ]/g) || [];
  const frenchSpecialMatches = cleanText.match(/[éèêëàâçîïôûùÉÈÊËÀÂÇÎÏÔÛÙ]/g) || [];
  const spanishSpecialMatches = cleanText.match(/[áéíóúñ¿¡ÁÉÍÓÚÑ]/g) || [];

  const totalLength = cleanText.replace(/\s+/g, '').length || 1;

  const hangulRatio = hangulMatches.length / totalLength;
  const jpRatio = hiraganaKatakanaMatches.length / totalLength;
  const hanziRatio = hanziMatches.length / totalLength;
  const cyrillicRatio = cyrillicMatches.length / totalLength;

  if (hangulRatio > 0.05 || hangulMatches.length > 10) {
    return { code: 'ko', name: t.languages.ko };
  }
  if (jpRatio > 0.03 || hiraganaKatakanaMatches.length > 5) {
    return { code: 'ja', name: t.languages.ja };
  }
  if (hanziRatio > 0.1 || hanziMatches.length > 20) {
    return { code: 'zh', name: t.languages.zh };
  }
  if (cyrillicRatio > 0.05 || cyrillicMatches.length > 10) {
    return { code: 'ru', name: t.languages.ru };
  }
  if (germanSpecialMatches.length > 5) {
    return { code: 'de', name: t.languages.de };
  }
  if (frenchSpecialMatches.length > 5) {
    return { code: 'fr', name: t.languages.fr };
  }
  if (spanishSpecialMatches.length > 5) {
    return { code: 'es', name: t.languages.es };
  }

  // Default for Latin text: English
  return { code: 'en', name: t.languages.en };
}

/**
 * 다양한 표기의 언어 명칭(한국어, Korean, ko 등)을 표준 2자리 소문자 언어 코드로 정규화합니다.
 * @param lang 언어 명칭 또는 코드 문자열
 * @returns 정규화된 언어 코드 (ko, en, ja, zh, de, fr, es, ru)
 */
export function normalizeLanguageCode(lang: string): string {
  if (!lang) return '';
  const l = lang.trim().toLowerCase();
  if (l.includes('한국') || l === 'ko' || l.includes('korean')) return 'ko';
  if (l.includes('영') || l === 'en' || l.includes('english')) return 'en';
  if (l.includes('일본') || l === 'ja' || l.includes('japanese')) return 'ja';
  if (l.includes('중국') || l === 'zh' || l.includes('chinese')) return 'zh';
  if (l.includes('독일') || l === 'de' || l.includes('german')) return 'de';
  if (l.includes('프랑스') || l === 'fr' || l.includes('french')) return 'fr';
  if (l.includes('스페인') || l === 'es' || l.includes('spanish')) return 'es';
  if (l.includes('러시아') || l === 'ru' || l.includes('russian')) return 'ru';
  return l;
}

/**
 * 출발 언어와 도착 언어가 동일한 언어인지 판별합니다.
 * - 동일 언어일 경우(예: 한국어 ➔ 한국어) 번역이 아닌 "문체/스타일 편집" 파이프라인으로 전환
 * @param sourceLang 출발 언어 명칭
 * @param targetLang 도착 언어 명칭
 * @returns 두 언어가 동일하면 true, 다르면 false
 */
export function isSameLanguage(sourceLang?: string, targetLang?: string): boolean {
  if (!sourceLang || !targetLang) return false;
  let s = sourceLang.trim();
  let t = targetLang.trim();
  const sMatch = s.match(/\(([^)]+)\)/);
  if (sMatch) s = sMatch[1].trim();
  const tMatch = t.match(/\(([^)]+)\)/);
  if (tMatch) t = tMatch[1].trim();

  const sLower = s.toLowerCase();
  const tLower = t.toLowerCase();
  if (sLower === 'auto' || sLower === '언어 감지' || sLower.includes('detect') || tLower === 'auto' || tLower === '언어 감지' || tLower.includes('detect')) {
    return false;
  }
  const src = normalizeLanguageCode(s);
  const tgt = normalizeLanguageCode(t);
  return src.length > 0 && tgt.length > 0 && src === tgt;
}

