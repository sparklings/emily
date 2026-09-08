import { LLMProxyClient } from '../api/llmClient';
import { PromptBuilder } from '../api/promptBuilder';
import { ProofreadDiffItem, ProofreadOptions } from '../types/proofread';
import { MarkdownFormatter } from './markdownFormatter';
import { getTranslation } from '../i18n';

/**
 * 마크다운 문서 교열(맞춤법, 문법, 서식 보정 등)을 총괄하는 코어 파이프라인 엔진
 * - LLM 호출 프롬프트 구성 및 JSON 형식 결과 파싱
 * - 사용자 활성 카테고리(화이트리스트) 기반 필터링
 * - 동아시아 볼드 공백 보정 및 타임스탬프 삭제 후처리 자동 통합
 */
export class ProofreadingEngine {
  private client: LLMProxyClient;
  private displayLanguage?: string;

  constructor(client: LLMProxyClient, displayLanguage?: string) {
    this.client = client;
    this.displayLanguage = displayLanguage;
  }

  /** UI 표시 언어 변경 동기화 */
  setDisplayLanguage(lang?: string) {
    this.displayLanguage = lang;
  }

  /**
   * 마크다운 텍스트에 대해 교열 파이프라인을 실행합니다.
   * @param markdownContent 검사할 마크다운 원문
   * @param options 맞춤법, 문법, 타임스탬프 삭제 등 교열 세부 옵션
   * @param customInstruction 사용자 임의 지시사항 (선택)
   * @returns 교열 제안 항목 목록(items), 소요 시간, 모델 정보 등
   */
  async runProofreading(
    markdownContent: string,
    options: ProofreadOptions,
    customInstruction?: string
  ): Promise<{
    items: ProofreadDiffItem[];
    totalTimeMs: number;
    tokensPerSec?: number;
    model: string;
    usage?: any;
    id?: string;
    finish_reason?: string;
    system_fingerprint?: string;
    created?: number;
  }> {
    const { system, user } = PromptBuilder.buildProofreadingPrompt(markdownContent, options, customInstruction);

    const response = await this.client.chatCompletion(
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      { temperature: 0.2 }
    );

    const allowedCategories = new Set<string>();
    if (options.checkSpelling) {
      allowedCategories.add('spelling');
      allowedCategories.add('bold_format');
    }
    if (options.checkGrammar) {
      allowedCategories.add('grammar');
    }
    if (options.removeTimestamps) {
      allowedCategories.add('timestamp');
    }
    if (options.improveExpression) {
      allowedCategories.add('expression');
    }
    if (options.searchCitation) {
      allowedCategories.add('citation');
    }
    if (options.checkConsistency) {
      allowedCategories.add('consistency');
    }

    let items = this.parseResponseItems(response.content);

    // Whitelist filtering: discard hallucinated/unrequested category items unless editor gave custom instructions
    const hasCustomInstruction = Boolean(customInstruction && customInstruction.trim());
    if (!hasCustomInstruction && allowedCategories.size > 0) {
      items = items.filter(item => allowedCategories.has(item.category));
    }

    const t = getTranslation(this.displayLanguage);

    if (options.removeTimestamps) {
      const timestampCleaned = MarkdownFormatter.cleanScriptTimestamps(markdownContent);
      if (timestampCleaned !== markdownContent) {
        items.unshift({
          id: 'timestamp_clean_auto',
          original: t.diffModal.timestampOriginal,
          replacement: t.diffModal.timestampReplacement,
          category: 'timestamp',
          explanation: t.diffModal.timestampExplanation,
          approved: true
        });
      }
    }

    const hasAnyOption = options.checkSpelling || options.checkGrammar || options.improveExpression || options.checkConsistency || options.searchCitation;
    if (hasAnyOption) {
      const boldFixed = MarkdownFormatter.fixKoreanBoldFormatting(markdownContent);
      if (boldFixed !== markdownContent) {
        items.unshift({
          id: 'korean_bold_auto',
          original: t.diffModal.boldOriginal,
          replacement: t.diffModal.boldReplacement,
          category: 'bold_format',
          explanation: t.diffModal.boldExplanation,
          approved: true
        });
      }
    }

    return {
      items,
      totalTimeMs: response.totalTimeMs,
      tokensPerSec: response.tokensPerSec,
      model: response.model,
      usage: response.usage,
      id: response.id,
      finish_reason: response.finish_reason,
      system_fingerprint: response.system_fingerprint,
      created: response.created
    };
  }

  private parseResponseItems(content: string): ProofreadDiffItem[] {
    try {
      let jsonStr = content.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }

      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.items)) {
        return parsed.items.map((item: any, idx: number) => ({
          id: item.id || `item_${idx + 1}`,
          original: item.original || '',
          replacement: item.replacement || '',
          category: item.category || 'spelling',
          explanation: item.explanation || '',
          approved: true
        }));
      }
      return [];
    } catch (e) {
      console.warn('[Assistant Emily] Could not parse LLM proofread response as JSON:', content);
      return [];
    }
  }
}
