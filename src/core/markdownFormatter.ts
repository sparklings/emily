import { ConsistencyIssue } from '../types/proofread';
import { getTranslation } from '../i18n';

export class MarkdownFormatter {
  /**
   * 마크다운 문서 최상단의 YAML 프론트매터(--- ... ---)와 본문(Body)을 분리합니다.
   * 프론트매터가 없는 경우 빈 문자열과 원본 전체를 반환합니다.
   */
  static extractFrontmatter(markdown: string): { frontmatter: string; body: string } {
    if (!markdown) return { frontmatter: '', body: '' };

    // 프론트매터는 반드시 문서 최상단 시작점(Index 0)의 --- 로 시작해야 함
    const match = markdown.match(/^---\r?\n([\s\S]*?\r?\n)---(?:\r?\n|$)/);
    if (match) {
      const frontmatter = match[0];
      const body = markdown.slice(frontmatter.length);
      return { frontmatter, body };
    }

    return { frontmatter: '', body: markdown };
  }

  /**
   * 한국어, 일본어, 한자어(중국어)의 마크다운 굵은 글씨(**) 뒤에 조사/문자가 바로 붙어
   * 옵시디언 마크다운 파서에서 볼드가 풀리고 ** 기호가 노출되는 현상을 해결하기 위해
   * 닫는 ** 뒤에 공백(스페이스)을 1칸 추가합니다.
   * (예: **단어**는 -> **단어** 는, **Publisher**라고 -> **Publisher** 라고)
   */
  static fixEastAsianBoldSpacing(markdown: string): string {
    if (!markdown) return markdown;

    // 프론트매터(YAML) 영역은 서식 보정에서 격리/보존
    const { frontmatter, body } = this.extractFrontmatter(markdown);
    const targetText = frontmatter ? body : markdown;

    // 코드 블록(```...```) 내부는 서식 보정에서 제외
    const parts = targetText.split(/(```[\s\S]*?```)/g);
    for (let i = 0; i < parts.length; i += 2) {
      let segment = parts[i];
      // 1. ** 단어 ** 와 같이 볼드 내부 양끝 불필요한 공백 정리 -> **단어**
      segment = segment.replace(/\*\*\s+([^*\n]+?)\s+\*\*/g, '**$1**');

      // 2. [문자]**단어** 앞 스페이스 없는 경우 보정 (예: 는**단어** -> 는 **단어**)
      segment = segment.replace(
        /([가-힣ㄱ-ㅎㅏ-ㅣ\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF])\*\*([^*\n]+?)\*\*/g,
        '$1 **$2**'
      );

      // 3. **단어**[조사/문자] 뒤 스페이스 없는 경우 보정 (예: **단어**는 -> **단어** 는)
      // 한국어(가-힣, ㄱ-ㅎ, ㅏ-ㅣ), 일본어(히라가나, 가타카나), 한자(CJK)
      // ※ 단, 구두점(:, ,, ., !, ?, ), (, ;) 앞에서는 공백을 추가하지 않음
      segment = segment.replace(
        /\*\*([^*\n]+?)\*\*(?![:,.!?;)（）」』】〉〕])\s*([가-힣ㄱ-ㅎㅏ-ㅣ\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF])/g,
        '**$1** $2'
      );

      // 4. LLM이 구두점 앞에 잘못 삽입한 공백 제거 (예: **단어** : -> **단어**: / **단어** , -> **단어**,)
      segment = segment.replace(
        /\*\*([^*\n]+?)\*\*\s+([:,.!?;)）」』】〉〕])/g,
        '**$1**$2'
      );

