import { MarkdownFormatStripOptions } from '../types/translation';

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
   * 문서 내 특정 텍스트 치환
   */
  static replaceTextInDoc(doc: string, original: string, replacement: string): string {
    if (!original || !doc.includes(original)) {
      return doc;
    }
    return doc.split(original).join(replacement);
  }

  /**
   * 영상 클리핑 문서의 지능적 영역 분할(Section Partitioning) 정제:
   * 1. [동영상 임베드 및 링크 100% 무손실 보존]:
   *    - ![](https://www.youtube.com/...), <iframe...>, https://youtu.be/... 등 동영상 플레이어/임베드는 원형 그대로 보존
   * 2. [메타데이터 & 목차(TOC) 영역 원형 보존]:
   *    - '## Transcript' 또는 스크립트 본문 이전의 설명, 소개, 연락처(Connect/Newsletter/Email) 줄바꿈은 100% 그대로 유지
   *    - 'Timestamps:', 'Chapters:' 아래의 목차 타임스탬프(0:00 설명, 1:57 BEGINNER 등)는 절대 지우지 않고 목차 리스트로 100% 원형 보존
   * 3. [스크립트 본문(Transcript) 영역 전용 정제]:
   *    - 오직 '## Transcript' 이하의 스크립트 본문에 대해서만 타임스탬프(**0:00** ·, 0:27 - 등)를 제거하고,
   *      파편화된 자막 줄바꿈을 400~600자 단위의 자연스러운 호흡을 가진 마크다운 문단으로 결합
   * YAML 프론트매터(Frontmatter)는 100% 원본 그대로 완벽하게 보존합니다.
   */
  static cleanScriptTimestamps(text: string): string {
    if (!text) return text;

    // 1. 프론트매터(Frontmatter) 분리 및 100% 원본 격리
    const { frontmatter, body } = this.extractFrontmatter(text);
    if (!body && frontmatter) return frontmatter;

    const lines = body.split(/\r?\n/);

    // 2. Transcript (스크립트 본문) 시작 라인 인덱스 탐색
    let transcriptLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      // '## Transcript', '# Transcript', '### Transcript', '**Transcript**' 등
      if (/^#{1,4}\s+Transcript\b/i.test(trimmed) || /^(?:\*\*|__)?Transcript(?:\*\*|__)?[:：]?$/i.test(trimmed)) {
        transcriptLineIdx = i;
        break;
      }
    }

    // 만약 명시적인 Transcript 헤더가 없는 경우:
    // 타임스탬프로 시작하고 30자 이상 긴 문장이 이어지는 실제 자막 본문 시작점 탐색
    if (transcriptLineIdx === -1) {
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (/^(?:Timestamps|Chapters|타임스탬프|목차):?$/i.test(trimmed)) {
          continue;
        }
        if (/(?:\*\*|\(|\[)?(?:\d{1,2}:)?\d{1,2}:\d{2}(?::\d{2})?(?:\*\*|\)|\])?\s*(?:[·•・:–—\-|]|&middot;)?\s*.{30,}/.test(trimmed)) {
          transcriptLineIdx = i;
          break;
        }
      }
    }

    // 영역 A: 메타데이터 & 목차 (Transcript 이전)
    // 영역 B: 스크립트 본문 (Transcript 이후)
    const metaLines = transcriptLineIdx !== -1 ? lines.slice(0, transcriptLineIdx) : [];
    const transcriptLines = transcriptLineIdx !== -1 ? lines.slice(transcriptLineIdx) : lines;

    // 3. 메타/목차 영역 정제:
    // - 동영상 링크/임베드 100% 보존
    // - 목차(Timestamps)의 타임스탬프 100% 보존
    // - Connect, Newsletter 등 줄바꿈 100% 보존 (절대 문단으로 합치지 않음!)
    const cleanedMetaLines: string[] = [];
    for (let i = 0; i < metaLines.length; i++) {
      const rawLine = metaLines[i];
      const trimmed = rawLine.trim();

      // 단독 챕터/목차 줄: "0:00 What is Gemini Notebook" -> "- 0:00 What is Gemini Notebook" (타임스탬프 100% 보존!)
      const chapterMatch = trimmed.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      if (chapterMatch) {
        cleanedMetaLines.push(`- ${chapterMatch[1]} ${chapterMatch[2]}`);
        continue;
      }

      // 목차 헤더 "Timestamps:" -> "### Timestamps"
      if (/^(?:Timestamps|Chapters|타임스탬프|목차):?$/i.test(trimmed)) {
        cleanedMetaLines.push(`### ${trimmed.replace(/:$/, '')}`);
        continue;
      }

      // 원본 줄바꿈과 내용 그대로 보존 (공백 줄도 마크다운 구조 보존)
      cleanedMetaLines.push(rawLine);
    }

    // 4. 스크립트 본문 영역 정제:
    // - '## Transcript' 헤더 자체는 보존
    // - 스크립트 줄에 있는 타임스탬프(**0:00** · 등)를 제거하고 문단으로 리플로우
    const cleanedScriptParagraphs: string[] = [];
    let currentScriptParagraph: string[] = [];
    let currentScriptLength = 0;

    for (let i = 0; i < transcriptLines.length; i++) {
      const rawLine = transcriptLines[i];
      const line = rawLine.trim();

      if (!line) {
        if (currentScriptParagraph.length > 0) {
          cleanedScriptParagraphs.push(currentScriptParagraph.join(' '));
          currentScriptParagraph = [];
          currentScriptLength = 0;
        }
        continue;
      }

      // 헤딩(#)이나 구분선(---)은 독립 줄로 보존
      if (/^(?:#{1,6}\s+|---\s*$|\*\*\*[^*]+\*\*\*)/.test(line)) {
        if (currentScriptParagraph.length > 0) {
          cleanedScriptParagraphs.push(currentScriptParagraph.join(' '));
          currentScriptParagraph = [];
          currentScriptLength = 0;
        }
        cleanedScriptParagraphs.push(line);
        continue;
      }

      // 스크립트 타임스탬프 제거: **0:00** ·, 0:27:, [00:15], 18:11· 등
      let cleanedLine = line.replace(/(?:\*\*|\(|\[)?(?:\d{1,2}:)?\d{1,2}:\d{2}(?::\d{2})?(?:\*\*|\)|\])?\s*(?:[·•・:–—\-|]|&middot;)?\s*/g, ' ');
      cleanedLine = cleanedLine.replace(/([.?!])\s+/g, '$1 ').replace(/[ \t]+/g, ' ').trim();

      if (cleanedLine) {
        currentScriptParagraph.push(cleanedLine);
        currentScriptLength += cleanedLine.length;

        // 자연스러운 문단 호흡: 400~600자 이상이고 문장이 종결(., !, ?)되었을 때 문단 분할
        if (currentScriptLength >= 400 && /[.?!]$/.test(cleanedLine)) {
          cleanedScriptParagraphs.push(currentScriptParagraph.join(' '));
          currentScriptParagraph = [];
          currentScriptLength = 0;
        }
      }
    }

    if (currentScriptParagraph.length > 0) {
      cleanedScriptParagraphs.push(currentScriptParagraph.join(' '));
    }

    const metaPart = cleanedMetaLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const scriptPart = cleanedScriptParagraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

    let combinedBody = '';
    if (metaPart && scriptPart) {
      combinedBody = `${metaPart}\n\n${scriptPart}`;
    } else {
      combinedBody = metaPart || scriptPart;
    }

    if (frontmatter) {
      const formattedFrontmatter = frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n';
      return combinedBody ? `${formattedFrontmatter}\n${combinedBody}` : formattedFrontmatter.trimEnd();
    }

    return combinedBody;
  }

  /**
   * 마크다운 텍스트에서 동영상 임베드 및 플레이어 링크 태그를 추출합니다.
   */
  static extractVideoEmbeds(markdown: string): string[] {
    if (!markdown) return [];
    const embeds: string[] = [];
    const patterns = [
      /!\[[^\]\n]*\]\((?:https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)[^\)\n]+)\)/g,
      /<iframe[\s\S]*?(?:youtube\.com|youtu\.be|vimeo\.com)[\s\S]*?<\/iframe>/gi,
      /(?:^|\n)(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)[^\s\n]*)(?=\n|$)/g
    ];
    for (const pat of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pat.exec(markdown)) !== null) {
        const item = match[0].trim();
        if (item && !embeds.includes(item)) {
          embeds.push(item);
        }
      }
    }
    return embeds;
  }

  /**
   * 번역 완료된 텍스트에 원본 동영상 임베드가 누락된 경우,
   * 프론트매터 바로 아래 또는 문서 최상단에 100% 무손실로 확정 복원합니다.
   */
  static ensureVideoEmbedsPreserved(sourceMarkdown: string, translatedMarkdown: string): string {
    const embeds = this.extractVideoEmbeds(sourceMarkdown);
    if (embeds.length === 0) return translatedMarkdown;

    let result = translatedMarkdown;
    for (const embed of embeds) {
      if (!result.includes(embed)) {
        const { frontmatter, body } = this.extractFrontmatter(result);
        if (frontmatter) {
          const fm = frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n';
          result = `${fm}\n${embed}\n\n${body.trimStart()}`;
        } else {
          result = `${embed}\n\n${result.trimStart()}`;
        }
      }
    }
    return result;
  }

  static cleanChineseLeakage(text: string): string {
    if (!text) return text;

    const { frontmatter, body } = this.extractFrontmatter(text);
    let target = body;

    // 대표적인 중국어 간체 표현 사전 매핑 (LLM 교차 언어 누출 빈출 어휘)
    const chineseToKoreanMap: Array<[RegExp, string]> = [
      [/我们所拥有的/g, '우리가 가진 것'],
      [/我们所没有的/g, '우리에게 없는 것'],
      [/所拥有的/g, '가진 것'],
      [/所没有的/g, '없는 것'],
      [/我们/g, '우리'],
      [/他们/g, '그들'],
      [/这个/g, '이것'],
      [/那个/g, '저것'],
      [/以及/g, '및'],
      [/可以/g, '할 수 있다'],
      [/进行/g, '진행'],
      [/没有/g, '없다'],
      [/拥有/g, '보유'],
      [/但是/g, '하지만'],
      [/因为/g, '왜냐하면'],
      [/所以/g, '따라서']
    ];

    for (const [pattern, replacement] of chineseToKoreanMap) {
      target = target.replace(pattern, replacement);
    }

    if (frontmatter) {
      const formattedFm = frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n';
      return `${formattedFm}${target.trimStart()}`;
    }
    return target;
  }

  /**
   * 마크다운 문서에서 볼드체(**, __), 기울이기(*, _), 취소선(~~), 하이라이트(==) 서식을
   * 사용자가 선택한 옵션에 따라 선택적으로 제거합니다.
   * - YAML 프론트매터(Frontmatter), 코드 블록(```...```), 인라인 코드(`...`),
   *   수식($...$, $$...$$), 위키링크([[...]]), 이미지(![...]()), 수평선(---, ***)은
   *   100% 무손실 보존·격리한 상태에서 본문 인라인 서식만을 안전하게 정제합니다.
   */
  static stripMarkdownDecorations(markdown: string, options: MarkdownFormatStripOptions = {}): string {
    if (!markdown) return markdown;
    const { stripBold, stripItalic, stripStrikethrough, stripHighlight } = options;
    if (!stripBold && !stripItalic && !stripStrikethrough && !stripHighlight) {
      return markdown;
    }

    // 1. YAML 프론트매터 분리
    const { frontmatter, body } = this.extractFrontmatter(markdown);
    let target = frontmatter ? body : markdown;

    // 2. 보호 대상 요소 마스킹 (코드, 수식, 링크, 수평선)
    const tokens = new Map<string, string>();
    let counter = 0;
    const mask = (val: string): string => {
      const token = `__EMILY_FMT_PROTECT_${counter++}__`;
      tokens.set(token, val);
      return token;
    };

    // 2-1. 코드 블록 (```...```)
    target = target.replace(/```[\s\S]*?```/g, mask);

    // 2-2. 인라인 코드 (`...`)
    target = target.replace(/`[^`\r\n]+?`/g, mask);

    // 2-3. 블록 수식 ($$...$$) 및 인라인 수식 ($...$)
    target = target.replace(/\$\$[\s\S]*?\$\$/g, mask);
    target = target.replace(/(?<!\\)\$(?!\$)[^$\r\n]+?(?<!\\)\$/g, mask);

    // 2-4. 마크다운 수평선 (***, ---, ___ 단독 라인)
    target = target.replace(/^[ \t]*(?:[*_-][ \t]*){3,}[ \t]*$/gm, mask);

    // 2-5. 옵시디언 위키링크 및 이미지 (![[...]], [[...]])
    target = target.replace(/!?\[\[[^\]\r\n]+?\]\]/g, mask);

    // 2-6. 마크다운 링크 URL 영역 ([text](URL))
    target = target.replace(
      /\[([^\]\r\n]*?)\]\(([^)\r\n]+?)\)/g,
      (_match: string, text: string, url: string): string => {
        return `[${text}](${mask(url)})`;
      }
    );

    // 3. 서식 제거 연산 수행
    // 3-1. 복합 서식 (볼드+기울임: ***text*** 또는 ___text___)
    if (stripBold || stripItalic) {
      target = target.replace(
        /\*\*\*([^*\r\n]+?)\*\*\*/g,
        (_match: string, inner: string): string => {
          if (stripBold && stripItalic) return inner;
          if (stripBold) return `*${inner}*`;
          return `**${inner}**`;
        }
      );
      target = target.replace(
        /___([^_\r\n]+?)___/g,
        (_match: string, inner: string): string => {
          if (stripBold && stripItalic) return inner;
          if (stripBold) return `_${inner}_`;
          return `__${inner}__`;
        }
      );
    }

    // 3-2. 볼드체 제거 (**text** 또는 __text__)
    if (stripBold) {
      target = target.replace(/\*\*([^*\r\n]+?)\*\*/g, '$1');
      target = target.replace(/(?<=^|[^\w])__([^_\r\n]+?)__(?=[^\w]|$)/g, '$1');
    }

    // 3-3. 취소선 제거 (~~text~~)
    if (stripStrikethrough) {
      target = target.replace(/~~([^~\r\n]+?)~~/g, '$1');
    }

    // 3-4. 하이라이트 제거 (==text==)
    if (stripHighlight) {
      target = target.replace(/==([^=\r\n]+?)==/g, '$1');
    }

    // 3-5. 기울이기 제거 (*text* 또는 _text_)
    // 리스트 불릿(* item)이나 곱셈 기호와 오작동하지 않도록 양끝 비공백/구분자 조건 확인
    if (stripItalic) {
      target = target.replace(/(?<=^|[^*])\*([^*\r\n\s](?:[^*\r\n]*?[^*\r\n\s])?)\*(?!\*)/g, '$1');
      target = target.replace(/(?<=^|[^\w])_([^_\r\n\s](?:[^_\r\n]*?[^_\r\n\s])?)_(?=[^\w]|$)/g, '$1');
    }

    // 4. 보호된 토큰 복원 (역순으로 안전 치환)
    for (const [token, original] of tokens.entries()) {
      target = target.split(token).join(original);
    }

    // 5. 프론트매터 재결합
    if (frontmatter) {
      const formattedFrontmatter = frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n';
      return target ? `${formattedFrontmatter}${target}` : formattedFrontmatter.trimEnd();
    }

    return target;
  }

  /**
   * 주어진 라인이 LLM의 내부 추론(Chain-of-Thought), 프롬프트 지침 복기,
   * 번역 초안 매핑(A -> B), 또는 메타 독백 라인인지 판정합니다.
   */
  private static isCoTOrMetaLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return true; // 빈 줄은 CoT 스캔 단계에서 공백으로 취급

    // 1. 영어/한국어 추론 독백 시작 패턴
    // "The user wants me to...", "I need to...", "Let's review...", "Wait, ...", "Okay, ...", "So, ...", "In this chunk..."
    if (/^(?:The user (?:wants|asked|provides|needs|requested|is asking)|I (?:need to|must|should|will|have to|can|am asked to|'ll)|We (?:need to|must|are asked to|should|can)|Let's (?:review|analyze|examine|check|first|start|proceed|write|look|translate|double check|use|keep|render|say|go with|do|make|refine)|Let us\b|Okay,|So,|Wait,|Looking at\b|First,|Second,|Third,|Finally,|Note that\b|In this (?:chunk|document|text|section)|My task|As instructed|According to the|The instruction says\b|This means do not\b|This means\b)\b/i.test(trimmed)) {
      return true;
    }

    // 2. 가이드라인 / 설정 / 프롬프트 항목 복기 (영어 또는 한국어)
    // 예: "Role: ...", "Target language: Korean", "도착어: 한국어", "Tone: ...", "- 문체(Tone): ...", "Translate all: ...", "출발어: ...", "번역 범위: ...", "Code comment: ..."
    if (/^(?:[-*•]\s*)?(?:Role|Target language|Source language|Tone|Style|Translation scope|Scope|Code block comments|Code comment(?:s)?|Translate(?:\s+all|\s+the|\s+each|\s+comments)?|Preserve|Formatting(?:\s+restrictions)?|Guidelines|Requirements|Correct example|Incorrect example|Headings|Obsidian callouts|No HTML tags|Remove timestamps|YAML frontmatter|Obsidian Markdown|도착어|출발어|문체|스타일|번역 범위|주의사항|필수 지침|출력 절대 원칙)\b[:：]/i.test(trimmed)) {
      return true;
    }

    // 2-1. 원문 시작 안내 라인 ("The original text starts with:", "The translated text is:")
    if (/^(?:The original text starts with|The text starts with|Original text starts with|The translated text is|Translated text:?):?$/i.test(trimmed)) {
      return true;
    }

    // 3. 지침 불릿 복기 라인
    // 예: "- Output ONLY ...", "- Translate all ...", "- Do not use ...", "- Keep ...", "- Preserve ..."
    if (/^[-*•]\s*(?:Output|Translate|The tone|Do not|Note|Let's|Preserve|Keep|Target language|Tone|Style|Check|Ensure|Avoid)\b/i.test(trimmed)) {
      return true;
    }

    // 4. 번역 매핑 초안 또는 검토 메모 라인
    // 예: "[Module 1: Introduction] -> [모듈 1: 소개]", "NetBox overview -> NetBox 개요 (good)", "A => B", "A → B"
    if (/^\[?[^\]\n]+\]?\s*(?:->|=>|→)\s*\[?[^\]\n]+\]?(?:\s*\([^)]*\))?$/.test(trimmed)) {
      return true;
    }
    // 예: "(good)", "(ok)", "(keep)"으로 끝나는 번역 메모
    if (/\((?:good|ok|keep|check|refined)\)\s*$/i.test(trimmed) && /(?:->|=>|→|translate|개요|소개)/i.test(trimmed)) {
      return true;
    }
    // 예: "(no bold)", "(no bold, just a link)" 등 모델의 서식 독백 라인
    if (/^[-*•]?\s*.*?\((?:no bold|just a link|no italics?|only link|plain text)[^)]*\)\s*$/i.test(trimmed) && !/[가-힣]/.test(trimmed)) {
      return true;
    }

    // 5. 초안/스텝/메타 섹션 헤더
    // 예: "### 3. Draft the Translation (Segment by Segment):", "**Drafting:**", "Draft the Translation"
    if (/^(?:#{1,6}\s*|\*\*|\[)?(?:\d+\.\s*)?(?:Draft(?:ing)?(?:\s+(?:the\s+)?Translation)?|Thought Process|Thinking Process|Analysis|Original text)(?:\s*\([^)]*\))?(?:\s*#*|\*\*|\])?:?$/i.test(trimmed)) {
      return true;
    }

    // 6. 단독 백틱 토큰 나열 또는 메타 단어 ("`word`", "etc.", "and so on.")
    if (/^`[^`\r\n]+`$/.test(trimmed) || /^(?:etc\.|etc|and so on\.?)$/i.test(trimmed)) {
      return true;
    }

    // 7. 안내 멘트 라벨 단독 라인
    if (/^(?:Here is the (?:translation|translated document|Korean translation|final translation)|최종\s*번역(?:\s*결과)?|번역\s*결과):?$/i.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * LLM 응답에 포함될 수 있는 <think> 태그, 영문 추론 독백(Chain-of-thought),
   * 프롬프트 복기("The user wants me to..."), "Thinking Process:" 블록,
   * 초안 매핑("A -> B"), reasoning 코드블록 등을 안전하게 제거하여 순수 본문만 추출합니다.
   */
  static stripThinkingProcess(rawContent: string): string {
    if (!rawContent) return '';
    let text = rawContent.trim();

    // 1. <think>...</think> 및 <thought>...</thought> 태그 제거 (DeepSeek-R1, QwQ 등)
    text = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/<thought\b[^>]*>[\s\S]*?<\/thought>/gi, '').trim();

    // 2. 미완결 <think> 태그 처리 (출력 토큰 제한으로 닫는 태그가 잘린 경우)
    if (/<think\b[^>]*>/i.test(text) && !/<\/think>/i.test(text)) {
      text = text.replace(/<think\b[^>]*>[\s\S]*$/gi, '').trim();
    }
    if (/<thought\b[^>]*>/i.test(text) && !/<\/thought>/i.test(text)) {
      text = text.replace(/<thought\b[^>]*>[\s\S]*$/gi, '').trim();
    }

    // 3. ```thought ... ``` 또는 ```reasoning ... ``` 코드블록 제거
    text = text.replace(/```(?:thought|reasoning)[\s\S]*?```/gi, '').trim();

    // 4. 빈 입력 등으로 인한 LLM의 메타 거절/독백 안내문 제거
    text = text.replace(/^(?:We need to translate a markdown document, but the user hasn't provided|Please provide the (?:markdown|text|content)|It looks like you didn't provide|As an AI language model, I need)[\s\S]*$/i, '').trim();

    // 4-1. 시스템 프롬프트 복기(Echo) 블록 일괄 제거 (예: "- Role: Professional ...", "- No preamble ... The original text starts with:")
    text = text.replace(/^(?:[-*•]\s*)?(?:Role:\s*Professional|No preamble|Use academic|No Chinese characters|Pure Korean)[\s\S]*?(?:The original text starts with:?|The text starts with:?|starts with:?|translated:?)\s*/gi, '').trim();

    // 4-2. "Then the intro:", "Then the ... :", "About Me section:" 등 메타 프레이밍 라벨 제거
    text = text.replace(/(?:^|\n)(?:Then the (?:intro|section|body|text|overview)|About Me section)[:：]\s*(?:"|')?/gi, '\n').trim();

    // 4-3. "BEGINNER, INTERMEDIATE, PRO sections, About Me, Transcript, etc." 같은 요약 독백 라인 제거
    text = text.replace(/(?:^|\n)[A-Z\s,]+(?:sections?|Transcript|About Me),?\s*etc\.?\s*(?:\n|$)/gi, '\n').trim();

    // 5. 시작부 CoT 독백 ("The user wants me to...", "Let's review the guidelines:", "Target language:...") 감지 및 정제
    const cotStartRegex = /^(?:The user (?:wants|asked|provides|needs|requested|is asking)|I (?:need to|must|should|will|am asked to)|Let's (?:review|analyze|examine|first|check|start)|Okay, (?:I will|let's)|We (?:need to|are asked to)|Target language:|도착어:)/i;
    const initialLines = text.split('\n');
    const firstNonEmptyLine = initialLines.find(l => l.trim().length > 0) || '';
    const hasInitialCoT = cotStartRegex.test(text) || this.isCoTOrMetaLine(firstNonEmptyLine);

    if (hasInitialCoT) {
      // 5-1. 코드블록 (```markdown ... ```) 형태로 최종 본문이 뒤에 감싸여 있는 경우 우선 추출
      const codeBlockMatch = text.match(/```(?:markdown|md)?\s*\n([\s\S]*?)\n```/);
      if (codeBlockMatch && codeBlockMatch[1]?.trim()) {
        text = codeBlockMatch[1].trim();
      } else {
        // 5-2. 구분자(---, ===, ***)가 있는 경우 그 이후를 본문으로 취함
        const dividerMatch = text.match(/\n+(?:---|===|\*\*\*)\s*\n+([\s\S]*)$/);
        if (dividerMatch && dividerMatch[1]?.trim()) {
          text = dividerMatch[1].trim();
        } else {
          // 5-3. 최종 번역 라벨이 있는 경우
          const labelMatch = text.match(/\n+(?:#{1,6}\s*)?(?:Final (?:Translation|Output|Response|Markdown)|Translated (?:Markdown|Text|Document)|Here is the (?:translation|translated|final)|최종\s*번역|번역\s*결과|최종\s*결과):?\s*\n+([\s\S]*)$/i);
          if (labelMatch && labelMatch[1]?.trim()) {
            text = labelMatch[1].trim();
          } else {
            // 5-4. "Original text:" 블록이 있고 그 뒤에 실제 번역문이 이어지는 경우
            const originalTextSplit = text.split(/\n+Original text:\s*\n+/i);
            if (originalTextSplit.length > 1) {
              const afterOriginal = originalTextSplit.slice(1).join('\n');
              const linesAfter = afterOriginal.split('\n');
              let foundIndex = -1;
              for (let i = 0; i < linesAfter.length; i++) {
                if (!this.isCoTOrMetaLine(linesAfter[i])) {
                  foundIndex = i;
                  break;
                }
              }
              if (foundIndex !== -1) {
                text = linesAfter.slice(foundIndex).join('\n').trim();
              } else {
                text = '';
              }
            } else {
              // 5-5. 라인 단위 완전 탐색: CoT / 메타 라인이 모두 끝난 첫 번째 실제 본문 시작점 탐색
              const lines = text.split('\n');
              let contentStartIndex = -1;
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!this.isCoTOrMetaLine(line)) {
                  contentStartIndex = i;
                  break;
                }
              }
              if (contentStartIndex !== -1) {
                text = lines.slice(contentStartIndex).join('\n').trim();
              } else {
                text = '';
              }
            }
          }
        }
      }
    }

    // 6. "Thinking Process:" 또는 "Thought Process:" 헤더가 시작 부분에 있는 경우
    const thinkingHeaderRegex = /^(?:#{1,6}\s*|\*\*|\[)?(?:Thinking|Thought)\s*Process(?:\s*#*|\*\*|\])?:?\s*\n+/i;
    if (thinkingHeaderRegex.test(text)) {
      const dividerMatch = text.match(/\n+(?:---|===|\*\*\*)\s*\n+([\s\S]*)$/);
      if (dividerMatch && dividerMatch[1]?.trim()) {
        text = dividerMatch[1].trim();
      } else {
        const labelMatch = text.match(/\n+(?:#{1,6}\s*)?(?:Final (?:Translation|Output|Response|Markdown)|Translated (?:Markdown|Text|Document)|Here is the (?:translation|translated|final)|최종\s*번역|번역\s*결과|최종\s*결과):?\s*\n+([\s\S]*)$/i);
        if (labelMatch && labelMatch[1]?.trim()) {
          text = labelMatch[1].trim();
        } else {
          const codeBlockMatch = text.match(/```(?:markdown|md)?\s*\n([\s\S]*?)\n```/);
          if (codeBlockMatch && codeBlockMatch[1]?.trim()) {
            text = codeBlockMatch[1].trim();
          } else {
            const lines = text.split('\n');
            let contentStartIndex = -1;
            for (let i = 1; i < lines.length; i++) {
              if (!this.isCoTOrMetaLine(lines[i])) {
                contentStartIndex = i;
                break;
              }
              if (/^(?:---|===|\*\*\*)$/.test(lines[i].trim())) {
                contentStartIndex = i + 1;
                break;
              }
            }
            if (contentStartIndex !== -1 && contentStartIndex < lines.length) {
              text = lines.slice(contentStartIndex).join('\n').trim();
            }
          }
        }
      }
    }

    // 7. 본문 중간 또는 후반에 LLM이 "Draft the Translation" 또는 "Drafting" 섹션을 생성한 경우
    const draftSectionRegex = /\n+(?:#{1,6}\s*|\*\*|\[)?(?:\d+\.\s*)?Draft(?:ing)?(?:\s+the\s+Translation)?(?:\s*\([^)]*\))?(?:\s*#*|\*\*|\])?:?\s*\n+/i;
    if (draftSectionRegex.test(text)) {
      const postDraftLabelMatch = text.match(/\n+(?:---|===|\*\*\*|#{1,6}\s*(?:Final|최종|Translated)|Here is the (?:translation|translated|final))\b[\s\S]*?\n+([\s\S]*)$/i);
      if (postDraftLabelMatch && postDraftLabelMatch[1]?.trim()) {
        text = postDraftLabelMatch[1].trim();
      } else {
        const splitParts = text.split(draftSectionRegex);
        if (splitParts[0]?.trim()) {
          text = splitParts[0].trim();
        }
      }
    }

    // 8. 본문 사이사이의 독백 단락 및 `원문 -> 번역문` 화살표 초안 매핑 정제
    const rawLines = text.split('\n');
    const processedLines: string[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        processedLines.push('');
        continue;
      }

      // 8-1. CoT 독백 라인 및 서식 독백 판정
      if (this.isCoTOrMetaLine(line)) {
        continue;
      }
      if (/^Wait,\s+(?:there is|I will|no bold)/i.test(trimmed) || /The instruction says\b/i.test(trimmed)) {
        continue;
      }

      // 8-2. 만약 다음 비어있지 않은 라인이 `-> 번역문` 또는 `→ 번역문` 화살표 매핑인 경우:
      // 현재 라인이 영어 원문이고 다음 라인이 그 번역문인 초안 쌍인지 확인하여 번역문만 채택
      let nextNonEmptyIndex = -1;
      for (let j = i + 1; j < rawLines.length; j++) {
        if (rawLines[j].trim().length > 0) {
          nextNonEmptyIndex = j;
          break;
        }
      }

      if (nextNonEmptyIndex !== -1) {
        const nextLine = rawLines[nextNonEmptyIndex].trim();
        const arrowMatch = nextLine.match(/^(?:->|=>|→)\s*(.+)$/);
        if (arrowMatch) {
          const isCurrentEng = !/[가-힣]/.test(line);
          const isNextKor = /[가-힣]/.test(arrowMatch[1]);
          if (isCurrentEng && isNextKor) {
            const isBullet = /^\s*[-*•]\s+/.test(line);
            const indent = line.match(/^(\s*)/)?.[1] || '';
            const translatedContent = arrowMatch[1].trim();
            processedLines.push(isBullet ? `${indent}- ${translatedContent}` : `${indent}${translatedContent}`);
            i = nextNonEmptyIndex; // 다음 라인까지 소비
            continue;
          }
        }
      }

      // 8-3. 만약 단독으로 `-> 번역문` 또는 `→ 번역문` 형태로 남아있는 라인인 경우 화살표 제거 후 채택
      const singleArrowMatch = trimmed.match(/^(?:->|=>|→)\s*(.+)$/);
      if (singleArrowMatch) {
        const isBullet = /^\s*[-*•]\s+/.test(line);
        const indent = line.match(/^(\s*)/)?.[1] || '';
        processedLines.push(isBullet ? `${indent}- ${singleArrowMatch[1].trim()}` : `${indent}${singleArrowMatch[1].trim()}`);
        continue;
      }

      // 8-4. 라인 끝에 붙은 불필요한 메타 주석(예: `(no bold)`, `(no bold, just a link)`) 정리
      let cleanedLine = line.replace(/\s*\((?:no bold|just a link|no italics?|only link|plain text)[^)]*\)\s*$/i, '');

      // 8-5. 인라인 괄호 독백 제거 (예: "(Wait, the name is Penolopie David, ...)")
      cleanedLine = cleanedLine.replace(/\s*\((?:Wait|Note|Notice|Tip|Translation note),[\s\S]*?\)/gi, '');

      processedLines.push(cleanedLine);
    }

    text = processedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

    // 9. 문단 전체가 큰따옴표("...")로 불필요하게 래핑된 경우 언래핑
    text = text.split(/\n{2,}/).map(para => {
      let p = para.trim();
      if (p.startsWith('"') && p.endsWith('"') && p.length > 2) {
        p = p.slice(1, -1).trim();
      }
      return p;
    }).join('\n\n');

    return text;
  }

  /**
   * 번역 및 편집 후 생성된 마크다운을 Obsidian Flavored Markdown (OFM) 규격에 맞추어
   * 무손실 정규화 및 렌더링 자가 치유(Self-Healing)를 수행합니다.
   * - 프론트매터 및 코드 블록, 수식 블록 격리 보존
   * - 잔여 인라인 HTML 태그(<br>, <b>, <strong>, <i>, <em>, <mark>, <code>)를 순수 OFM 마크다운으로 변환
   * - 헤딩(# ~ ######) 전후 빈 줄(개행) 확보 (옵시디언 렌더러 문단 병합 방지)
   * - 콜아웃(> [!TYPE]) 블록 내부 인용 기호(>) 연속성 보정
   * - 마크다운 테이블(GFM Table) 행 간 불필요한 빈 줄 제거
   * - 체크리스트(- [ ], - [x]) 공백 규격화
   * - 동아시아 볼드 조사 공백 자동 정합 연계
   */
  static normalizeObsidianMarkdown(markdown: string): string {
    if (!markdown) return markdown;

    // 1. 프론트매터 격리
    const { frontmatter, body } = this.extractFrontmatter(markdown);
    let target = body;

    // 2. 코드 블록(```...```) 및 블록 수식($$...$$) 임시 격리
    const blockMap = new Map<string, string>();
    let blockCounter = 0;

    target = target.replace(/```[\s\S]*?```/g, (match) => {
      const token = `__EMILY_FMT_CODE_${blockCounter++}__`;
      blockMap.set(token, match);
      return token;
    });

    target = target.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      const token = `__EMILY_FMT_MATH_${blockCounter++}__`;
      blockMap.set(token, match);
      return token;
    });

    // 3. 인라인 HTML 태그를 순수 마크다운/옵시디언 문법으로 변환
    target = target
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
      .replace(/<mark>([\s\S]*?)<\/mark>/gi, '==$1==')
      .replace(/<code>([^<\n]+?)<\/code>/gi, '`$1`');

    // 4. 체크리스트 태스크 공백 정규화 (-[], -[ ], -[x], -[/] 등 -> - [ ] , - [x] )
    target = target.replace(/^(\s*[-*+])\s*\[\s*([xX/\\-]?)\s*\](?!\s)/gm, (match, bullet: string, mark: string) => {
      const state = mark && mark.trim() ? mark : ' ';
      return `${bullet} [${state}] `;
    });

    // 5. 콜아웃(> [!TYPE]) 블록 내 연속 인용 부호(>) 보정
    // 콜아웃 헤더 다음 줄에서 빈 줄이 나오기 전까지 '>'가 누락된 일반 텍스트 라인에 '>' 접두사 복원
    const lines = target.split(/\r?\n/);
    const normalizedLines: string[] = [];
    let insideCallout = false;
    let insideTable = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      // 콜아웃 헤더 감지
      if (/^>\s*\[![a-zA-Z0-9_-]+\][+-]?/.test(trimmed)) {
        insideCallout = true;
        normalizedLines.push(line);
        continue;
      }

      // 테이블 행 감지 (| ... |)
      const isTableRow = /^\|.*\|$/.test(trimmed);
      if (isTableRow) {
        insideTable = true;
        insideCallout = false;
        normalizedLines.push(line);
        continue;
      } else if (insideTable) {
        if (!trimmed) {
          // 테이블 직후 빈 줄이거나 테이블 내부에 잘못 삽입된 빈 줄인 경우:
          // 만약 다음 줄도 테이블 행이면 빈 줄을 스킵(테이블 찢어짐 방지)
          if (i + 1 < lines.length && /^\|.*\|$/.test(lines[i + 1].trim())) {
            continue;
          }
        }
        insideTable = false;
      }

      // 콜아웃 처리 중
      if (insideCallout) {
        if (!trimmed) {
          // 콜아웃 내부의 빈 줄은 빈 인용 부호(>)로 보존
          // 만약 다음 줄이 완전히 새로운 블록(헤딩, 구분선 등)이면 콜아웃 종료
          if (i + 1 < lines.length && /^(?:#{1,6}\s+|---|\*\*\*|```)/.test(lines[i + 1].trim())) {
            insideCallout = false;
            normalizedLines.push('');
            continue;
          }
          normalizedLines.push('>');
          continue;
        } else if (trimmed.startsWith('>')) {
          normalizedLines.push(line);
          continue;
        } else if (/^(?:#{1,6}\s+|---|\*\*\*|```)/.test(trimmed)) {
          // 헤딩이나 코드블록, 구분선이 나오면 콜아웃 종료
          insideCallout = false;
          normalizedLines.push(line);
          continue;
        } else {
          // 콜아웃 내부에서 '>'가 누락된 후속 줄 자동 치유
          normalizedLines.push(`> ${line}`);
          continue;
        }
      }

      normalizedLines.push(line);
    }

    target = normalizedLines.join('\n');

    // 6. 헤딩(# ~ ######) 전후 빈 줄(개행) 확보 (옵시디언 렌더러 파싱 오류 원천 방지)
    // 윗줄이 빈 줄이나 시작점이 아닌 경우 빈 줄 추가
    target = target.replace(/([^\r\n])\r?\n(#{1,6}\s+[^\r\n]+)/g, '$1\n\n$2');
    // 헤딩 아랫줄이 빈 줄이 아니면 빈 줄 추가 (단, 다음 줄이 다른 헤딩(#)인 경우 제외)
    target = target.replace(/(#{1,6}\s+[^\r\n]+)\r?\n([^#\r\n\s>])/g, '$1\n\n$2');

    // 7. 연속 3개 이상의 불필요한 공백 개행을 표준 마크다운 문단 간격(2개)으로 축소
    target = target.replace(/\n{3,}/g, '\n\n').trim();

    // 8. 격리된 코드 블록 및 수식 블록 복원
    blockMap.forEach((blockContent, token) => {
      target = target.split(token).join(blockContent);
    });

    // 9. 동아시아 볼드 닫는 태그 뒤 조사 공백 자동 보정
    target = this.fixEastAsianBoldSpacing(target);

    // 10. 프론트매터 재결합
    if (frontmatter) {
      const formattedFm = frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n';
      return `${formattedFm}${target.trimStart()}`;
    }

    return target;
  }
}
