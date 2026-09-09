import { requestUrl, RequestUrlResponse } from 'obsidian';

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
 * OpenAI 호환 LLM API 통신을 전담하는 클라이언트 클래스
 * - Obsidian 네이티브 requestUrl API를 사용하여 CORS 제약 없이 통신
 * - 스트리밍 또는 일괄 응답, 토큰 사용량 계산 및 속도(tokens/sec) 측정
 */
export class LLMProxyClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  /**
   * LLMProxyClient 생성자
   * @param baseUrl API 엔드포인트 URL (후행 슬래시 자동 제거)
   * @param apiKey API 인증 토큰 (미입력 시 인증 헤더 제외)
   * @param defaultModel 기본 요청 모델 (기본값: 'auto')
   */
  constructor(baseUrl: string, apiKey: string, defaultModel = 'auto') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  /**
   * 런타임 설정 변경 시 클라이언트의 엔드포인트 및 인증 키를 갱신합니다.
   * @param baseUrl 새로운 API 엔드포인트
   * @param apiKey 새로운 API 키
   * @param defaultModel 새로운 기본 모델
   */
  updateConfig(baseUrl: string, apiKey: string, defaultModel: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  /**
   * 설정 화면의 API 연결 테스트용 인사말 생성 요청
   * @param locale 사용자 언어 로케일 (ko, en 등)
   * @param timePeriod 현재 시간대 (morning, afternoon, evening, night)
   * @returns 인사말 메시지, 지연 시간(ms), 응답 모델 정보
   */
  async testSayHello(locale: string, timePeriod: string): Promise<{ message: string; latencyMs: number; model: string }> {
    const startTime = Date.now();
    const prompt = `You are Assistant Emily. The user is connecting to your LLM proxy from Obsidian.
User Locale: ${locale}
Current Time Period: ${timePeriod}
Respond strictly with a single natural, friendly, 1-2 sentence greeting in the user's primary language (${locale}) that mentions the time of day and introduces yourself as Assistant Emily.`;

    const response = await this.chatCompletion([
      { role: 'system', content: 'You are Assistant Emily, an intelligent Markdown editorial assistant for Obsidian.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, max_tokens: 150 });

    const latencyMs = Date.now() - startTime;
    return {
      message: response.content.trim(),
      latencyMs,
      model: response.model
    };
  }

  /**
   * OpenAI 호환 엔드포인트(/chat/completions)로 챗 완성 요청을 전송합니다.
   * @param messages 대화 메시지 배열 (system, user, assistant)
   * @param options 모델, 온도(temperature), 최대 토큰 수, JSON 응답 포맷 등 추가 옵션
   * @returns 파싱된 LLMResponse (응답 본문, 지연 시간, 토큰 사용량, 속도 등)
   */
  async chatCompletion(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
      signal?: AbortSignal;
    }
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options?.model || this.defaultModel || 'auto';
    const endpoint = `${this.baseUrl}/chat/completions`;

    if (options?.signal?.aborted) {
      const abortError = new Error('Task was cancelled by the user.');
      abortError.name = 'AbortError';
      throw abortError;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
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

    try {
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
        throw new Error(`API returned HTTP ${response.status}: ${response.text}`);
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
        rawResponse: data
      };
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
   * @returns 조회된 모델 목록 객체 배열 (실패 시 빈 배열 반환)
   */
  async getModels(): Promise<Array<{ id: string; name?: string }>> {
    const endpoint = `${this.baseUrl}/models`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
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
      console.warn('[Assistant Emily] Could not fetch models from proxy:', err);
      return [];
    }
  }
}