      parts[i] = segment;
    }

    const processedBody = parts.join('');
    if (frontmatter) {
      return `${frontmatter}${processedBody}`;
    }
    return processedBody;
  }

  /**
   * 한국어 굵은 글씨 조사 서식 보정 (별칭)
   */
  static fixKoreanBoldFormatting(markdown: string): string {
    return this.fixEastAsianBoldSpacing(markdown);
  }

  /**
   * 내부 일관성 불일치 Callout 블록 생성
   */
  static createConsistencyCallout(issue: ConsistencyIssue, displayLang?: string): string {
    const t = getTranslation(displayLang);
    const lines = [
      `> [!warning] ${t.common.consistencyCalloutTitle}`,
      `> **${t.common.consistencySourceLinked}**: [[${issue.sourceFile}]]`,
      `> ${t.common.consistencyCurrentContent}: \`${issue.originalText}\``,
      `> ${t.common.consistencySourceContent}: \`${issue.sourceText}\``,
      `> ${t.common.consistencyExplanation}: ${issue.explanation}`,
      issue.suggestedReplacement ? `> **${t.common.consistencySuggestion}**: \`${issue.suggestedReplacement}\`` : ''
    ].filter(Boolean);

    return '\n' + lines.join('\n') + '\n';
  }

  /**
   * 문서 내 특정 텍스트 치환
   */
  static replaceTextInDoc(doc: string, original: string, replacement: string): string {
    if (!original || !doc.includes(original)) {
      return doc;
    }
    return doc.split(original).join(replacement);
  }

  /**
   * 유튜브 및 영상 스크립트의 타임스탬프(0:04, 0:27:, **1:29**:, [00:15], (12:34) 등)와 잦은 줄바꿈 정리
   * 원문의 단어나 내용을 임의로 삭제/요약하지 않고 원문 그대로 단락 단위로 결합(Concatenation)합니다.
   * YAML 프론트매터(Frontmatter)는 100% 원본 그대로 완벽하게 보존합니다.
   */
  static cleanScriptTimestamps(text: string): string {
    if (!text) return text;

    // 1. 프론트매터(Frontmatter) 분리 및 100% 원본 격리
    const { frontmatter, body } = this.extractFrontmatter(text);
    if (!body && frontmatter) return frontmatter;

    // 2. 본문(Body) 영역에 대해서만 타임스탬프 패턴 일괄 정리
    // 예: 0:00:, 0:27:, **1:29**:, **1:51**, [00:15], (12:34), 1:23:45 등
    let cleaned = body.replace(/(?:\*\*|\(|\[)?\b\d{1,2}:\d{2}(?::\d{2})?\b(?:\*\*|\)|\])?:?\s*/g, '');

    // 3. 줄 단위 분할 및 문단 단위 Concatination
    const lines = cleaned.split(/\r?\n/);
    const cleanedParagraphs: string[] = [];
    let currentParagraph: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // 빈 줄이면 현재 단락 flush
      if (!line) {
        if (currentParagraph.length > 0) {
          cleanedParagraphs.push(currentParagraph.join(' '));
          currentParagraph = [];
        }
        continue;
      }

      // 마크다운 블록 요소(헤딩, 콜아웃, 구분선, 리스트, 이미지/임베드, 위키링크 등)는 독립 줄로 보존
      if (/^(?:#{1,6}\s+|>\s*|---\s*$|\*\*\*[^*]+\*\*\*|[-*+]\s+|\d+\.\s+|!\[.*\]\(.*\)|\[\[.*\]\])/.test(line)) {
        if (currentParagraph.length > 0) {
          cleanedParagraphs.push(currentParagraph.join(' '));
          currentParagraph = [];
        }
        cleanedParagraphs.push(line);
        continue;
      }

      // 일반 문장 줄은 현재 문단에 결합 (원문 단어 100% 보존)
      currentParagraph.push(line);
    }

    if (currentParagraph.length > 0) {
      cleanedParagraphs.push(currentParagraph.join(' '));
    }

    // 문단 사이는 표준 마크다운 문단 간격(\n\n)으로 결합
    const cleanedBody = cleanedParagraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

    // 4. 격리 보존된 원본 프론트매터와 정위된 본문을 안전하게 재결합
    if (frontmatter) {
      const formattedFrontmatter = frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n';
      return cleanedBody ? `${formattedFrontmatter}\n${cleanedBody}` : formattedFrontmatter.trimEnd();
    }

    return cleanedBody;
  }
}
