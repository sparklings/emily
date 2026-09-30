import { EmilySettings, DeviceKeyProfile, AIProviderConfig, DeviceBinding, ProviderModelConfig } from '../types/settings';

/**
 * 등록된 전체 AI 프로바이더 목록을 반환합니다.
 */
export function getRegisteredProviders(settings: EmilySettings): AIProviderConfig[] {
  return settings.providers || [];
}

/**
 * 특정 기기(호스트명)에 유효하게 바인딩된 AI 프로바이더를 선출합니다. (OneDrive 다중 PC 동기화 충돌 방지 핵심)
 * 1순위: settings.deviceMappings[hostname]?.providerId
 * 2순위: settings.defaultProviderId
 * 3순위: settings.providers[0]
 */
export function getEffectiveProviderForDevice(
  settings: EmilySettings,
  customHost?: string
): AIProviderConfig | null {
  const providers = settings.providers || [];
  if (providers.length === 0) return null;

  const currentHost = (customHost || getDeviceHostname(settings) || 'default').toLowerCase().trim();
  const mappings = settings.deviceMappings || {};

  // 1. 해당 기기의 독립 바인딩 맵 확인
  if (currentHost && mappings[currentHost]?.providerId) {
    const boundId = mappings[currentHost].providerId;
    if (boundId === '__global__') {
      return null;
    }
    const found = providers.find((p) => p.id === boundId);
    if (found) return found;
  }

  // 2. 'default' 바인딩 맵 확인
  if (mappings['default']?.providerId) {
    const boundId = mappings['default'].providerId;
    if (boundId !== '__global__') {
      const found = providers.find((p) => p.id === boundId);
      if (found) return found;
    }
  }

  // 3. 기본 프로바이더 ID 확인
  if (settings.defaultProviderId && settings.defaultProviderId !== '__global__') {
    const defaultProv = providers.find((p) => p.id === settings.defaultProviderId);
    if (defaultProv) return defaultProv;
  }

  // 4. 첫 번째 프로바이더 Fallback
  return providers[0];
}

/**
 * 특정 기기(호스트명)에 유효하게 바인딩된 기본 모델 ID를 선출합니다.
 */
export function getEffectiveModelForDevice(
  settings: EmilySettings,
  customHost?: string
): string {
  const currentHost = (customHost || getDeviceHostname(settings) || 'default').toLowerCase().trim();
  const mappings = settings.deviceMappings || {};

  // 1. 기기 바인딩에 명시된 모델 ID
  if (currentHost && mappings[currentHost]?.modelId) {
    return mappings[currentHost].modelId!;
  }
  if (mappings['default']?.modelId) {
    return mappings['default'].modelId!;
  }

  // 2. 활성 프로바이더에서 첫 번째 활성화된(enabled) 모델 ID
  const activeProv = getEffectiveProviderForDevice(settings, customHost);
  if (activeProv && activeProv.models && activeProv.models.length > 0) {
    const enabledModel = activeProv.models.find((m) => m.enabled);
    if (enabledModel) return enabledModel.id;
    return activeProv.models[0].id;
  }

  // 3. 전역 기본 모델명
  return settings.modelName || 'auto';
}

/**
 * 현재 기기(또는 지정된 호스트명)에 활성화할 프로바이더 및 모델을 독립적으로 바인딩합니다.
 * (원드라이브로 다른 PC와 data.json을 공유해도 각 PC의 호스트 키가 독립 보존됨)
 */
export function setDeviceProviderBinding(
  settings: EmilySettings,
  providerId: string,
  modelId?: string,
  customHost?: string
): void {
  const currentHost = (customHost || getDeviceHostname(settings) || 'default').toLowerCase().trim();
  if (!settings.deviceMappings) {
    settings.deviceMappings = {};
  }
  const existing = settings.deviceMappings[currentHost] || { providerId };
  settings.deviceMappings[currentHost] = {
    providerId: providerId.trim(),
    modelId: modelId !== undefined ? modelId : existing.modelId
  };

  // 전역 기본 프로바이더 및 모델 동기화
  settings.defaultProviderId = providerId.trim();
  const prov = (settings.providers || []).find((p) => p.id === providerId.trim());
  if (prov) {
    if (modelId) {
      settings.modelName = modelId;
    } else if (prov.models && prov.models.length > 0) {
      const enabledModel = prov.models.find((m) => m.enabled);
      if (enabledModel) {
        settings.modelName = enabledModel.id;
        settings.deviceMappings[currentHost].modelId = enabledModel.id;
      } else {
        settings.modelName = prov.models[0].id;
        settings.deviceMappings[currentHost].modelId = prov.models[0].id;
      }
    }
  }
}

/**
 * 기존 단일 설정 및 레거시 deviceProfiles를 신규 YOLO 스타일 providers 및 deviceMappings 구조로 마이그레이션합니다.
 */
