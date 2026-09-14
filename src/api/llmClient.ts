import { requestUrl, RequestUrlResponse } from 'obsidian';
import { EmilySettings } from '../types/settings';
import { PromptBuilder } from './promptBuilder';
import {
  resolveEffectiveApiKey,
  resolveEffectiveEndpoint,
  applyPortOrUrl,
  isLocalEndpoint
} from '../utils/deviceKeyManager';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunkCallback {
  (chunk: string, totalTokensApprox: number): void;
}

export interface LLMUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
    [key: string]: unknown;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LLMResponse {
  content: string;
  totalTimeMs: number;
  tokensPerSec?: number;
  model: string;
  id?: string;
  created?: number;
  system_fingerprint?: string;
  finish_reason?: string;
  usage?: LLMUsage;
  rawResponse?: unknown;
  providerUsed?: 'primary' | 'secondary';
  failedOver?: boolean;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  keySource?: 'local' | 'profile' | 'global';
  urlSource?: 'local' | 'profile' | 'global';
  profileName?: string;
  port?: string;
}

export type ProviderId = 'primary' | 'secondary';
export type ActiveProviderOption = 'primary' | 'secondary' | 'auto';

export interface ProviderTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  model: string;
  error?: string;
  keySource?: 'local' | 'profile' | 'global';
  urlSource?: 'local' | 'profile' | 'global';
  profileName?: string;
  testedKey?: string;
  testedUrl?: string;
  isLocalhost?: boolean;
}

export interface MultiProviderTestSummary {
  primary: ProviderTestResult;
  secondary?: ProviderTestResult;
  recommended: ProviderId;
}

interface ChatCompletionPayload {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens?: number;
  response_format?: { type: string };
  stream?: boolean;
}

interface ChatCompletionChoice {
  message?: {
    content?: string;
    role?: string;
  };
  finish_reason?: string;
}

interface ChatCompletionApiResponse {
  id?: string;
  model?: string;
  created?: number;
  system_fingerprint?: string;
  choices?: ChatCompletionChoice[];
  usage?: LLMUsage;
  data?: Array<{ id: string; name?: string }>;
}

/**
 * OpenAI 호환 LLM API 통신을 전담하는 기기 프로필 기반 클라이언트 클래스
 * - 기기 프로필(Device Profile: os.hostname())에 의해 유효하게 결정된 엔드포인트 및 API Key 사용
 * - 포트 자동 탐색(Port Auto-Probe) 및 401 오류 시 후보 키 자동 진단(Auto-Probe) 지원
 * - Obsidian 네이티브 requestUrl API를 사용하여 CORS 제약 없이 통신
 */
export class LLMProxyClient {
  private config: ProviderConfig;

  /**
   * LLMProxyClient 생성자
   * @param baseUrl 기본 API 엔드포인트 URL (후행 슬래시 자동 제거)
   * @param apiKey 기본 API 인증 토큰 (미입력 시 인증 헤더 제외)
   * @param defaultModel 기본 요청 모델 (기본값: 'auto')
   */
  constructor(baseUrl: string, apiKey: string, defaultModel = 'auto') {
    this.config = {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      model: defaultModel
    };
  }

  get primaryConfig(): ProviderConfig {
    return this.config;
  }

  /**
   * 단일 설정 갱신 (하위 호환성 유지)
   */
  updateConfig(baseUrl: string, apiKey: string, defaultModel: string) {
    this.config = {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      model: defaultModel
    };
  }

  /**
   * 전체 플러그인 설정을 반영하여 기기 프로필 기반 구성을 일괄 갱신합니다.
   */
  updateMultiConfig(settings: EmilySettings) {
    const keyEffective = resolveEffectiveApiKey(settings);
    const urlEffective = resolveEffectiveEndpoint(settings);
    this.config = {
      baseUrl: urlEffective.url,
      apiKey: keyEffective.key,
      model: settings.modelName || 'auto',
      keySource: keyEffective.source,
      urlSource: urlEffective.source,
      profileName: keyEffective.profileName || urlEffective.profileName,
      port: urlEffective.port
    };
  }

