import { EmilySettings, DeviceKeyProfile } from '../types/settings';

/**
 * 현재 기기의 OS 호스트명(Hostname)을 안전하게 조회합니다.
 * - Obsidian 데스크톱 환경(Electron/Node.js) 지원
 */
export function getDeviceHostname(): string {
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.COMPUTERNAME) return process.env.COMPUTERNAME.trim();
      if (process.env.HOSTNAME) return process.env.HOSTNAME.trim();
    }
    // Node.js os 모듈 동적 로드 시도
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require('os');
    if (os && typeof os.hostname === 'function') {
      return os.hostname().trim();
    }
  } catch {
    // 브라우저 샌드박스 또는 보안 제한 시 빈 문자열 반환
  }
  return '';
}

/**
 * 현재 기기의 대표 식별자 이름 반환 (OS 호스트명 > 'Local Device')
 */
export function getDeviceDisplayName(): string {
  const host = getDeviceHostname();
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

export interface EffectiveApiKeyResult {
  key: string;
  source: 'profile' | 'global';
  profileName?: string;
  hostnameMatched?: string;
}

/**
 * 2-Tier 분기 전략에 따라 현재 환경에서 최우선으로 유효한 API Key를 판별합니다.
 * 1순위: OS 호스트명(os.hostname())과 일치하는 기기 프로필 키 (data.json 동기화)
 * 2순위: data.json에 동기화된 전역 기본 키
 */
export function resolveEffectiveApiKey(
  settings: EmilySettings,
  provider: 'primary' | 'secondary'
): EffectiveApiKeyResult {
  const globalKey = provider === 'primary' ? (settings.apiKey || '') : (settings.secondaryApiKey || '');

  // 기기별 분기 기능이 비활성화된 경우 전역 키 사용
  if (settings.useDeviceKeyOverride === false) {
    return { key: globalKey, source: 'global' };
  }

  // 1순위: 기기 프로필 목록에서 호스트명 매칭 확인
  const currentHost = getDeviceHostname().toLowerCase();
  const profiles = settings.deviceProfiles || [];

  if (profiles.length > 0 && currentHost) {
    const matchedProfile = profiles.find((p) => {
      const pHost = (p.hostname || '').trim().toLowerCase();
      return pHost && pHost === currentHost;
    });

    if (matchedProfile) {
      const pKey = provider === 'primary' ? matchedProfile.provider1Key : matchedProfile.provider2Key;
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

  // 2순위: 기본 전역 동기화 키 반환
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
  settings: EmilySettings,
  provider: 'primary' | 'secondary'
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
    const k = provider === 'primary' ? prof.provider1Key : prof.provider2Key;
    if (k) {
      addKey(k, `${prof.name}${prof.hostname ? ` (${prof.hostname})` : ''}`, 'profile', prof.id);
    }
  }

  // 2. 전역 기본 키
  const globalKey = provider === 'primary' ? settings.apiKey : settings.secondaryApiKey;
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
 * 1순위: OS 호스트명(os.hostname())과 일치하는 기기 프로필의 URL/포트 (data.json 동기화)
 * 2순위: data.json에 동기화된 전역 기본 URL
 */
export function resolveEffectiveEndpoint(
  settings: EmilySettings,
  provider: 'primary' | 'secondary'
): EffectiveEndpointResult {
  const globalUrl = (provider === 'primary' ? settings.apiBaseUrl : settings.secondaryApiBaseUrl) || 'https://api.openai.com/v1';
  const cleanGlobalUrl = globalUrl.trim().replace(/\/+$/, '');

  // 기기별 분기 비활성화 시 전역 URL 사용
  if (settings.useDeviceKeyOverride === false) {
    return {
      url: cleanGlobalUrl,
      source: 'global',
      port: extractPort(cleanGlobalUrl) || undefined
    };
  }

  // 1순위: 기기 프로필 목록에서 호스트명 매칭 확인
  const currentHost = getDeviceHostname().toLowerCase();
  const profiles = settings.deviceProfiles || [];

  if (profiles.length > 0 && currentHost) {
    const matchedProfile = profiles.find((p) => {
      const pHost = (p.hostname || '').trim().toLowerCase();
      return pHost && pHost === currentHost;
    });

    if (matchedProfile) {
      const pUrl = provider === 'primary' ? matchedProfile.provider1Url : matchedProfile.provider2Url;
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

  // 2순위: 기본 전역 동기화 URL 반환
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
    for (const u of [prof.provider1Url, prof.provider2Url]) {
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

