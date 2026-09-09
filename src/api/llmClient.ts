import { requestUrl, RequestUrlResponse } from 'obsidian';
import { EmilySettings } from '../types/settings';
import { PromptBuilder } from './promptBuilder';

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
}

export type ProviderId = 'primary' | 'secondary';
export type ActiveProviderOption = 'primary' | 'secondary' | 'auto';

export interface ProviderTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  model: string;
  error?: string;
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
 * OpenAI 호환 LLM API 통신을 전담하는 듀얼 프로바이더 클라이언트 클래스
 * - 기본(Primary) 및 보조(Secondary) 2개 프로바이더 구성 지원
 * - 자동 헬스체크 및 동적 기본값 선출
 * - 장애 발생 시 보조 프로바이더로 무중단 자동 우회(Auto Failover)
 * - 대용량 문서 청크 분산(Distributed Chunk Processing) 요청 지원
 * - Obsidian 네이티브 requestUrl API를 사용하여 CORS 제약 없이 통신
 */
export class LLMProxyClient {
  private primaryConfig: ProviderConfig;
  private secondaryConfig: ProviderConfig | null = null;
  private activeProvider: ActiveProviderOption = 'auto';
  private enableFallback = true;
  private enableChunkDistribution = true;

  /**
   * LLMProxyClient 생성자
   * @param baseUrl 기본 API 엔드포인트 URL (후행 슬래시 자동 제거)
   * @param apiKey 기본 API 인증 토큰 (미입력 시 인증 헤더 제외)
   * @param defaultModel 기본 요청 모델 (기본값: 'auto')
   */
  constructor(baseUrl: string, apiKey: string, defaultModel = 'auto') {
    this.primaryConfig = {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      model: defaultModel
    };
  }

  /**
   * 단일 설정 갱신 (하위 호환성 유지)
   */
  updateConfig(baseUrl: string, apiKey: string, defaultModel: string) {
    this.primaryConfig = {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      model: defaultModel
    };
  }