  /**
   * 보조 프로바이더 가용 여부 (하위 호환성: 항상 false 반환)
   */
  isMultiProviderAvailable(): boolean {
    return false;
  }

  /**
   * 청크 분산 처리 가용 여부 (하위 호환성: 항상 false 반환)
   */
  isChunkDistributionEnabled(): boolean {
    return false;
  }

  /**
   * 현재 활성화된 기본 프로바이더 (하위 호환성: 'primary')
   */
  getEffectiveProvider(): ProviderId {
    return 'primary';
  }

  /**
   * 현재 프로바이더 설정 정보 조회
   */
  getProviderConfig(_providerId?: ProviderId): ProviderConfig {
    return this.config;
  }

  getConfig(): ProviderConfig {
    return this.config;
  }

  /**
   * 엔드포인트를 대상으로 LLM HTTP 요청을 직접 수행합니다.
   */
  private async executeSingleProviderRequest(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
      signal?: AbortSignal;
    }
  ): Promise<LLMResponse> {
    const config = this.config;
    const startTime = Date.now();
    const model = options?.model || config.model || 'auto';
    const endpoint = `${config.baseUrl}/chat/completions`;

    if (options?.signal?.aborted) {
      const abortError = new Error('Task was cancelled by the user.');
      abortError.name = 'AbortError';
      throw abortError;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const payload: ChatCompletionPayload = {
      model,
      messages,
      temperature: options?.temperature ?? 0.3,
    };

    if (options?.max_tokens) {
      payload.max_tokens = options.max_tokens;
    }

    if (options?.response_format) {
      payload.response_format = options.response_format;
    }

    let requestPromise: Promise<RequestUrlResponse> = requestUrl({
      url: endpoint,
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (options?.signal) {
      const signal = options.signal;
      requestPromise = Promise.race([
        requestPromise,
        new Promise<never>((_, reject) => {
          const onAbort = () => {
            signal.removeEventListener('abort', onAbort);
            const abortError = new Error('Task was cancelled by the user.');
            abortError.name = 'AbortError';
            reject(abortError);
          };
          if (signal.aborted) {
            onAbort();
          } else {
            signal.addEventListener('abort', onAbort, { once: true });
          }
        })
      ]);
    }

    const response = await requestPromise;

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.text}`);
    }

    const data = response.json as ChatCompletionApiResponse;
    const choice = data.choices?.[0];
    const content = choice?.message?.content || '';
    const totalTimeMs = Date.now() - startTime;
    const usage = data.usage;
    const completionTokens = usage?.completion_tokens ?? Math.round(content.length / 3);
    const tokensPerSec = totalTimeMs > 0 ? Math.round((completionTokens / (totalTimeMs / 1000)) * 10) / 10 : 0;

    return {
      content,
      totalTimeMs,
      tokensPerSec,
      model: data.model || model,
      id: data.id,
      created: data.created,
      system_fingerprint: data.system_fingerprint,
      finish_reason: choice?.finish_reason,
      usage: usage ? {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        prompt_tokens_details: usage.prompt_tokens_details,
        completion_tokens_details: usage.completion_tokens_details,
        ...usage
      } : undefined,
      rawResponse: data,
      providerUsed: 'primary',
      failedOver: false
    };
  }

  /**
   * 지정된 엔드포인트에 대해 연결 테스트를 수행합니다.
   * 다형성 지원: testProvider('primary', locale, timePeriod) 및 testProvider(locale, timePeriod) 모두 지원
   */
  async testProvider(
    arg1: string,
    arg2?: string,
    arg3?: string,
    arg4?: string,
    arg5?: string
  ): Promise<ProviderTestResult> {
    let locale = arg1;
    let timePeriod = arg2 || 'afternoon';
    let overrideKey: string | undefined = arg3;
    let overrideUrl: string | undefined = arg4;

    if (arg1 === 'primary' || arg1 === 'secondary') {
      locale = arg2 || 'English';
      timePeriod = arg3 || 'afternoon';
      overrideKey = arg4;
      overrideUrl = arg5;
    }

    const config = this.config;
    if (!config || !config.baseUrl) {
      return {
        success: false,
        message: '',
        latencyMs: 0,
        model: '',
        error: 'Not configured'
      };
    }

    const effectiveKey = overrideKey !== undefined ? overrideKey : config.apiKey;
    const effectiveUrl = overrideUrl !== undefined ? overrideUrl.replace(/\/+$/, '') : config.baseUrl;
    const effectiveKeySource = overrideKey !== undefined ? 'local' : config.keySource;
    const effectiveUrlSource = overrideUrl !== undefined ? 'local' : config.urlSource;
    const effectiveProfile = (overrideKey !== undefined || overrideUrl !== undefined) ? undefined : config.profileName;
    const isLocal = isLocalEndpoint(effectiveUrl);

    const startTime = Date.now();
    const { system, user } = PromptBuilder.buildGreetingPrompt(locale, timePeriod);

    // 임시 키/URL 테스트인 경우 요청 동안 치환
    const prevKey = config.apiKey;
    const prevUrl = config.baseUrl;
    if (overrideKey !== undefined) config.apiKey = overrideKey;
    if (overrideUrl !== undefined) config.baseUrl = effectiveUrl;

    try {
      const response = await this.executeSingleProviderRequest([
        { role: 'system', content: system },
        { role: 'user', content: user }
      ], { temperature: 0.3, max_tokens: 200 });

      const cleanedGreeting = PromptBuilder.cleanGreetingMessage(response.content);

      return {
        success: true,
        message: cleanedGreeting,
        latencyMs: Date.now() - startTime,
        model: response.model,
        keySource: effectiveKeySource,
        urlSource: effectiveUrlSource,
        profileName: effectiveProfile,
        testedKey: effectiveKey,
        testedUrl: effectiveUrl,
        isLocalhost: isLocal
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: '',
        latencyMs: Date.now() - startTime,
        model: config.model || 'unknown',
        error: errorMsg,
        keySource: effectiveKeySource,
        urlSource: effectiveUrlSource,
        profileName: effectiveProfile,
        testedKey: effectiveKey,
        testedUrl: effectiveUrl,
        isLocalhost: isLocal
      };
    } finally {
      if (overrideKey !== undefined) config.apiKey = prevKey;
      if (overrideUrl !== undefined) config.baseUrl = prevUrl;
    }
  }

  /**
   * 401 인증 실패 시 등록된 후보 키들을 순차 테스트하여 유효한 키를 자동 탐색합니다.
   */
  async probeWorkingKey(
    arg1: unknown,
    arg2?: unknown,
    arg3?: unknown,
    arg4?: unknown
  ): Promise<{ workingKey: string; result: ProviderTestResult } | null> {
    let locale = 'English';
    let timePeriod = 'afternoon';
    let candidateKeys: string[] = [];

    if (Array.isArray(arg1)) {
      candidateKeys = arg1 as string[];
      if (typeof arg2 === 'string') locale = arg2;
      if (typeof arg3 === 'string') timePeriod = arg3;
    } else if (typeof arg1 === 'string' && (arg1 === 'primary' || arg1 === 'secondary')) {
      if (typeof arg2 === 'string') locale = arg2;
      if (typeof arg3 === 'string') timePeriod = arg3;
      if (Array.isArray(arg4)) candidateKeys = arg4 as string[];
    } else if (typeof arg1 === 'string') {
      locale = arg1;
      if (typeof arg2 === 'string') timePeriod = arg2;
      if (Array.isArray(arg3)) candidateKeys = arg3 as string[];
    }

    for (const key of candidateKeys) {
      if (!key || !key.trim()) continue;
      try {
        const res = await this.testProvider(locale, timePeriod, key.trim());
        if (res.success) {
          return { workingKey: key.trim(), result: res };
        }
      } catch {
        // 다음 키 계속 탐색
      }
    }
    return null;
  }

  /**
   * 로컬 엔드포인트 연결 실패 시 후보 포트들을 순회하여 응답하는 포트를 자동 탐색합니다.
   */
  async probeWorkingPort(
    arg1: unknown,
    arg2?: unknown,
    arg3?: unknown,
    arg4?: unknown
  ): Promise<{ workingPort: number; workingUrl: string; result: ProviderTestResult } | null> {
    let locale = 'English';
    let timePeriod = 'afternoon';
    let candidatePorts: number[] = [];

    if (Array.isArray(arg1)) {
      candidatePorts = arg1 as number[];
      if (typeof arg2 === 'string') locale = arg2;
      if (typeof arg3 === 'string') timePeriod = arg3;
    } else if (typeof arg1 === 'string' && (arg1 === 'primary' || arg1 === 'secondary')) {
      if (typeof arg2 === 'string') locale = arg2;
      if (typeof arg3 === 'string') timePeriod = arg3;
      if (Array.isArray(arg4)) candidatePorts = arg4 as number[];
    } else if (typeof arg1 === 'string') {
      locale = arg1;
      if (typeof arg2 === 'string') timePeriod = arg2;
      if (Array.isArray(arg3)) candidatePorts = arg3 as number[];
    }

    const config = this.config;
    if (!config || !config.baseUrl) return null;

    for (const port of candidatePorts) {
      const testUrl = applyPortOrUrl(config.baseUrl, String(port));
      try {
        const res = await this.testProvider(locale, timePeriod, undefined, testUrl);
        // 통신 성공이거나, 최소한 401(인증 실패)이라도 떴다면 포트가 열려있고 살아있는 서버임
        if (res.success || (res.error && res.error.includes('401'))) {
          return { workingPort: port, workingUrl: testUrl, result: res };
        }
      } catch {
        // 다음 포트 계속 탐색
      }
    }
    return null;
  }

  /**
   * 단일 연결 테스트 요약 반환 (하위 호환성)
   */
  async testAllProviders(locale: string, timePeriod: string): Promise<MultiProviderTestSummary> {
    const primaryResult = await this.testProvider(locale, timePeriod);
    return {
      primary: primaryResult,
      recommended: 'primary'
    };
  }

  /**
   * 하위 호환성을 위한 단일 연결 테스트 메서드
   */
  async testSayHello(locale: string, timePeriod: string): Promise<{ message: string; latencyMs: number; model: string }> {
    const result = await this.testProvider(locale, timePeriod);
    if (!result.success) {
      throw new Error(result.error || 'Connection failed');
    }
    return {
      message: result.message,
      latencyMs: result.latencyMs,
      model: result.model
    };
  }

  /**
   * OpenAI 호환 엔드포인트(/chat/completions)로 챗 완성 요청을 전송합니다.
   */
  async chatCompletion(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
      signal?: AbortSignal;
      providerId?: ProviderId;
    }
  ): Promise<LLMResponse> {
    try {
      return await this.executeSingleProviderRequest(messages, options);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      if (options?.signal?.aborted) {
        const abortErr = new Error('Task was cancelled by the user.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Assistant Emily] LLM request failed:', err);
      throw new Error(`LLM 통신 실패: ${errMsg}`);
    }
  }

  /**
   * API 엔드포인트(/models)에서 사용 가능한 LLM 모델 목록을 조회합니다.
   */
  async getModels(_providerId: ProviderId = 'primary'): Promise<Array<{ id: string; name?: string }>> {
    const config = this.config;
    const endpoint = `${config.baseUrl}/models`;
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
      const response = await requestUrl({
        url: endpoint,
        method: 'GET',
        headers
      });
      const data = response.json as ChatCompletionApiResponse;
      if (Array.isArray(data?.data)) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.warn('[Assistant Emily] Could not fetch models from endpoint:', err);
      return [];
    }
  }
}