export function migrateLegacySettingsToProviders(settings: EmilySettings): boolean {
  let modified = false;

  if (!settings.providers) {
    settings.providers = [];
  }

  // 1. 등록된 프로바이더가 전혀 없는 경우 기존 단일 설정을 Default Provider로 승격
  if (settings.providers.length === 0) {
    const defaultProv: AIProviderConfig = {
      id: 'default-provider',
      name: 'Default Provider',
      preset: 'custom',
      apiType: 'openai-compatible',
      baseUrl: settings.apiBaseUrl || 'https://api.openai.com/v1',
      apiKey: settings.apiKey || '',
      models: [
        {
          id: settings.modelName || 'auto',
          displayName: settings.modelName && settings.modelName !== 'auto' ? settings.modelName : 'Default Model',
          enabled: true
        }
      ]
    };
    settings.providers.push(defaultProv);
    settings.defaultProviderId = defaultProv.id;
    modified = true;
  }

  // 2. 기존 deviceProfiles가 있는 경우 프로바이더 풀 및 기기 바인딩으로 통합 마이그레이션
  if (settings.deviceProfiles && settings.deviceProfiles.length > 0) {
    if (!settings.deviceMappings) {
      settings.deviceMappings = {};
    }
    for (const prof of settings.deviceProfiles) {
      const existingProv = settings.providers.find((p) => p.id === prof.id);
      if (!existingProv) {
        const prov: AIProviderConfig = {
          id: prof.id,
          name: prof.name,
          preset: 'custom',
          apiType: 'openai-compatible',
          baseUrl: prof.url || settings.apiBaseUrl || 'https://api.openai.com/v1',
          apiKey: prof.apiKey || settings.apiKey || '',
          models: [
            {
              id: prof.modelName || settings.modelName || 'auto',
              displayName: prof.modelName || settings.modelName || 'Default Model',
              enabled: true
            }
          ]
        };
        settings.providers.push(prov);
        modified = true;
      }

      if (prof.hostname) {
        const h = prof.hostname.toLowerCase().trim();
        if (!settings.deviceMappings[h]) {
          settings.deviceMappings[h] = {
            providerId: prof.id,
            modelId: prof.modelName
          };
          modified = true;
        }
      }
    }
  }

  // 3. 프로바이더 이름 점검 및 단일 한글 자모(IME 오타 등) 자동 복구
  if (settings.providers && settings.providers.length > 0) {
    for (const prov of settings.providers) {
      if (!prov.name || /^[ㄱ-ㅣ]$/.test(prov.name.trim())) {
        if (prov.id && !/^[ㄱ-ㅣ]$/.test(prov.id.trim())) {
          prov.name = prov.id;
          modified = true;
        }
      }
    }
  }

  return modified;
}

/**
 * 현재 기기의 활성 프로필 ID를 플러그인 설정(Obsidian Plugin Data API)에서 조회합니다.
 */
export function getActiveProfileId(settings?: EmilySettings): string {
  if (settings && settings.activeProfileId && settings.activeProfileId.trim().length > 0) {
    return settings.activeProfileId.trim();
  }
  return '';
}

/**
 * 현재 기기의 활성 프로필 ID를 플러그인 설정(Obsidian Plugin Data API)에 저장합니다.
 * - '__global__'로 지정 시 전역 기본값 강제 사용
 * - 빈 문자열 지정 시 바인딩 해제
 */
export function setActiveProfileId(profileId: string, settings?: EmilySettings): void {
  const trimmed = profileId.trim();
  if (settings) {
    settings.activeProfileId = trimmed;
  }
}

/**
 * 현재 기기에 활성화된 프로필 객체를 반환합니다.
 * 1순위: 활성 프로필 ID 매칭 프로필
 * 2순위: 호스트명 매칭 프로필
 * 없거나 전역 기본값 선택 시 null 반환
 */
