import { TranslationScope, PreservationStrategy, TranslationTone, TranslationStyle } from './translation';

/**
 * Assistant Emily 플러그인 전역 설정 인터페이스
 * - 옵시디언 데이터 저장소(data.json)에 영구 보존되는 사용자 구성 값
 */
export interface EmilySettings {
  /** OpenAI 호환 API 엔드포인트 URL (예: https://api.openai.com/v1, http://localhost:11434/v1) */
  apiBaseUrl: string;
  /** LLM API 인증 토큰 (로컬 오프라인 LLM 사용 시 빈 문자열 허용) */
  apiKey: string;
  /** 사용할 LLM 모델 식별자 (auto, gpt-4o, gemini-3.6-flash 등) */
  modelName: string;
  /** 플러그인 UI 표시 언어 (auto: 옵시디언 언어 추종, ko: 한국어, en: 영어) */
  language: 'auto' | 'ko' | 'en';
  /** 한글/동아시아 마크다운 볼드(**) 공백 규칙 자동 교정 활성화 여부 */
  autoProofreadKoreanBold: boolean;
  /** 사이드바 우측 하단 플로팅 상하 스크롤 이동 버튼 표시 여부 */
  showFloatingScrollButtons: boolean;

  // 교열 기본 설정 (Proofreading Preferences)
  /** 사이드바 실행 시 맞춤법 검사 기본 선택 여부 */
  defaultProofreadSpelling: boolean;
  /** 사이드바 실행 시 문법 검사 기본 선택 여부 */
  defaultProofreadGrammar: boolean;
  /** 사이드바 실행 시 비디오 타임스탬프 삭제 기본 선택 여부 */
  defaultProofreadTimestamp: boolean;

  // 번역 기본 설정 (Translation Preferences)
  /** 번역 기능 기본 활성화 여부 */
  defaultTranslationEnabled: boolean;
  /** 기본 출발 언어 코드 (auto: 자동 감지) */
  defaultTranslationSource: string;
  /** 기본 도착 언어 코드 */
  defaultTranslationTarget: string;
  /** 번역 범위 정책 (selection: 선택 영역, all: 전체 문서, paragraph_bilingual: 단락별 1:1 병기) */
  defaultTranslationScope: TranslationScope;
  /** 번역 결과 보존 전략 (new_file: 새 파일 생성, append: 원문 하단 추가, overwrite: 원문 덮어쓰기) */
  defaultPreservationStrategy: PreservationStrategy;
  /** 번역 문체 (academic: 학술체, polite: 경어체, friendly: 친근체) */
  defaultTranslationTone: TranslationTone;
  /** 번역 스타일 (literal: 직역, balanced: 균형, natural: 의역) */
  defaultTranslationStyle: TranslationStyle;
  /** 코드 블록 내부 주석만 번역하고 코드는 보존할지 여부 */
  defaultTranslateCodeComments: boolean;
}

/**
 * 플러그인 최초 설치 시 적용되는 기본 설정값
 * - 개인정보 및 보안 토큰은 하드코딩되지 않으며 빈 값으로 초기화됩니다.
 */
export const DEFAULT_SETTINGS: EmilySettings = {
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'auto',
  language: 'auto',
  autoProofreadKoreanBold: true,
  showFloatingScrollButtons: true,

  // 교열 기본값
  defaultProofreadSpelling: false,
  defaultProofreadGrammar: false,
  defaultProofreadTimestamp: false,

  // 번역 기본값
  defaultTranslationEnabled: false,
  defaultTranslationSource: 'auto',
  defaultTranslationTarget: '',
  defaultTranslationScope: 'selection',
  defaultPreservationStrategy: 'new_file',
  defaultTranslationTone: 'academic',
  defaultTranslationStyle: 'balanced',
  defaultTranslateCodeComments: false
};
