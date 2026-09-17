import { EmilySettings, DeviceKeyProfile } from '../types/settings';

export const DEVICE_HOSTNAME_STORAGE_KEY = 'assistant-emily-device-hostname';
export const ACTIVE_PROFILE_STORAGE_KEY = 'assistant-emily-active-profile-id';

/**
 * 현재 기기(로컬 스토리지)에 영구 바인딩된 활성 프로필 ID를 조회합니다.
 * - OneDrive 등 클라우드에 동기화되지 않으며 오직 해당 PC의 브라우저/앱 로컬에만 보관됩니다.
 */
export function getActiveProfileId(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    }
  } catch {
    // 샌드박스 보안 예외 무시
  }
  return '';
}

/**
 * 현재 기기(로컬 스토리지)에 활성 프로필 ID를 바인딩 저장합니다.
 * - '__global__'로 지정 시 전역 기본값 강제 사용
 * - 빈 문자열 지정 시 바인딩 해제 (호스트명 fallback)
 */
export function setActiveProfileId(profileId: string): void {
  const trimmed = profileId.trim();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (trimmed) {
        window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
      }
    }
  } catch {
    // 무시
  }
}

/**
 * 현재 기기에 활성화된 프로필 객체를 반환합니다.
 * 1순위: localStorage에 바인딩된 프로필
 * 2순위: 호스트명 매칭 프로필
 * 없거나 전역 기본값 선택 시 null 반환
 */
export function getActiveProfile(settings: EmilySettings): DeviceKeyProfile | null {
  const activeId = getActiveProfileId();
  const profiles = settings.deviceProfiles || [];
  if (activeId === '__global__') {
    return null;
  }
  if (activeId && profiles.length > 0) {
    const found = profiles.find((p) => p.id === activeId);
    if (found) return found;
  }
  const currentHost = getDeviceHostname(settings).toLowerCase().trim();
  if (currentHost && profiles.length > 0) {
    const found = profiles.find((p) => (p.hostname || '').toLowerCase().trim() === currentHost);
    if (found) return found;
  }
  return null;
}

/**
 * 현재 기기의 사용자 지정 식별자(호스트명)를 조회합니다.
 * - 시스템 고유 정보(os.hostname, process.env 등)를 조회하지 않고 사용자가 직접 입력한 기기 식별자를 사용합니다.
 * - 1순위: 기기 로컬 저장소(localStorage) - 기기별 독립 저장 (클라우드 미동기화)
 * - 2순위: 플러그인 설정(settings.currentDeviceHostname)
 */
export function getDeviceHostname(settings?: EmilySettings): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(DEVICE_HOSTNAME_STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    }
  } catch {
    // 샌드박스 또는 보안 제한 시 무시
  }
  if (settings && settings.currentDeviceHostname && settings.currentDeviceHostname.trim().length > 0) {
    return settings.currentDeviceHostname.trim();
  }
  return '';
}

/**
 * 현재 기기의 사용자 지정 식별자(호스트명)를 저장합니다.
 */
export function setDeviceHostname(hostname: string, settings?: EmilySettings): void {
  const trimmed = hostname.trim();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (trimmed) {
        window.localStorage.setItem(DEVICE_HOSTNAME_STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(DEVICE_HOSTNAME_STORAGE_KEY);
      }
    }
  } catch {
    // 무시
  }
  if (settings) {
    settings.currentDeviceHostname = trimmed;
  }
}

/**
 * 현재 기기의 대표 식별자 이름 반환 (설정된 식별자 > 'Local Device')
 */
export function getDeviceDisplayName(settings?: EmilySettings): string {
  const host = getDeviceHostname(settings);
  if (host) return host;
  return 'Local Device';
}

/**
 * 주어진 URL에서 포트 번호를 추출합니다.
 */
