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
  private readonly CHUNK_SIZE_THRESHOLD = 3500;

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
    onProgress?: (current: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<{ result: TranslationResult; totalTimeMs: number; tokensPerSec?: number; model: string; usage?: LLMUsage; id?: string; finish_reason?: string; system_fingerprint?: string; created?: number }> {
    if (signal?.aborted) {
      const abortError = new Error('Task was cancelled by the user.');
      abortError.name = 'AbortError';
      throw abortError;
    }

    // 1. 단락별 원문 병기(paragraph_bilingual)의 경우 전용 결정론적 파이프라인 또는 단일/청크 번역 수행
    const chunks = this.splitIntoSmartChunks(markdownContent, this.CHUNK_SIZE_THRESHOLD);
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

      if (onProgress) {
        onProgress(i + 1, totalChunks);
      }

      const chunk = chunks[i];

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
        { temperature: 0.3, signal }
      );

      lastResponse = response;
      lastModel = response.model || lastModel;
      totalTimeMs += response.totalTimeMs || 0;

      if (response.usage) {
        totalPromptTokens += response.usage.prompt_tokens || 0;
        totalCompletionTokens += response.usage.completion_tokens || 0;
        totalTokens += response.usage.total_tokens || 0;
      }

      let chunkTranslated = response.content.trim();

      // 마크다운 코드블록 래핑 언래핑
      if (chunkTranslated.startsWith('```markdown') && chunkTranslated.endsWith('```')) {
        chunkTranslated = chunkTranslated.replace(/^```markdown\n/, '').replace(/\n```$/, '');
      } else if (chunkTranslated.startsWith('```') && chunkTranslated.endsWith('```')) {
        chunkTranslated = chunkTranslated.replace(/^```\w*\n/, '').replace(/\n```$/, '');
      }

      // 마스킹 토큰 원본 복원 & 프론트매터 보존
      const restoredChunk = MarkdownMasker.restore(
        chunkTranslated,
        maskResult.maskMap,
        maskResult.frontmatter
      );

      accumulatedTranslatedMarkdown += (accumulatedTranslatedMarkdown ? '\n\n' : '') + restoredChunk.trim();
    }

    if (signal?.aborted) {
      const abortError = new Error('Task was cancelled by the user.');
      abortError.name = 'AbortError';
      throw abortError;
    }

    // 2. 동아시아 볼드 닫는 태그 뒤 조사 공백 자동 보정 (**단어**는 -> **단어** 는)
    let finalTranslatedMarkdown = MarkdownFormatter.fixEastAsianBoldSpacing(accumulatedTranslatedMarkdown);

    // 3. 단락별 원문 병기(paragraph_bilingual) 결정론적 1:1 결합 검증 및 정위
    if (options.scope === 'paragraph_bilingual') {
      finalTranslatedMarkdown = this.formatDeterministicBilingual(markdownContent, finalTranslatedMarkdown);
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
      created: lastResponse?.created
    };
  }

  /**
   * 대용량 마크다운 문서를 헤딩(##, ###) 및 문단 단위로 스마트 청킹합니다.
   */
  splitIntoSmartChunks(markdown: string, maxChunkLength: number = 3500): string[] {
    if (!markdown || markdown.length <= maxChunkLength) {
      return [markdown];
    }

    const { frontmatter, body } = MarkdownFormatter.extractFrontmatter(markdown);
    const lines = body.split(/\r?\n/);
    const chunks: string[] = [];
    let currentChunkLines: string[] = [];
    let currentLength = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isHeader = /^#{1,6}\s+/.test(line);

      // 청크 임계 크기 초과 & 헤딩 또는 빈 줄 경계에서 분할
      if (currentLength + line.length > maxChunkLength && (isHeader || currentChunkLines.length > 30)) {
        if (currentChunkLines.length > 0) {
          chunks.push(currentChunkLines.join('\n'));
          currentChunkLines = [];
          currentLength = 0;
        }
      }

      currentChunkLines.push(line);
      currentLength += line.length + 1;
    }

    if (currentChunkLines.length > 0) {
      chunks.push(currentChunkLines.join('\n'));
    }

    // 첫 번째 청크에 원본 프론트매터 결합
    if (frontmatter && chunks.length > 0) {
      chunks[0] = `${frontmatter}${chunks[0].trimStart()}`;
    }

    return chunks.length > 0 ? chunks : [markdown];
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

