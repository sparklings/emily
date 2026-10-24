import { App, TFile } from 'obsidian';
import { LLMProxyClient, LLMUsage, LLMResponse } from '../api/llmClient';
import { PromptBuilder } from '../api/promptBuilder';
import { TranslationOptions, TranslationResult } from '../types/translation';
import { MarkdownFormatter } from './markdownFormatter';
import { MarkdownMasker } from './markdownMasker';
import { getTranslation } from '../i18n';

/**
 * 마크다운 문서 번역 및 1:1 병기를 전담하는 코어 파이프라인 엔진
 * - 대용량 문서의 헤딩/문단 기반 스마트 청킹(Smart Chunking)
 * - 옵시디언 고유 문법 마스킹 & 100% 무손실 복원
 * - 단락별 원문 병기(paragraph_bilingual) 포맷팅
 * - 동아시아 볼드 공백 후처리
 */
export class TranslationEngine {
  private client: LLMProxyClient;
  private app: App;
  private displayLanguage?: string;
  private readonly CHUNK_SIZE_THRESHOLD = 1800;

  constructor(client: LLMProxyClient, app: App, displayLanguage?: string) {
    this.client = client;
    this.app = app;
    this.displayLanguage = displayLanguage;
  }

  /** UI 표시 언어 변경 동기화 */
  setDisplayLanguage(lang?: string) {
    this.displayLanguage = lang;
  }