export function extractPort(url: string): string | null {
  if (!url) return null;
  try {
    const full = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    const parsed = new URL(full);
    return parsed.port ? parsed.port : null;
  } catch {
    const match = url.match(/:(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }
}

/**
 * 기본 URL에 새로운 포트 또는 전체 URL을 지능적으로 대입합니다.
 * - portOrUrl이 숫자(예: '11434', ':11434')인 경우: baseEndpoint의 호스트 및 경로(/v1 등)를 유지하며 포트만 교체
 * - portOrUrl이 전체 URL(http:// 또는 https://)인 경우: 전체 URL로 치환
 */
export function applyPortOrUrl(baseEndpoint: string, portOrUrl: string): string {
  if (!portOrUrl || !portOrUrl.trim()) return baseEndpoint.replace(/\/+$/, '');
  const trimmed = portOrUrl.trim();

  // 1. 전체 URL 형식 (http:// 또는 https://)
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  // 2. 포트 번호 형식 (예: '11434' 또는 ':11434')
  const portMatch = trimmed.match(/^:?(\d+)$/);
  if (portMatch) {
    const targetPort = portMatch[1];
    try {
      const full = /^https?:\/\//i.test(baseEndpoint) ? baseEndpoint : `http://${baseEndpoint}`;
      const urlObj = new URL(full);
      urlObj.port = targetPort;
      return urlObj.toString().replace(/\/+$/, '');
    } catch {
      // URL 파싱 불가 시 정규식 교체 fallback
      if (/:\d+/.test(baseEndpoint)) {
        return baseEndpoint.replace(/:\d+/, `:${targetPort}`).replace(/\/+$/, '');
      } else {
        return baseEndpoint.replace(/^([a-z]+:\/\/[^/]+)/i, `$1:${targetPort}`).replace(/\/+$/, '');
      }
    }
  }

  // 기타 문자열은 공백 및 슬래시 정규화 후 반환
  return trimmed.replace(/\/+$/, '');
}

/**
 * 로컬 엔드포인트(localhost, 127.0.0.1, 0.0.0.0) 여부 확인
 */
export function isLocalEndpoint(url: string): boolean {
  if (!url) return false;
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(url);
}

/**
 * 레거시 기기 프로필(provider1Url, provider1Key 등)을 단일 url / apiKey 구조로 1회성 마이그레이션합니다.
 * 변경 사항이 발생하면 true를 반환합니다.
 */
export function migrateDeviceProfiles(settings: EmilySettings): boolean {
  if (!settings.deviceProfiles || !Array.isArray(settings.deviceProfiles)) {
    return false;
  }
  let modified = false;
  for (const prof of settings.deviceProfiles) {
    if (!prof.url && prof.provider1Url) {
      prof.url = prof.provider1Url;
      modified = true;
    }
    if (!prof.apiKey && prof.provider1Key) {
      prof.apiKey = prof.provider1Key;
      modified = true;
    }
  }
  return modified;
}

export interface EffectiveApiKeyResult {
  key: string;
  source: 'profile' | 'global';
  profileName?: string;
  hostnameMatched?: string;
}

/**
 * 2-Tier 분기 전략에 따라 현재 환경에서 최우선으로 유효한 API Key를 판별합니다.
 * 1순위: 기기 식별자(호스트명)와 일치하는 기기 프로필 키 (data.json 동기화)
 * 2순위: data.json에 동기화된 전역 기본 키
 */
export function resolveEffectiveApiKey(
  settings: EmilySettings,
  customHost?: string
): EffectiveApiKeyResult {
  const globalKey = settings.apiKey || '';

  // 기기별 분기 기능이 비활성화된 경우 전역 키 사용
  if (settings.useDeviceKeyOverride === false) {
    return { key: globalKey, source: 'global' };
  }

  const profiles = settings.deviceProfiles || [];

  // 1순위: 로컬 스토리지에 바인딩된 활성 프로필 ID (명시적 customHost가 없을 때 최우선)
  if (!customHost) {
    const activeId = getActiveProfileId();
    if (activeId === '__global__') {
      return { key: globalKey, source: 'global' };
    }
    if (activeId && profiles.length > 0) {
      const activeProf = profiles.find((p) => p.id === activeId);
      if (activeProf) {
        const pKey = activeProf.apiKey || activeProf.provider1Key;
        if (pKey && pKey.trim().length > 0) {
          return {
            key: pKey.trim(),
            source: 'profile',
            profileName: activeProf.name,
            hostnameMatched: activeProf.hostname
          };
        }
      }
    }
  }

  // 2순위: 기기 프로필 목록에서 호스트명 매칭 확인
  const currentHost = (customHost || getDeviceHostname(settings)).toLowerCase().trim();

  if (profiles.length > 0 && currentHost) {
    const matchedProfile = profiles.find((p) => {
      const pHost = (p.hostname || '').trim().toLowerCase();
      return pHost && pHost === currentHost;
    });

    if (matchedProfile) {
      const pKey = matchedProfile.apiKey || matchedProfile.provider1Key;
      if (pKey && pKey.trim().length > 0) {
        return {
          key: pKey.trim(),
          source: 'profile',
          profileName: matchedProfile.name,
          hostnameMatched: matchedProfile.hostname
        };
      }
    }
  }

  // 3순위: 기본 전역 동기화 키 반환
  return { key: globalKey, source: 'global' };
}

export interface CandidateKeyItem {
  key: string;
  label: string;
  source: 'profile' | 'global';
  profileId?: string;
}

/**
 * 401 오류 시 자동 시도(Auto-Probe)를 위한 후보 키 목록을 중복 없이 추출합니다.
 */
export function getCandidateKeys(
  settings: EmilySettings
): CandidateKeyItem[] {
  const results: CandidateKeyItem[] = [];
  const seenKeys = new Set<string>();

  const addKey = (k: string | null | undefined, label: string, source: 'profile' | 'global', profileId?: string) => {
    if (!k) return;
    const clean = k.trim();
    if (clean.length > 0 && !seenKeys.has(clean)) {
      seenKeys.add(clean);
      results.push({ key: clean, label, source, profileId });
    }
  };

  // 1. 등록된 모든 기기 프로필의 키
  const profiles = settings.deviceProfiles || [];
  for (const prof of profiles) {
    const k = prof.apiKey || prof.provider1Key;
    if (k) {
      addKey(k, `${prof.name}${prof.hostname ? ` (${prof.hostname})` : ''}`, 'profile', prof.id);
    }
  }

  // 2. 전역 기본 키
  const globalKey = settings.apiKey;
  if (globalKey) {
    addKey(globalKey, '기본 공용 키 (Global Synced)', 'global');
  }

  return results;
}

export interface EffectiveEndpointResult {
  url: string;
  source: 'profile' | 'global';
  profileName?: string;
  hostnameMatched?: string;
  isPortOverride?: boolean;
  port?: string;
}

/**
 * 2-Tier 분기 전략에 따라 현재 환경에서 최우선으로 유효한 엔드포인트 URL/포트를 판별합니다.
 * 1순위: 기기 식별자(호스트명)와 일치하는 기기 프로필의 URL/포트 (data.json 동기화)
 * 2순위: data.json에 동기화된 전역 기본 URL
 */
export function resolveEffectiveEndpoint(
  settings: EmilySettings,
  customHost?: string
): EffectiveEndpointResult {
  const globalUrl = settings.apiBaseUrl || 'https://api.openai.com/v1';
  const cleanGlobalUrl = globalUrl.trim().replace(/\/+$/, '');

  // 기기별 분기 비활성화 시 전역 URL 사용
  if (settings.useDeviceKeyOverride === false) {
    return {
      url: cleanGlobalUrl,
      source: 'global',
      port: extractPort(cleanGlobalUrl) || undefined
    };
  }

  const profiles = settings.deviceProfiles || [];

  // 1순위: 로컬 스토리지에 바인딩된 활성 프로필 ID (명시적 customHost가 없을 때 최우선)
  if (!customHost) {
    const activeId = getActiveProfileId();
    if (activeId === '__global__') {
      return {
        url: cleanGlobalUrl,
        source: 'global',
        port: extractPort(cleanGlobalUrl) || undefined
      };
    }
    if (activeId && profiles.length > 0) {
      const activeProf = profiles.find((p) => p.id === activeId);
      if (activeProf) {
        const pUrl = activeProf.url || activeProf.provider1Url;
        if (pUrl && pUrl.trim().length > 0) {
          const effective = applyPortOrUrl(cleanGlobalUrl, pUrl);
          const isPortOnly = /^\d+$/.test(pUrl.trim().replace(/^:/, ''));
          return {
            url: effective,
            source: 'profile',
            profileName: activeProf.name,
            hostnameMatched: activeProf.hostname,
            isPortOverride: isPortOnly,
            port: extractPort(effective) || undefined
          };
        }
      }
    }
  }

  // 2순위: 기기 프로필 목록에서 호스트명 매칭 확인
  const currentHost = (customHost || getDeviceHostname(settings)).toLowerCase().trim();

  if (profiles.length > 0 && currentHost) {
    const matchedProfile = profiles.find((p) => {
      const pHost = (p.hostname || '').trim().toLowerCase();
      return pHost && pHost === currentHost;
    });

    if (matchedProfile) {
      const pUrl = matchedProfile.url || matchedProfile.provider1Url;
      if (pUrl && pUrl.trim().length > 0) {
        const effective = applyPortOrUrl(cleanGlobalUrl, pUrl);
        const isPortOnly = /^\d+$/.test(pUrl.trim().replace(/^:/, ''));
        return {
          url: effective,
          source: 'profile',
          profileName: matchedProfile.name,
          hostnameMatched: matchedProfile.hostname,
          isPortOverride: isPortOnly,
          port: extractPort(effective) || undefined
        };
      }
    }
  }

  // 3순위: 기본 전역 동기화 URL 반환
  return {
    url: cleanGlobalUrl,
    source: 'global',
    port: extractPort(cleanGlobalUrl) || undefined
  };
}

/**
 * 주요 로컬 LLM 프록시 및 서버 대표 포트 목록
 */
export const COMMON_LOCAL_PORTS = [31416, 11434, 1234, 8000, 8080, 5000, 9999];

/**
 * 자동 포트 탐색(Port Auto-Probe)을 위한 후보 포트 목록을 중복 없이 추출합니다.
 */
export function getCandidatePorts(settings: EmilySettings, currentUrl?: string): number[] {
  const portsSet = new Set<number>();

  if (currentUrl) {
    const currentPort = extractPort(currentUrl);
    if (currentPort) portsSet.add(parseInt(currentPort, 10));
  }

  // 프로필에 등록된 포트/URL에서 추출
  for (const prof of settings.deviceProfiles || []) {
    for (const u of [prof.url, prof.provider1Url, prof.provider2Url]) {
      if (u && u.trim()) {
        const clean = u.trim().replace(/^:/, '');
        if (/^\d+$/.test(clean)) {
          portsSet.add(parseInt(clean, 10));
        } else {
          const p = extractPort(clean);
          if (p) portsSet.add(parseInt(p, 10));
        }
      }
    }
  }

  // 주요 로컬 대표 포트 병합
  for (const p of COMMON_LOCAL_PORTS) {
    portsSet.add(p);
  }

  return Array.from(portsSet).filter((p) => !isNaN(p) && p > 0 && p <= 65535);
}