  /**
   * 전체 플러그인 설정을 반영하여 듀얼 프로바이더 구성을 일괄 갱신합니다.
   */
  updateMultiConfig(settings: EmilySettings) {
    this.primaryConfig = {
      baseUrl: (settings.apiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      apiKey: settings.apiKey || '',
      model: settings.modelName || 'auto'
    };

    if (settings.secondaryApiBaseUrl && settings.secondaryApiBaseUrl.trim().length > 0) {
      this.secondaryConfig = {
        baseUrl: settings.secondaryApiBaseUrl.trim().replace(/\/+$/, ''),
        apiKey: settings.secondaryApiKey || '',
        model: settings.secondaryModelName || 'auto'
      };
    } else {
      this.secondaryConfig = null;
    }

    this.activeProvider = settings.activeProvider || 'auto';
    this.enableFallback = settings.enableFallback ?? true;
    this.enableChunkDistribution = settings.enableChunkDistribution ?? true;
  }

  /**
   * 보조 프로바이더가 유효하게 구성되어 있는지 여부를 반환합니다.
   */
  isMultiProviderAvailable(): boolean {
    return this.secondaryConfig !== null && this.secondaryConfig.baseUrl.length > 0;
  }

  /**
   * 청크 분산 처리가 활성화되어 있고 다중 프로바이더가 준비되었는지 확인합니다.
   */
  isChunkDistributionEnabled(): boolean {
    return this.isMultiProviderAvailable() && this.enableChunkDistribution;
  }

  /**
   * 현재 활성화된 정책에 따른 기본 프로바이더를 판별합니다.
   */
  getEffectiveProvider(): ProviderId {
    if (this.activeProvider === 'secondary' && this.isMultiProviderAvailable()) {
      return 'secondary';
    }
    return 'primary';
  }

  /**
   * 특정 프로바이더 설정 정보를 조회합니다.
   */
  getProviderConfig(providerId: ProviderId): ProviderConfig {
    if (providerId === 'secondary' && this.secondaryConfig) {
      return this.secondaryConfig;
    }
    return this.primaryConfig;
  }

  /**
   * 단일 프로바이더를 대상으로 LLM HTTP 요청을 직접 수행합니다.
   */
  private async executeSingleProviderRequest(
    providerId: ProviderId,
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
      signal?: AbortSignal;
    }
  ): Promise<LLMResponse> {
    const config = this.getProviderConfig(providerId);
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
      providerUsed: providerId,
      failedOver: false
    };
  }

  /**
   * 지정된 프로바이더에 대해 개별 연결 테스트를 수행합니다.
   */
  async testProvider(providerId: ProviderId, locale: string, timePeriod: string): Promise<ProviderTestResult> {
    const config = (providerId === 'secondary') ? this.secondaryConfig : this.primaryConfig;
    if (!config || !config.baseUrl) {
      return {
        success: false,
        message: '',
        latencyMs: 0,
        model: '',
        error: 'Not configured'
      };
    }

    const startTime = Date.now();
    const { system, user } = PromptBuilder.buildGreetingPrompt(locale, timePeriod);

    try {
      const response = await this.executeSingleProviderRequest(providerId, [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ], { temperature: 0.3, max_tokens: 200 });

      const cleanedGreeting = PromptBuilder.cleanGreetingMessage(response.content);

      return {
        success: true,
        message: cleanedGreeting,
        latencyMs: Date.now() - startTime,
        model: response.model
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: '',
        latencyMs: Date.now() - startTime,
        model: config.model || 'unknown',
        error: errorMsg
      };
    }
  }

  /**
   * 모든 등록된 프로바이더의 헬스체크를 동시에 실행하고 권장 기본 프로바이더를 산출합니다.
   */
  async testAllProviders(locale: string, timePeriod: string): Promise<MultiProviderTestSummary> {
    const primaryPromise = this.testProvider('primary', locale, timePeriod);
    const secondaryPromise = this.isMultiProviderAvailable()
      ? this.testProvider('secondary', locale, timePeriod)
      : Promise.resolve(undefined);

    const [primaryResult, secondaryResult] = await Promise.all([primaryPromise, secondaryPromise]);

    let recommended: ProviderId = 'primary';
    if (primaryResult.success) {
      recommended = 'primary';
    } else if (secondaryResult && secondaryResult.success) {
      recommended = 'secondary';
    }

    return {
      primary: primaryResult,
      secondary: secondaryResult,
      recommended
    };
  }

  /**
   * 하위 호환성을 위한 단일 연결 테스트 메서드
   */
  async testSayHello(locale: string, timePeriod: string): Promise<{ message: string; latencyMs: number; model: string }> {
    const result = await this.testProvider('primary', locale, timePeriod);
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
   * - 장애 발생 시 설정에 따라 보조 프로바이더로 자동 Failover 재시도합니다.
   * - options.providerId 지정 시 특정 프로바이더(예: 청크 분산 처리)를 직접 타겟팅합니다.
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
    let targetProvider: ProviderId = options?.providerId || this.getEffectiveProvider();

    // 지정된 프로바이더가 보조인데 보조 프로바이더가 미설정된 경우 기본으로 전락
    if (targetProvider === 'secondary' && !this.isMultiProviderAvailable()) {
      targetProvider = 'primary';
    }

    try {
      return await this.executeSingleProviderRequest(targetProvider, messages, options);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      if (options?.signal?.aborted) {
        const abortErr = new Error('Task was cancelled by the user.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      // Failover 조건 검사: 자동 우회 활성화 및 대체 프로바이더가 사용 가능한 경우
      const fallbackTarget: ProviderId = targetProvider === 'primary' ? 'secondary' : 'primary';
      const isFallbackPossible = this.enableFallback &&
        ((fallbackTarget === 'secondary' && this.isMultiProviderAvailable()) ||
         (fallbackTarget === 'primary'));

      if (isFallbackPossible) {
        console.warn(`[Assistant Emily] Provider '${targetProvider}' request failed. Auto-failing over to '${fallbackTarget}'...`, err);
        try {
          const fallbackResponse = await this.executeSingleProviderRequest(fallbackTarget, messages, options);
          fallbackResponse.failedOver = true;
          return fallbackResponse;
        } catch (fallbackErr: unknown) {
          if (fallbackErr instanceof Error && fallbackErr.name === 'AbortError') {
            throw fallbackErr;
          }
          if (options?.signal?.aborted) {
            const abortErr = new Error('Task was cancelled by the user.');
            abortErr.name = 'AbortError';
            throw abortErr;
          }
          const originalMsg = err instanceof Error ? err.message : String(err);
          const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          console.error(`[Assistant Emily] Both providers failed. P1: ${originalMsg}, P2: ${fbMsg}`);
          throw new Error(`LLM 통신 실패 (P1: ${originalMsg}, P2: ${fbMsg})`);
        }
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Assistant Emily] LLM request failed on provider '${targetProvider}':`, err);
      throw new Error(`LLM 통신 실패: ${errMsg}`);
    }
  }

  /**
   * API 엔드포인트(/models)에서 사용 가능한 LLM 모델 목록을 조회합니다.
   */
  async getModels(providerId: ProviderId = 'primary'): Promise<Array<{ id: string; name?: string }>> {
    const config = this.getProviderConfig(providerId);
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
      console.warn(`[Assistant Emily] Could not fetch models from provider '${providerId}':`, err);
      return [];
    }
  }
}