  /**
   * 번역 파이프라인을 실행합니다.
   * @param activeFile 번역 대상 Obsidian TFile 객체
   * @param markdownContent 번역할 마크다운 본문
   * @param options 번역 세부 옵션 (출발어, 도착어, 문체, 스타일, 주석 번역 여부 등)
   * @param customInstruction 사용자 추가 자연어 지시
   * @param onProgress 청크별 번역 진행률 콜백 (현재 청크 번호, 전체 청크 개수)
   * @returns 번역 결과 객체 및 소요 시간, 토큰 사용량 정보
   */
  async runTranslation(
    activeFile: TFile,
    markdownContent: string,
    options: TranslationOptions,
    customInstruction?: string,
    onProgress?: (current: number, total: number, provider?: 'primary' | 'secondary') => void,
    signal?: AbortSignal
  ): Promise<{
    result: TranslationResult;
    totalTimeMs: number;
    tokensPerSec?: number;
    model: string;
    usage?: LLMUsage;
    id?: string;
    finish_reason?: string;
    system_fingerprint?: string;
    created?: number;
    providerUsed?: 'primary' | 'secondary' | 'distributed';
    failedOver?: boolean;
  }> {
    if (signal?.aborted) {
      const abortError = new Error('Task was cancelled by the user.');
      abortError.name = 'AbortError';
      throw abortError;
    }

    // 0. 타임스탬프 선제적 정규식 제거: 원문에 타임스탬프(0:04, 18:11· 등)가 포함된 경우
    //    LLM에 맡기지 않고 코드 레벨에서 100% 무결하게 사전 제거하여 문단을 자연스럽게 연결한 뒤 번역에 전달합니다.
    const hasTimestamps = /(?:(?:\*\*|\(|\[)?(?:\d{1,2}:)?\d{1,2}:\d{2}(?::\d{2})?(?:\*\*|\)|\])?\s*(?:[·•・:–—\-|]|&middot;)?)/.test(markdownContent);
    const contentToTranslate = hasTimestamps
      ? MarkdownFormatter.cleanScriptTimestamps(markdownContent)
      : markdownContent;

    // 1. 단락별 원문 병기(paragraph_bilingual)의 경우 전용 결정론적 파이프라인 또는 단일/청크 번역 수행
    const chunks = this.splitIntoSmartChunks(contentToTranslate, this.CHUNK_SIZE_THRESHOLD);
    const totalChunks = chunks.length;

    let accumulatedTranslatedMarkdown = '';
    let totalTimeMs = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let lastModel = 'auto';
    let lastResponse: LLMResponse | null = null;

    for (let i = 0; i < totalChunks; i++) {
      if (signal?.aborted) {
        const abortError = new Error('Task was cancelled by the user.');
        abortError.name = 'AbortError';
        throw abortError;
      }

      const chunk = chunks[i];
      if (!chunk || !chunk.trim()) continue;

      if (onProgress) {
        onProgress(i + 1, totalChunks);
      }

      // 마크다운 고유 문법 및 보호 요소 마스킹 (위키링크, 태그, 콜아웃, 수식, 코드블록 등)
      const maskResult = MarkdownMasker.mask(chunk, {
        translateCodeComments: options.translateCodeComments
      });

      const { system, user } = PromptBuilder.buildTranslationPrompt(
        maskResult.maskedText,
        options,
        customInstruction
      );

      const response = await this.client.chatCompletion(
        [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        {
          temperature: 0.3,
          max_tokens: 4096,
          signal
        }
      );

      if (response.finish_reason === 'length') {
        console.warn(`Assistant Emily: Translation chunk ${i + 1}/${totalChunks} was truncated by LLM output limit.`);
      }

      lastResponse = response;
      lastModel = response.model || lastModel;
      totalTimeMs += response.totalTimeMs || 0;

      if (response.usage) {
        totalPromptTokens += response.usage.prompt_tokens || 0;
        totalCompletionTokens += response.usage.completion_tokens || 0;
        totalTokens += response.usage.total_tokens || 0;
      }

      let chunkTranslated = MarkdownFormatter.stripThinkingProcess(response.content.trim());

      // 마크다운 코드블록 래핑 언래핑
      if (chunkTranslated.startsWith('```markdown') && chunkTranslated.endsWith('```')) {
        chunkTranslated = chunkTranslated.replace(/^```markdown\n/, '').replace(/\n```$/, '');
      } else if (chunkTranslated.startsWith('```') && chunkTranslated.endsWith('```')) {
        chunkTranslated = chunkTranslated.replace(/^```\w*\n/, '').replace(/\n```$/, '');
      }

      // 코드블록 내부 잔여 thinking 태그/블록 2차 정제
      chunkTranslated = MarkdownFormatter.stripThinkingProcess(chunkTranslated);

      // 마스킹 토큰 원본 복원 & 프론트매터 보존
      let restoredChunk = MarkdownMasker.restore(
        chunkTranslated,
        maskResult.maskMap,
        maskResult.frontmatter
      );

      // 한국어 번역인데 한글이 없거나 번역 본문이 비어있는 경우 (독백만 뱉고 잘린 경우)
      const isTargetKorean = (options.targetLanguage || '').includes('한국어') || (options.targetLanguage || '').toLowerCase().includes('korean');

      // 한국어 번역인 경우 중국어 간체자/한자 유출(Cross-lingual Leakage) 정제
      if (isTargetKorean) {
        restoredChunk = MarkdownFormatter.cleanChineseLeakage(restoredChunk);
      }

      const validation = this.validateTranslationQuality(chunk, restoredChunk, options.targetLanguage);
      let isValidTranslation = validation.isValid;

      // 번역 실패 감지 시 (미번역 영어 누출 또는 CoT 독백 등) 1회 엄격한 다이렉트 프롬프트로 자가 치유(Self-Healing) 재시도
      if (!isValidTranslation && chunk.trim().length > 30) {
        console.warn(`[Assistant Emily] Model '${lastModel}' produced invalid translation (${validation.reason}). Initiating self-healing retry...`);
        const retryUserPrompt = `[CRITICAL - TRANSLATE 100% INTO ${options.targetLanguage} NOW]\nYou previously outputted untranslated English text or monologue. That is STRICTLY PROHIBITED.\nYou MUST translate EVERY SINGLE ENGLISH SENTENCE into ${options.targetLanguage}. NEVER copy or output untranslated English text.\nOutput ONLY the complete translated markdown.\n\n[Source Text]\n${maskResult.maskedText}`;
        const retryResponse = await this.client.chatCompletion(
          [
            { role: 'system', content: `You are an exact markdown translator. Output ONLY the translated markdown text in ${options.targetLanguage}. Do NOT write any thoughts, notes, or explanations.` },
            { role: 'user', content: retryUserPrompt }
          ],
          {
            temperature: 0.1,
            max_tokens: 4096,
            signal
          }
        );

        lastResponse = retryResponse;
        lastModel = retryResponse.model || lastModel;
        totalTimeMs += retryResponse.totalTimeMs || 0;
        if (retryResponse.usage) {
          totalPromptTokens += retryResponse.usage.prompt_tokens || 0;
          totalCompletionTokens += retryResponse.usage.completion_tokens || 0;
          totalTokens += retryResponse.usage.total_tokens || 0;
        }

        let retryTranslated = MarkdownFormatter.stripThinkingProcess(retryResponse.content.trim());
        if (retryTranslated.startsWith('```markdown') && retryTranslated.endsWith('```')) {
          retryTranslated = retryTranslated.replace(/^```markdown\n/, '').replace(/\n```$/, '');
        } else if (retryTranslated.startsWith('```') && retryTranslated.endsWith('```')) {
          retryTranslated = retryTranslated.replace(/^```\w*\n/, '').replace(/\n```$/, '');
        }
        retryTranslated = MarkdownFormatter.stripThinkingProcess(retryTranslated);
        const retryRestored = MarkdownMasker.restore(
          retryTranslated,
          maskResult.maskMap,
          maskResult.frontmatter
        );

        const retryCheck = this.validateTranslationQuality(chunk, retryRestored, options.targetLanguage);
        if (retryCheck.isValid) {
          restoredChunk = retryRestored;
          isValidTranslation = true;
        }
      }

      if (!isValidTranslation && chunk.trim().length > 30) {
        // [Graceful Resilience]: 전체 번역을 중단(Fatal Throw)시키지 않고,
        // 정제된 결과물을 보존하여 끝까지 파일 생성을 완주합니다.
        console.warn(
          `[Assistant Emily] Model '${lastModel}' produced partial or incomplete translation for chunk ${i + 1}/${totalChunks}. Proceeding with sanitized content to ensure completion.`
        );
      }

      accumulatedTranslatedMarkdown += (accumulatedTranslatedMarkdown ? '\n\n' : '') + restoredChunk.trim();
    }

    if (signal?.aborted) {
      const abortError = new Error('Task was cancelled by the user.');
      abortError.name = 'AbortError';
      throw abortError;
    }

    const isTargetKoreanGlobal = (options.targetLanguage || '').includes('한국어') || (options.targetLanguage || '').toLowerCase().includes('korean');

    // 1-1. 잔여 타임스탬프 사후 정규식 정제 (LLM이 우발적으로 생성/보존한 18:11· 등 타임스탬프 원천 제거)
    accumulatedTranslatedMarkdown = MarkdownFormatter.cleanScriptTimestamps(accumulatedTranslatedMarkdown);

    // 1-2. 한국어 번역 대상 중국어 간체자/한자 누출 사후 정제
    if (isTargetKoreanGlobal) {
      accumulatedTranslatedMarkdown = MarkdownFormatter.cleanChineseLeakage(accumulatedTranslatedMarkdown);
    }

    // 2. Obsidian Flavored Markdown (OFM) 전용 무손실 정규화 및 렌더링 자가 치유 수행
    // (헤딩 개행 보정, 콜아웃 연속성, 테이블 구조 정합, HTML 태그 정제 및 동아시아 볼드 조사 공백 자동 처리)
    let finalTranslatedMarkdown = MarkdownFormatter.normalizeObsidianMarkdown(accumulatedTranslatedMarkdown);

    // 2-0. 원본 동영상 링크 및 임베드(![](https://...), <iframe...>) 100% 무손실 확정 복원
    finalTranslatedMarkdown = MarkdownFormatter.ensureVideoEmbedsPreserved(markdownContent, finalTranslatedMarkdown);

    // 2-1. 사용자 선택 서식 제거 (볼드체, 기울이기, 취소선, 하이라이트)
    if (options.formatStripOptions) {
      finalTranslatedMarkdown = MarkdownFormatter.stripMarkdownDecorations(
        finalTranslatedMarkdown,
        options.formatStripOptions
      );
    }

    // 3. 단락별 원문 병기(paragraph_bilingual) 결정론적 1:1 결합 검증 및 정위
    if (options.scope === 'paragraph_bilingual') {
      finalTranslatedMarkdown = this.formatDeterministicBilingual(contentToTranslate, finalTranslatedMarkdown);
    }

    const result: TranslationResult = {
      translatedMarkdown: finalTranslatedMarkdown,
      originalMarkdown: markdownContent,
      chunksCount: totalChunks
    };

    // 4. 보존 전략(Preservation Strategy) 파일 적용
    await this.applyPreservationStrategy(activeFile, markdownContent, finalTranslatedMarkdown, options, result);

    const calculatedTokensPerSec = totalTimeMs > 0 && totalCompletionTokens > 0
      ? Number(((totalCompletionTokens / totalTimeMs) * 1000).toFixed(1))
      : lastResponse?.tokensPerSec;

    return {
      result,
      totalTimeMs,
      tokensPerSec: calculatedTokensPerSec,
      model: lastModel,
      usage: totalTokens > 0 ? {
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        total_tokens: totalTokens
      } : lastResponse?.usage,
      id: lastResponse?.id,
      finish_reason: lastResponse?.finish_reason,
      system_fingerprint: lastResponse?.system_fingerprint,
      created: lastResponse?.created,
      providerUsed: 'primary',
      failedOver: false
    };
  }

  /**
   * 번역 품질 및 유효성을 다각도로 검증합니다 (미번역 원문 복사, 영어 블록 잔여, CoT 독백 등 검출).
   */
  private validateTranslationQuality(
    originalChunk: string,
    translatedChunk: string,
    targetLanguage: string
  ): { isValid: boolean; reason?: string } {
    if (!translatedChunk || !translatedChunk.trim()) {
      return { isValid: false, reason: 'Empty translation output' };
    }

    const isKorean = (targetLanguage || '').includes('한국어') || (targetLanguage || '').toLowerCase().includes('korean');
    if (isKorean) {
      const hangulMatches = translatedChunk.match(/[가-힣]/g) || [];
      const stripped = translatedChunk.replace(/\s+/g, '');

      // 한글이 아예 없거나 너무 짧은 경우
      if (hangulMatches.length < 3 && stripped.length > 30) {
        return { isValid: false, reason: 'No Korean characters found' };
      }

      // 200자 이상의 거대한 미번역 영어 문단이 남아있는 경우 검출 (원문 복사 누출)
      const paragraphs = translatedChunk.split(/\n{2,}/);
      for (const p of paragraphs) {
        const trimmed = p.trim();
        // 마크다운 임베드, 코드블록, 링크, 위키링크는 제외
        if (/^(?:!\[|```|<iframe|https?:\/\/|\[\[)/.test(trimmed)) continue;
        if (trimmed.length > 200) {
          const latinLetters = (trimmed.match(/[a-zA-Z]/g) || []).length;
          const hangulInPara = (trimmed.match(/[가-힣]/g) || []).length;
          // 영어 알파벳이 75% 이상이고 한글이 10자 미만이면 영어 원문 미번역 누출!
          if (latinLetters / trimmed.length > 0.75 && hangulInPara < 10) {
            return { isValid: false, reason: 'Detected untranslated English paragraph block' };
          }
        }
      }
    }

    return { isValid: true };
  }

  /**
   * 대용량 마크다운 문서를 헤딩(##, ###), 문단 단위 및 문장 단위로 스마트 청킹합니다.
   * - 어떤 경우에도 1개 청크가 maxChunkLength(기본 2,500자)를 초과하지 않도록 문장 단위 강제 분할 가드를 제공합니다.
   */
  splitIntoSmartChunks(markdown: string, maxChunkLength: number = 2500): string[] {
    if (!markdown || markdown.length <= maxChunkLength) {
      return [markdown];
    }

    const { frontmatter, body } = MarkdownFormatter.extractFrontmatter(markdown);
    const paragraphs = body.split(/\n{2,}/);
    const rawChunks: string[] = [];
    let currentChunkParagraphs: string[] = [];
    let currentLength = 0;

    for (const rawPara of paragraphs) {
      const para = rawPara.trim();
      if (!para) continue;

      // 만약 단일 문단 자체가 maxChunkLength를 초과하는 경우: 문장 단위 강제 분할
      if (para.length > maxChunkLength) {
        if (currentChunkParagraphs.length > 0) {
          rawChunks.push(currentChunkParagraphs.join('\n\n'));
          currentChunkParagraphs = [];
          currentLength = 0;
        }

        const sentences = para.split(/(?<=[.?!])\s+/);
        let subSentences: string[] = [];
        let subLength = 0;

        for (const sent of sentences) {
          if (subLength + sent.length > maxChunkLength && subSentences.length > 0) {
            rawChunks.push(subSentences.join(' '));
            subSentences = [];
            subLength = 0;
          }
          subSentences.push(sent);
          subLength += sent.length + 1;
        }

        if (subSentences.length > 0) {
          rawChunks.push(subSentences.join(' '));
        }
        continue;
      }

      // 청크 임계 크기 초과 시 분할
      if (currentLength + para.length > maxChunkLength && currentChunkParagraphs.length > 0) {
        rawChunks.push(currentChunkParagraphs.join('\n\n'));
        currentChunkParagraphs = [];
        currentLength = 0;
      }

      currentChunkParagraphs.push(para);
      currentLength += para.length + 2;
    }

    if (currentChunkParagraphs.length > 0) {
      rawChunks.push(currentChunkParagraphs.join('\n\n'));
    }

    // 공백/개행만 있는 빈 청크 원천 배제
    const validChunks = rawChunks.map(c => c.trim()).filter(c => c.length > 0);

    // 첫 번째 청크에 원본 프론트매터 결합
    if (frontmatter && validChunks.length > 0) {
      validChunks[0] = `${frontmatter}\n${validChunks[0]}`;
    }

    return validChunks.length > 0 ? validChunks : [markdown];
  }

  /**
   * 단락별 원문 병기(paragraph_bilingual) 1:1 결정론적 정렬 포맷터
   */
  formatDeterministicBilingual(sourceMarkdown: string, translatedMarkdown: string): string {
    const t = getTranslation(this.displayLanguage);
    const { frontmatter, body: sourceBody } = MarkdownFormatter.extractFrontmatter(sourceMarkdown);
    const { body: transBody } = MarkdownFormatter.extractFrontmatter(translatedMarkdown);

    // 이미 1:1 병기 형태로 도착한 경우 그대로 반환
    if (transBody.includes('📄') || transBody.includes('---')) {
      return frontmatter ? `${frontmatter}${transBody.trimStart()}` : transBody;
    }

    const sourceParagraphs = sourceBody.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const transParagraphs = transBody.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

    // 단락 개수가 유사한 경우 1:1 짝지어 결합
    if (sourceParagraphs.length > 0 && transParagraphs.length > 0 && Math.abs(sourceParagraphs.length - transParagraphs.length) <= 3) {
      const paired: string[] = [];
      const maxLen = Math.max(sourceParagraphs.length, transParagraphs.length);
      for (let i = 0; i < maxLen; i++) {
        const src = sourceParagraphs[i] || '';
        const tr = transParagraphs[i] || '';
        if (src && tr) {
          paired.push(`${src}\n\n> 🌐 **${t.common.translationLabel}**:\n> ${tr.split('\n').join('\n> ')}`);
        } else if (src) {
          paired.push(src);
        } else if (tr) {
          paired.push(`> 🌐 **${t.common.translationLabel}**:\n> ${tr.split('\n').join('\n> ')}`);
        }
      }
      const pairedBody = paired.join('\n\n');
      return frontmatter ? `${frontmatter}${pairedBody}` : pairedBody;
    }

    return translatedMarkdown;
  }

  /**
   * 보존 전략에 따라 문서 수정 또는 새 파일 생성
   */
  async applyPreservationStrategy(
    activeFile: TFile,
    markdownContent: string,
    translatedMarkdown: string,
    options: TranslationOptions,
    result: Partial<TranslationResult>
  ): Promise<void> {
    if (options.preservation === 'new_file') {
      const parentPath = activeFile.parent ? activeFile.parent.path : '';
      const cleanBaseName = activeFile.basename.replace(/(?:_(?:selection|en|ko|ja|zh|zh-tw|de|fr|es|ru|trans)(?:_\d{8}(?:_\d{2,6})?)?)+$/i, '');
      const ext = activeFile.extension || 'md';
      const targetLangSuffix = this.getLanguageSuffix(options.targetLanguage);
      const timeSuffix = this.getTimestampSuffix();
      const scopeSuffix = options.scope === 'selection' ? '_selection' : '';
      const newFileName = `${cleanBaseName}${scopeSuffix}_${targetLangSuffix}_${timeSuffix}.${ext}`;
      const newFilePath = parentPath && parentPath !== '/' ? `${parentPath}/${newFileName}` : newFileName;

      let targetFile = this.app.vault.getAbstractFileByPath(newFilePath);
      if (targetFile instanceof TFile) {
        await this.app.vault.modify(targetFile, translatedMarkdown);
      } else {
        targetFile = await this.app.vault.create(newFilePath, translatedMarkdown);
      }

      result.targetPath = newFilePath;
    } else if (options.preservation === 'append') {
      if (options.scope === 'selection') {
        result.appendedContent = translatedMarkdown;
      } else {
        const t = getTranslation(this.displayLanguage);
        const mergedContent = `${translatedMarkdown}\n\n---\n\n## 📄 ${t.common.originalDocHeader}\n\n${markdownContent}`;
        await this.app.vault.modify(activeFile, mergedContent);
        result.appendedContent = mergedContent;
      }
    } else {
      if (options.scope !== 'selection') {
        await this.app.vault.modify(activeFile, translatedMarkdown);
      }
    }
  }

  private getLanguageSuffix(targetLang: string): string {
    const lower = (targetLang || '').toLowerCase();
    if (lower.includes('영어') || lower.includes('english') || lower.includes('en')) return 'en';
    if (lower.includes('한국어') || lower.includes('korean') || lower.includes('ko')) return 'ko';
    if (lower.includes('일본어') || lower.includes('japanese') || lower.includes('ja')) return 'ja';
    if (lower.includes('간체') || lower.includes('zh-cn') || lower.includes('zh')) return 'zh';
    if (lower.includes('번체') || lower.includes('zh-tw')) return 'zh-tw';
    if (lower.includes('독일어') || lower.includes('german') || lower.includes('de')) return 'de';
    if (lower.includes('프랑스어') || lower.includes('french') || lower.includes('fr')) return 'fr';
    if (lower.includes('스페인어') || lower.includes('spanish') || lower.includes('es')) return 'es';
    if (lower.includes('러시아어') || lower.includes('russian') || lower.includes('ru')) return 'ru';
    return 'trans';
  }

  private getTimestampSuffix(date: Date = new Date()): string {
    const pad = (num: number) => num.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
  }
}