export function getActiveProfile(settings: EmilySettings): DeviceKeyProfile | null {
  const activeId = getActiveProfileId(settings);
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
 * 현재 기기의 사용자 지정 식별자(호스트명)를 플러그인 설정(settings.currentDeviceHostname)에서 조회합니다.
 * - 시스템 고유 정보(os.hostname, process.env 등)를 조회하지 않고 사용자가 직접 입력한 기기 식별자를 사용합니다.
 */
export function getDeviceHostname(settings?: EmilySettings): string {
  if (settings && settings.currentDeviceHostname && settings.currentDeviceHostname.trim().length > 0) {
    return settings.currentDeviceHostname.trim();
  }
  return '';
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

  const currentHost = (customHost || getDeviceHostname(settings) || 'default').toLowerCase().trim();
  const mappings = settings.deviceMappings || {};
  const providers = settings.providers || [];

  // 0순위: 신규 YOLO 프로바이더 독립 매핑 (deviceMappings) 확인 (OneDrive 다중 PC 격리)
  if (providers.length > 0 && currentHost && mappings[currentHost]?.providerId) {
    const boundId = mappings[currentHost].providerId;
    if (boundId === '__global__') {
      return { key: globalKey, source: 'global' };
    }
    const found = providers.find((p) => p.id === boundId);
    if (found && found.apiKey !== undefined) {
      return {
        key: found.apiKey.trim(),
        source: 'profile',
        profileName: found.name,
        hostnameMatched: currentHost
      };
    }
  }

  if (providers.length > 0 && mappings['default']?.providerId) {
    const boundId = mappings['default'].providerId;
    if (boundId !== '__global__') {
      const found = providers.find((p) => p.id === boundId);
      if (found && found.apiKey !== undefined) {
        return {
          key: found.apiKey.trim(),
          source: 'profile',
          profileName: found.name,
          hostnameMatched: 'default'
        };
      }
    }
  }

  const profiles = settings.deviceProfiles || [];

  // 1순위: 활성 프로필 ID (명시적 customHost가 없을 때 최우선)
  if (!customHost) {
    const activeId = getActiveProfileId(settings);
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

  // 3순위: 신규 프로바이더 기본값 (defaultProviderId)
  if (providers.length > 0) {
    if (settings.defaultProviderId && settings.defaultProviderId !== '__global__') {
      const defProv = providers.find((p) => p.id === settings.defaultProviderId);
      if (defProv && defProv.apiKey !== undefined) {
        return {
          key: defProv.apiKey.trim(),
          source: 'profile',
          profileName: defProv.name
        };
      }
    }
  }

  // 4순위: 기본 전역 동기화 키 반환
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

  // 1. 신규 YOLO 프로바이더의 키들
  for (const prov of settings.providers || []) {
    if (prov.apiKey) {
      addKey(prov.apiKey, `${prov.name} (Provider)`, 'profile', prov.id);
    }
  }

  // 2. 등록된 모든 기기 프로필의 키 (하위 호환)
  const profiles = settings.deviceProfiles || [];
  for (const prof of profiles) {
    const k = prof.apiKey || prof.provider1Key;
    if (k) {
      addKey(k, `${prof.name}${prof.hostname ? ` (${prof.hostname})` : ''}`, 'profile', prof.id);
    }
  }

  // 3. 전역 기본 키
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
 * 0순위: 기기 식별자(호스트명)와 독립 매핑된 신규 프로바이더 URL (OneDrive 다중 PC 격리)
 * 1순위: 기기 식별자(호스트명)와 일치하는 기기 프로필의 URL/포트 (data.json 동기화)
 * 2순위: 신규 프로바이더 기본값 (defaultProviderId)
 * 3순위: data.json에 동기화된 전역 기본 URL
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

  const currentHost = (customHost || getDeviceHostname(settings) || 'default').toLowerCase().trim();
  const mappings = settings.deviceMappings || {};
  const providers = settings.providers || [];

  // 0순위: 신규 YOLO 프로바이더 독립 매핑 (deviceMappings) 확인 (OneDrive 다중 PC 격리)
  if (providers.length > 0 && currentHost && mappings[currentHost]?.providerId) {
    const boundId = mappings[currentHost].providerId;
    if (boundId === '__global__') {
      return {
        url: cleanGlobalUrl,
        source: 'global',
        port: extractPort(cleanGlobalUrl) || undefined
      };
    }
    const found = providers.find((p) => p.id === boundId);
    if (found && found.baseUrl) {
      const cleanUrl = found.baseUrl.trim().replace(/\/+$/, '');
      return {
        url: cleanUrl,
        source: 'profile',
        profileName: found.name,
        hostnameMatched: currentHost,
        port: extractPort(cleanUrl) || undefined
      };
    }
  }

  if (providers.length > 0 && mappings['default']?.providerId) {
    const boundId = mappings['default'].providerId;
    if (boundId !== '__global__') {
      const found = providers.find((p) => p.id === boundId);
      if (found && found.baseUrl) {
        const cleanUrl = found.baseUrl.trim().replace(/\/+$/, '');
        return {
          url: cleanUrl,
          source: 'profile',
          profileName: found.name,
          hostnameMatched: 'default',
          port: extractPort(cleanUrl) || undefined
        };
      }
    }
  }

  const profiles = settings.deviceProfiles || [];

  // 1순위: 활성 프로필 ID (명시적 customHost가 없을 때 최우선)
  if (!customHost) {
    const activeId = getActiveProfileId(settings);
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

  // 3순위: 신규 프로바이더 기본값 (defaultProviderId)
  if (providers.length > 0) {
    if (settings.defaultProviderId && settings.defaultProviderId !== '__global__') {
      const defProv = providers.find((p) => p.id === settings.defaultProviderId);
      if (defProv && defProv.baseUrl) {
        const cleanUrl = defProv.baseUrl.trim().replace(/\/+$/, '');
        return {
          url: cleanUrl,
          source: 'profile',
          profileName: defProv.name,
          port: extractPort(cleanUrl) || undefined
        };
      }
    }
  }

  // 4순위: 기본 전역 동기화 URL 반환
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

  // 신규 프로바이더 목록에서 추출
  for (const prov of settings.providers || []) {
    if (prov.baseUrl) {
      const p = extractPort(prov.baseUrl);
      if (p) portsSet.add(parseInt(p, 10));
    }
  }

  // 프로필에 등록된 포트/URL에서 추출 (하위 호환)
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

