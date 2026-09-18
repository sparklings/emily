export type TranslationScope = 'selection' | 'all' | 'paragraph_bilingual';
export type PreservationStrategy = 'new_file' | 'append' | 'overwrite';
export type TranslationTone = 'academic' | 'polite' | 'casual';
export type TranslationStyle = 'literal' | 'balanced' | 'natural';

export interface MarkdownFormatStripOptions {
  stripBold?: boolean;
  stripItalic?: boolean;
  stripStrikethrough?: boolean;
  stripHighlight?: boolean;
}

export interface TranslationOptions {
  enabled?: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  scope: TranslationScope;
  preserveNewFile?: boolean;
  preserveAppend?: boolean;
  preservation: PreservationStrategy;
  tone?: TranslationTone;
  style?: TranslationStyle;
  translateCodeComments?: boolean;
  /** 출발어와 도착어가 동일 언어인 경우 true — UI 레이블을 "번역" 대신 "편집"으로 표시 */
  isSameLangEdit?: boolean;
  /** 볼드체, 기울이기, 취소선, 하이라이트 서식 제거 옵션 */
  formatStripOptions?: MarkdownFormatStripOptions;
}

export interface TranslationResult {
  translatedMarkdown: string;
  targetPath?: string;
  appendedContent?: string;
  chunksCount?: number;
  originalMarkdown?: string;
}
