import { App, TFile } from 'obsidian';
import { LLMProxyClient } from '../api/llmClient';
import { PromptBuilder } from '../api/promptBuilder';
import { ConsistencyIssue } from '../types/proofread';
import { MarkdownFormatter } from './markdownFormatter';

/**
 * 지식 볼트(Vault) 내부 문서 간 상호 일관성 검증을 수행하는 엔진 클래스
 * - 참조 소스 문서의 사실/수치와 현재 문서를 비교하여 불일치 발견 시 콜아웃 삽입
 */
export class ConsistencyEngine {
  private client: LLMProxyClient;
  private app: App;

  constructor(client: LLMProxyClient, app: App) {
    this.client = client;
    this.app = app;
  }

  /**
   * 참조 소스 문서와 현재 문서 간 일관성 검사를 실행합니다.
   * @param currentDoc 현재 마크다운 본문
   * @param sourceFilePath 볼트 내 참조 소스 파일 경로
   * @returns 감지된 일관성 이슈 목록, 콜아웃이 주입된 마크다운, 소요 시간
   */
  async runConsistencyCheck(
    currentDoc: string,
    sourceFilePath: string
  ): Promise<{ issues: ConsistencyIssue[]; injectedMarkdown: string; totalTimeMs: number; model: string }> {
    const file = this.app.vault.getAbstractFileByPath(sourceFilePath);
    if (!(file instanceof TFile)) {
      throw new Error(`Referenced source file not found: ${sourceFilePath}`);
    }

    const sourceDocContent = await this.app.vault.read(file);
    const { system, user } = PromptBuilder.buildConsistencyPrompt(currentDoc, sourceDocContent, file.basename);

    const response = await this.client.chatCompletion(
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      { temperature: 0.1 }
    );

    const issues = this.parseConsistencyIssues(response.content, file.basename);

    let injectedMarkdown = currentDoc;
    for (const issue of issues) {
      const callout = MarkdownFormatter.createConsistencyCallout(issue);
      // 이슈 텍스트 바로 뒤에 콜아웃 삽입
      if (injectedMarkdown.includes(issue.originalText)) {
        injectedMarkdown = injectedMarkdown.replace(issue.originalText, `${issue.originalText}\n${callout}`);
      } else {
        injectedMarkdown += `\n${callout}`;
      }
    }

    return {
      issues,
      injectedMarkdown,
      totalTimeMs: response.totalTimeMs,
      model: response.model
    };
  }

  private parseConsistencyIssues(content: string, sourceFileName: string): ConsistencyIssue[] {
    try {
      let jsonStr = content.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }

      interface ParsedConsistencyResult {
        issues?: Array<Partial<ConsistencyIssue>>;
      }
      const parsed = JSON.parse(jsonStr) as ParsedConsistencyResult;
      if (Array.isArray(parsed?.issues)) {
        return parsed.issues.map((item: Partial<ConsistencyIssue>) => ({
          originalText: item.originalText || '',
          sourceText: item.sourceText || '',
          sourceFile: item.sourceFile || sourceFileName,
          discrepancyType: item.discrepancyType || 'contradiction',
          explanation: item.explanation || '',
          suggestedReplacement: item.suggestedReplacement
        }));
      }
      return [];
    } catch {
      console.warn('[Assistant Emily] Could not parse consistency check response:', content);
      return [];
    }
  }
}
