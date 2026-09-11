import { TranslationScope, PreservationStrategy, TranslationTone, TranslationStyle } from './translation';

/**
 * 다중 기기(집/회사 노트북) 로컬 LLM Proxy API Key 프로필
 */
export interface DeviceKeyProfile {
  /** 고유 식별자 */
  id: string;
  /** 기기 사용자 친화적 명칭 (예: '집 노트북', '회사 노트북 1') */
  name: string;
  /** OS 호스트명 매칭값 (예: 'G2300227', 'HOME-PC') */
  hostname?: string;
  /** 프로바이더 1 전용 API 키 */
  provider1Key?: string;
  /** 프로바이더 2 전용 API 키 */
  provider2Key?: string;
  /** 프로바이더 1 전용 Base URL 또는 포트 번호 (예: 'http://127.0.0.1:11434/v1' 또는 '11434') */
  provider1Url?: string;
  /** 프로바이더 2 전용 Base URL 또는 포트 번호 */
  provider2Url?: string;
}

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

  // AI 서비스 프로바이더 2 (Secondary / Backup - 선택 사항)
  /** 보조 OpenAI 호환 API 엔드포인트 URL */
  secondaryApiBaseUrl: string;
  /** 보조 LLM API 인증 토큰 */
  secondaryApiKey: string;
  /** 보조 LLM 모델 식별자 */
  secondaryModelName: string;

  // 다중 프로바이더 운영 정책
  /** 기본 질의 대상 프로바이더 ('auto': 헬스체크 기반 자동 선정, 'primary': 프로바이더 1 고정, 'secondary': 프로바이더 2 고정) */
  activeProvider: 'primary' | 'secondary' | 'auto';
  /** 주 프로바이더 통신 장애 시 보조 프로바이더로 자동 전환(Failover) 여부 */
  enableFallback: boolean;
  /** 대용량 마크다운 청킹 번역 시 두 프로바이더에 청크를 교차 분산할지 여부 */
  enableChunkDistribution: boolean;

  // 다중 기기 환경설정 (Multi-Device Localhost Proxy Support)
  /** 기기별 API Key 매핑 프로필 목록 (클라우드 동기화됨) */
  deviceProfiles?: DeviceKeyProfile[];
  /** 기기별 키 분기 기능 활성화 여부 */
  useDeviceKeyOverride?: boolean;
  /** 401 인증 실패 시 등록된 후보 키 자동 진단(Auto-Probe) 여부 */
  autoProbeCandidateKeys?: boolean;

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

  // 보조 프로바이더 기본값 (비활성화 상태)
  secondaryApiBaseUrl: '',
  secondaryApiKey: '',
  secondaryModelName: 'auto',

  // 다중 프로바이더 정책 기본값
  activeProvider: 'auto',
  enableFallback: true,
  enableChunkDistribution: true,

  // 다중 기기 환경 기본값
  deviceProfiles: [],
  useDeviceKeyOverride: true,
  autoProbeCandidateKeys: true,

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
