import { ProofreadOptions } from '../types/proofread';
import { TranslationOptions, MarkdownFormatStripOptions } from '../types/translation';
import { MarkdownFormatter } from '../core/markdownFormatter';

/**
 * LLM 호출 시 각 작업(교열, 번역, 직접 편집, 일관성 검증)에 최적화된 시스템/유저 프롬프트를 구성하는 빌더 클래스
 */
export class PromptBuilder {
  /**
   * 마크다운 교열 작업을 위한 시스템 및 유저 프롬프트를 생성합니다.
   * @param markdownContent 교열할 원본 마크다운 텍스트
   * @param options 맞춤법, 문법, 타임스탬프 삭제 등 옵션 객체
   * @param customInstruction 사용자 임의 지시 텍스트 (선택)
   * @returns 시스템 프롬프트(system) 및 사용자 프롬프트(user) 객체
   */
  static buildProofreadingPrompt(
    markdownContent: string,
    options: ProofreadOptions,
    customInstruction?: string,
    language: string = 'ko'
  ): { system: string; user: string } {
    const isKorean = language === 'ko';

    if (!isKorean) {
      const categories: string[] = [];
      const allowedCatTokens: string[] = [];

      if (options.checkSpelling) {
        categories.push('- Spelling, typos, and spacing errors');
        allowedCatTokens.push('"spelling"');
      }
      if (options.checkGrammar) {
        categories.push('- Grammar, syntax, contextual sentence structure, and tense agreement');
        allowedCatTokens.push('"grammar"');
      }
      if (options.removeTimestamps) {
        categories.push('- Timestamp removal and paragraph concatenation: remove video/script timestamps (e.g., 0:04, 0:27:, **1:29**:, [00:15]) and excessive line breaks, merging text into readable paragraphs without altering original words or meaning.');
        allowedCatTokens.push('"timestamp"');
      }
      if (options.improveExpression) {
        categories.push('- Expression and clarity improvements (sentence length, formal tone)');
        allowedCatTokens.push('"expression"');
      }
      if (options.searchCitation) {
        categories.push('- Citation format inspection (APA/MLA/Chicago)');
        allowedCatTokens.push('"citation"');
      }
      if (options.checkConsistency) {
        categories.push('- Internal vault consistency verification');
        allowedCatTokens.push('"consistency"');
      }

      const categoryEnumStr = allowedCatTokens.length > 0
        ? Array.from(new Set(allowedCatTokens)).join(' | ')
        : '"custom"';

      const system = `You are "Assistant Emily", an intelligent Markdown editorial and proofreading AI assistant for Obsidian.
Analyze the provided Markdown document and generate proofreading suggestions strictly formatted as JSON.

[Strict Guardrails]
1. Do NOT suggest unrequested changes outside the categories specified by the editor (e.g., do not rewrite expressions, change vocabulary, reformat casing, summarize, or omit text unless specifically requested).
2. Generate proofreading suggestions (items) strictly adhering to the active inspection rules listed under [Active Inspection Items] below.
3. [Timestamp Removal]: Do not alter any words, casing, vocabulary, or sentences; only remove timestamps and merge fragmented line breaks into readable paragraphs.
4. If there are no issues matching the active inspection rules, return an empty array: "items": []. Do NOT invent or hallucinate suggestions.
5. All "explanation" fields MUST be written strictly in English (the configured user interface language). Never output explanations in any other language.
6. [Strict Guardrail: No Thinking Process]: Do NOT output any "Thinking Process:", "Thought Process:", <think>...</think>, or chain-of-thought monologue outside the JSON. Start directly with the \`\`\`json block.

[Essential Proofreading Principles]
1. Preserve all existing Markdown formatting syntax, headings, code blocks, wikilinks, tags, and table structures unless explicitly targeted.
2. [YAML Frontmatter Preservation]:
   - Never modify, merge, or delete YAML frontmatter (\`--- ... ---\`) at the top of the document.
   - Do not include suggestions that alter frontmatter structure or metadata.
3. You must respond ONLY with valid JSON in a \`\`\`json code block conforming to the schema below.

[JSON Response Schema]
{
  "items": [
    {
      "id": "item_1",
      "original": "Exact original text from the document to be corrected",
      "replacement": "Proposed replacement text",
      "category": ${categoryEnumStr},
      "explanation": "Clear explanation of the error and correction rationale in English"
    }
  ]
}`;

      let user = `Proofread the following document according to the active inspection items:\n\n[Active Inspection Items]\n${categories.length > 0 ? categories.join('\n') : '- Editor-specified inspection'}\n`;

      if (customInstruction && customInstruction.trim()) {
        user += `\n[Editor Special Instructions]\n${customInstruction.trim()}\n`;
      }

      user += `\n[Markdown Document]\n${markdownContent}`;

      return { system, user };
    }

    // Korean locale branch (기본 한국어)
    const categories: string[] = [];
    const allowedCatTokens: string[] = [];

    if (options.checkSpelling) {
      categories.push('- 맞춤법, 띄어쓰기, 오탈자 검사');
      allowedCatTokens.push('"spelling"');
    }
    if (options.checkGrammar) {
      categories.push('- 문법 검사, 문맥 기반 문장 구조 및 시제 일치 검사');
      allowedCatTokens.push('"grammar"');
    }
    if (options.removeTimestamps) {
      categories.push('- 타임스탬프 삭제 및 스크립트 문단 연결(Concatenation): 유튜브 및 동영상 캡처 스크립트에 포함된 타임스탬프(예: 0:04, 0:27:, **1:29**:, [00:15] 등)와 잦은 줄바꿈을 모두 제거하고, 원문의 단어나 표현을 임의로 요약·삭제·의역·대소문자변경 하지 말고 원문 100% 그대로 단락별로 이어 붙여(Concatenation) 편집자가 읽기 쉽게 정위하십시오.');
      allowedCatTokens.push('"timestamp"');
    }
    if (options.improveExpression) {
      categories.push('- 표현 개선 (문장 길이 조정, 어휘 대체 제안, 학술적/자연스러운 문체 유지)');
      allowedCatTokens.push('"expression"');
    }
    if (options.searchCitation) {
      categories.push('- 인용 근거 서식 (APA/MLA/Chicago) 점검 및 보완');
      allowedCatTokens.push('"citation"');
    }
    if (options.checkConsistency) {
      categories.push('- 지식 볼트 내 상충 검증 및 일관성 검사');
      allowedCatTokens.push('"consistency"');
    }

    const categoryEnumStr = allowedCatTokens.length > 0
      ? Array.from(new Set(allowedCatTokens)).join(' | ')
      : '"custom"';

    const system = `당신은 Obsidian 전용 지능형 마크다운 편집 및 교열 전문 AI인 "Assistant Emily"입니다.
주어진 마크다운 문서를 면밀히 분석하여 교열 제안 목록을 JSON 포맷으로 생성하십시오.

[엄격한 교열 가드레일 (Strict Guardrails)]
1. 편집자가 선택하지 않은 검사 항목이나 요청하지 않은 범주의 임의 수정(예: 단순 표현 변경, 영문 대소문자 임의 변경, 어휘 대체, 문장 요약, 임의 생략 등)은 절대로 제안하지 마십시오.
2. 오직 아래 [적용 검사항목]에 명시된 규칙에만 엄격하게 집중하여 교열 제안(items)을 생성하십시오.
3. [타임스탬프 삭제 작업 시]: 원문의 단어, 대소문자, 어휘, 문장을 1글자도 임의로 수정하거나 바꾸지 말고 오직 타임스탬프 제거 및 잦은 줄바꿈 연결만 수행하십시오.
4. 만약 활성화된 검사 항목에 부합하는 교정 대상이 없다면, 억지로 제안을 만들지 말고 "items": [] (빈 배열)을 반환하십시오.
5. 모든 수정 이유(explanation)는 반드시 한국어(기본 설정 언어)로 명확하고 상세하게 작성하십시오.
6. [추론 과정 및 생각 로그(Thinking Process) 출력 절대 금지]: "Thinking Process:", "Thought Process:", <think>...</think>, Chain-of-thought 등 일체의 사고 과정을 출력하지 마십시오. 오직 순수 JSON 데이터만을 즉시 출력하십시오.

[필수 교열 원칙]
1. 기존 마크다운 본문 구조(헤딩 #, 코드블록, 링크 [[...]], 태그 #tag, 테이블 등)를 손상시키지 마십시오.
2. [프론트매터(YAML Frontmatter) 무결성 및 구조 절대 보존]:
   - 문서 최상단의 YAML 프론트매터(\`---\`로 둘러싸인 메타데이터: title, source, author, published, created, tags 등)는 절대 임의로 수정, 병합, 삭제하지 마십시오.
   - 프론트매터의 키, 값, 줄바꿈, 리스트 들여쓰기 구조를 한 줄로 합치지 마십시오.
   - 교열 제안(items)에 프론트매터 구조를 훼손하는 제안을 절대 포함하지 마십시오.
3. 반드시 아래 JSON 규격으로만 응답해야 합니다. 마크다운 코드블록(\`\`\`json) 안에 담아주십시오.

[JSON 응답 스키마]
{
  "items": [
    {
      "id": "item_1",
      "original": "수정 대상 원본 문장 또는 단어",
      "replacement": "개선 제안 문장 또는 단어",
      "category": ${categoryEnumStr},
      "explanation": "수정 이유 및 교열 근거 상세 설명 (한국어로 작성)"
    }
  ]
}`;

    let user = `다음 문서를 교열하십시오:\n\n[적용 검사항목]\n${categories.length > 0 ? categories.join('\n') : '- 편집자 지정 검사'}\n`;

    if (customInstruction && customInstruction.trim()) {
      user += `\n[편집자 특별 요청사항]\n${customInstruction.trim()}\n`;
    }

    user += `\n[마크다운 원문]\n${markdownContent}`;

    return { system, user };
  }

  /**
   * 마크다운 번역 및 편집 작업을 위한 시스템 및 유저 프롬프트를 생성합니다.
   * - 출발어/도착어가 동일한 경우 "동일 언어 편집 및 문체 교정" 모드로 전환
   * - 문체(학술/경어/친근), 스타일(직역/균형/의역), 코드 주석 번역 지침 반영
   * @param markdownContent 마스킹 완료된 번역 대상 마크다운 본문
   * @param options 번역 세부 옵션
   * @param customInstruction 사용자 임의 지시 텍스트 (선택)
   * @returns 시스템 프롬프트(system) 및 사용자 프롬프트(user) 객체
   */
  static buildTranslationPrompt(
    markdownContent: string,
    options: TranslationOptions,
    customInstruction?: string
  ): { system: string; user: string } {
    const isSameLangEdit = options.isSameLangEdit ?? false;
    const sourceLangText = (!options.sourceLanguage || options.sourceLanguage === '언어 감지' || options.sourceLanguage === 'auto')
      ? '원문 문서 언어 자동 감지'
      : options.sourceLanguage;

    // 1. 문체 (Tone) 지침
    let toneInstruction = '- 문체(Tone): 학술 및 기술 문서체 (~이다/한다, 간결하고 객관적이며 명확한 어조)';
    if (options.tone === 'polite') {
      toneInstruction = '- 문체(Tone): 정중한 경어체 (~합니다/하십시오, 신뢰감 있고 격식 있는 비즈니스 어조)';
    } else if (options.tone === 'casual') {
      toneInstruction = '- 문체(Tone): 친근한 대화체 (~해요/있어요, 블로그 및 친근한 설명 안내 어조)';
    }

    // 2. 스타일 (Style: 직역/의역) 지침
    let styleInstruction = '- 스타일: 균형 잡힌 정제 (원문의 의미를 정확히 유지하면서 자연스럽게 다듬기)';
    if (options.style === 'literal') {
      styleInstruction = '- 스타일: 직관적 원문 충실 (원문의 어휘와 문장 구조를 가급적 보존하며 다듬기)';
    } else if (options.style === 'natural') {
      styleInstruction = '- 스타일: 유려한 자연스러움 (문맥에 맞추어 유려하고 읽기 쉬운 표현으로 다듬기)';
    }

    // 동일 언어 편집 모드: 번역 지침 대신 편집 및 문체 정합 지침 사용
    if (isSameLangEdit) {
      const system = `당신은 전문 마크다운 편집 AI "Assistant Emily"입니다.
마크다운 문서의 포맷, 링크, 코드 블록, 태그, 테이블 구조를 완벽히 유지하면서 문서를 편집하십시오.

[편집 지침]
- 언어: ${sourceLangText} (출발어와 도착어가 동일하므로 언어 변환 없이 편집 및 문체 교정만 수행)
${toneInstruction}
${styleInstruction}
- [종결어미 및 문체 일관성]:
  지정된 문체(Tone)를 엄격히 준수하여 문서 전체의 어미와 어조를 일관되게 정합화하십시오.
  단, 인용구(> 블록, "..." 인용), 코드 블록(\`\`\`...\`\`\`) 및 인라인 코드(\`...\`), 수식($...$), YAML 프론트매터 내부의 문장은 화자의 원래 발언이나 코드 형식을 유지해야 하므로 종결어미 교정 대상에서 제외하고 원문 그대로 보존하십시오.
- [프론트매터(YAML Frontmatter) 무결성 보존]:
  문서 최상단에 YAML 프론트매터(\`--- ... ---\`)가 존재하는 경우, 프론트매터의 키 이름, 값, 콜론, 따옴표, 줄바꿈 및 리스트 들여쓰기 구조를 100% 원본 그대로 완벽하게 보존하십시오.
- [보호 토큰 무결성]: 본문에 \`__EMILY_...\` 형태의 플레이스홀더 토큰이 포함되어 있다면, 토큰의 철자나 형식을 절대 수정하거나 삭제하지 말고 그대로 보존하십시오.
- 마크다운 문법(볼드, 이탤릭, 링크, 코드블록, 표, 콜아웃 등)이 깨지지 않도록 정확한 위치에 편집 내용을 배치하십시오.${PromptBuilder.buildFormatStripInstruction(options.formatStripOptions)}
- [추론 과정, 초안 작성 및 생각 로그(Thinking/Drafting Process) 출력 절대 금지]:
  절대로 "Thinking Process:", "Thought Process:", "Draft the Translation", "Segment by Segment", "Let's write", "Let's use", <think>...</think>, <thought>...</thought>, 내부 추론 과정, 편집 계획 메모를 출력하지 마십시오.
  Do NOT output "Thinking Process:", "Thought Process:", "Draft the Translation", "Segment by Segment", "Let's write", "Let's use", <think> tags, internal monologue, planning notes, draft notes, or reasoning steps.
  사고 과정(Chain-of-thought)이나 분석 독백 없이, 문서의 첫 단어부터 완성된 최종 마크다운 본문만을 곧바로 출력하십시오.
- 결과물은 오직 편집된 마크다운 전문만을 출력하십시오 (불필요한 인사말, 메타 코멘트, 부가 설명 제외).`;

      let user = `다음 마크다운 문서를 편집 규정에 맞추어 편집하십시오.\n`;
      if (customInstruction && customInstruction.trim()) {
        user += `\n[편집자 특별 요청사항]\n${customInstruction.trim()}\n`;
      }
      user += `\n[마크다운 원문]\n${markdownContent}\n\n[출력 절대 원칙 - 위반 엄금]:\n1. 각 문장별/세그먼트별 분석, 초안 작성("Draft"), 독백("Let's..."), 메모를 일절 출력하지 마십시오.\n2. "Thinking Process:", "Thought Process:", "Draft", "Let's write" 등의 단어나 메타 설명을 절대로 포함하지 마십시오.\n3. 원문의 첫 번째 줄부터 시작하는 100% 완성된 최종 마크다운 본문만을 곧바로 출력하십시오.`;
      return { system, user };
    }

    // 3. 코드 블록 주석 번역 지침
    const codeCommentInstruction = options.translateCodeComments
      ? '- [코드 블록 주석 번역]: 코드 본체(변수명, 키워드, 함수명, 문법 구조)는 절대 수정하지 말고, 코드 내 주석(//, #, /* */) 및 설명 문자열만을 도착어로 번역하십시오.'
      : '- [코드 블록 보존]: 코드 블록 및 인라인 코드는 100% 원본 그대로 유지하십시오.';

    const system = `당신은 전문 마크다운 번역 AI "Assistant Emily"입니다.
주어진 마크다운 문서의 구조(헤딩, 목록, 코드블록, 링크, 표, 콜아웃, YAML 프론트매터, __EMILY_... 보호 토큰)를 100% 보존하면서 고품질로 번역하십시오.

[번역 지침]
- 출발어: ${sourceLangText}
- 도착어: ${options.targetLanguage}
${toneInstruction}
${styleInstruction}
${codeCommentInstruction}
- 번역 범위 정책:
  ${
    options.scope === 'selection'
      ? '선택된 영역만을 충실하게 번역하십시오.'
      : options.scope === 'all'
      ? '문서 전체의 모든 제목과 본문을 누락 없이 100% 완전하게 번역하십시오.'
      : '각 단락마다 원문 단락을 먼저 출력하고 그 다음 줄에 번역 단락을 1:1로 병기하십시오.'
  }
- YAML 프론트매터(\`--- ... ---\`)와 __EMILY_... 보호 토큰의 형태를 100% 완벽히 보존하십시오.
- 타임스탬프(0:04, 1:29 등)는 제거하고 자연스러운 문단으로 연결하십시오.
- 마크다운 서식을 손상시키지 마십시오.${PromptBuilder.buildFormatStripInstruction(options.formatStripOptions)}
- 원문의 내용을 생략하거나 요약하지 말고 상세하게 빠짐없이 번역하십시오.

[출력 절대 원칙 - 즉각적인 번역 본문만 출력]:
- 어떠한 인사말, 설명, 생각 과정(Thinking/Reasoning), 가이드라인 검토("Let's review..."), 원문 복사("Original text:..."), 초안 메모("Let's write...", "A -> B")도 절대로 출력하지 마십시오.
- Do NOT output any preamble, thinking process, draft notes, or guideline reviews.
- 문서의 첫 단어/첫 줄부터 100% 완성된 ${options.targetLanguage} 마크다운 본문만을 곧바로 출력하십시오.`;

    let user = `다음 마크다운 문서를 도착어(${options.targetLanguage})로 즉시 번역하십시오.\n`;

    if (customInstruction && customInstruction.trim()) {
      user += `\n[편집자 특별 요청사항]\n${customInstruction.trim()}\n`;
    }

    user += `\n[마크다운 원문]\n${markdownContent}\n\n[출력 절대 원칙 - 위반 엄금]:\n1. "The user wants...", "Let's review...", "Original text:", "Let's write...", "A -> B" 등 생각 과정이나 가이드라인 복습, 초안 메모를 일절 출력하지 마십시오.\n2. Do NOT output thoughts, drafts, or preamble. Start directly with the first line of the translated markdown.\n3. 원문의 첫 번째 줄부터 시작하는 완성된 ${options.targetLanguage} 마크다운 본문만을 곧바로 출력하십시오.`;

    return { system, user };
  }

  /**
   * 사용자 선택 서식 제거(볼드, 기울이기, 취소선, 하이라이트) 지침 문자열을 생성합니다.
   */
  private static buildFormatStripInstruction(stripOpts?: MarkdownFormatStripOptions): string {
    if (!stripOpts) return '';
    const stripGuidelines: string[] = [];
    if (stripOpts.stripBold) stripGuidelines.push('볼드체(**, __) 서식 제외');
    if (stripOpts.stripItalic) stripGuidelines.push('기울이기(*, _) 서식 제외');
    if (stripOpts.stripStrikethrough) stripGuidelines.push('취소선(~~) 서식 제외');
    if (stripOpts.stripHighlight) stripGuidelines.push('하이라이트(==) 서식 제외');
    return stripGuidelines.length > 0
      ? `\n- [서식 제한]: 인라인 강조 서식(볼드/기울임 등)을 추가하지 말고 일반 텍스트로 번역하십시오.`
      : '';
  }

  /**
   * 사용자 지정 편집/질의 프롬프트(Custom Edit Mode)를 생성합니다.
   * @param markdownContent 편집할 원본 마크다운 텍스트
   * @param customInstruction 사용자 임의 지시 텍스트
   * @param stripOptions 서식 제거 옵션 (선택)
   * @returns 시스템 프롬프트(system) 및 사용자 프롬프트(user) 객체
   */
  static buildCustomEditPrompt(
    markdownContent: string,
    customInstruction: string,
    stripOptions?: MarkdownFormatStripOptions
  ): { system: string; user: string } {
    const stripInstruction = PromptBuilder.buildFormatStripInstruction(stripOptions);
    const system = `당신은 Obsidian 마크다운 편집 및 서식 전문 AI "Assistant Emily"입니다.
사용자의 편집 요청사항을 충실히 반영하여 마크다운 문서를 직접 수정 및 재구성하십시오.
문서 최상단에 YAML 프론트매터(--- ... ---)가 존재하는 경우, 프론트매터의 키-값 쌍, 콜론, 들여쓰기, 줄바꿈 구조를 100% 원본 그대로 보존해야 합니다.
기존 마크다운 문서의 포맷, 링크, 코드 블록, 태그, 테이블 구조를 온전히 보존하십시오.
한국어, 일본어, 한자어의 경우 굵은 글씨(**단어**) 뒤에 조사나 문자가 올 때 닫는 볼드 태그 뒤에 공백 1칸을 추가하십시오 (예: **단어** 는).${stripInstruction}
[엄격한 출력 가드레일 (Strict Output Guardrails)]
- 절대로 "Thinking Process:", "Thought Process:", <think>...</think>, Chain-of-thought, 내부 추론 과정, 편집 계획 메모를 출력하지 마십시오.
- 첫 글자부터 편집이 완료된 최종 마크다운 본문만을 즉시 출력하십시오. 불필요한 인사말, 사족, 메타 설명 문구는 일절 포함하지 마십시오.`;

    const user = `[편집자 작업 요청사항]\n${customInstruction.trim()}\n\n[마크다운 원문]\n${markdownContent}`;

    return { system, user };
  }

  /**
   * 설정 화면의 연결 테스트(Say Hello)를 위한 최적화된 시스템 및 사용자 프롬프트를 생성합니다.
   * - 오픈소스 모델이나 추론 모델이 영문 추론(Chain-of-thought)으로 빠지지 않도록 로케일에 맞춰 직결 프롬프트 구성
   * - 엄격한 단일 인사말 출력 가드레일 강제
   * @param locale 사용자 언어 (예: 'Korean', 'English', 'ko', 'en' 등)
   * @param timePeriod 시간대 ('morning' | 'afternoon' | 'evening' | 'night')
   * @returns 시스템 프롬프트(system) 및 사용자 프롬프트(user) 객체
   */
  static buildGreetingPrompt(
    locale: string,
    timePeriod: string
  ): { system: string; user: string } {
    const isKorean = locale.toLowerCase().includes('ko') || locale.includes('한국어') || locale.toLowerCase().includes('korean');

    if (isKorean) {
      let periodKorean = '오늘';
      if (timePeriod === 'morning') periodKorean = '상쾌한 아침';
      else if (timePeriod === 'afternoon') periodKorean = '활기찬 오후';
      else if (timePeriod === 'evening') periodKorean = '편안한 저녁';
      else if (timePeriod === 'night') periodKorean = '차분한 밤';

      const system = `당신은 Obsidian 지식 노트를 위한 지능형 마크다운 교열 및 전문 번역 어시스턴트 "Assistant Emily"입니다.
사용자가 Obsidian 설정 화면에서 LLM 연결 테스트를 요청했습니다.
현재 시간대(${periodKorean})에 맞추어 편집자에게 건넬 친절하고 자연스러운 1~2문장의 한국어 인사말을 작성하십시오.

[엄격한 출력 가드레일 (Strict Guardrails)]
1. 반드시 당신의 이름인 'Assistant Emily'와 현재 시간대(${periodKorean})를 자연스럽게 언급하십시오.
2. 절대로 내부 생각(Chain-of-thought), 추론 과정, 분석, 영문 해설, 따옴표("...")는 출력하지 마십시오.
3. 절대로 여러 개의 문장 후보(Options/Variants)를 나열하거나 'Or:' 등으로 비교하지 마십시오.
4. 오직 편집자에게 건넬 단 1개의 완성된 최종 인사말(1~2문장)만을 순수 텍스트로 즉시 출력하십시오.`;

      const user = `현재 시간대는 ${periodKorean}입니다. 편집자에게 건넬 Assistant Emily의 완성된 한국어 인사말 1개를 작성해 주세요. (후보 나열 금지, 단 1개의 인사말만 즉시 출력)`;

      return { system, user };
    } else {
      let periodEnglish = 'day';
      if (timePeriod === 'morning') periodEnglish = 'morning';
      else if (timePeriod === 'afternoon') periodEnglish = 'afternoon';
      else if (timePeriod === 'evening') periodEnglish = 'evening';
      else if (timePeriod === 'night') periodEnglish = 'night';

      const system = `You are "Assistant Emily", an intelligent Markdown editorial and translation assistant for Obsidian.
The user is testing the LLM connection from Obsidian settings.
Write a warm, friendly, natural 1-2 sentence greeting suitable for the current time of day (${periodEnglish}).

[Strict Output Guardrails]
1. Introduce yourself as Assistant Emily and warmly mention the ${periodEnglish}.
2. Do NOT output any internal thinking, chain-of-thought, reasoning, planning, meta-commentary, or quotes.
3. Do NOT output multiple variants, alternatives, or options (e.g. no "Or:").
4. Output ONLY a single final greeting sentence as plain text.`;

      const user = `The current time period is ${periodEnglish}. Please write Assistant Emily's warm 1-2 sentence greeting. (Do not output multiple variants, output only 1 final sentence).`;

      return { system, user };
    }
  }

  /**
   * LLM 응답에서 <think> 태그, 영문 추론 독백(Chain-of-thought), 코드블록, 외곽 따옴표 등을 안전하게 정제합니다.
   * - 모델이 여러 개의 후보 문장("후보 1" "후보 2" Or: "후보 3")을 나열한 경우 첫 번째 완성된 단일 문장만을 추출합니다.
   * @param rawContent LLM 원시 응답 문자열
   * @returns 정제된 순수 인사말 문자열 (따옴표 없는 단일 문장)
   */
  static cleanGreetingMessage(rawContent: string): string {
    if (!rawContent) return '';
    let text = MarkdownFormatter.stripThinkingProcess(rawContent);

    // 1. 유니코드 깨진 문자(\uFFFD) 및 불완전한 Or: 대안 찌꺼기 제거
    text = text.replace(/\uFFFD/g, '').trim();
    text = text.replace(/\s*\bOr:\s*.*$/i, '').trim();

    // 2. 모델이 복수의 따옴표 문장 후보("후보 1" "후보 2")를 나열한 경우, 첫 번째 유효 문장 추출
    const quoteMatches = Array.from(text.matchAll(/["'“”‘’]([^"'“”‘’]{10,})["'“”‘’]/g)).map(m => m[1].trim());
    if (quoteMatches.length > 0) {
      // 한국어가 포함되어 있고 메타 지침이 아닌 첫 번째 후보 선택
      const validQuote = quoteMatches.find(q => /[가-힣]/.test(q) && !/^(?:we need to|the instruction|let's|here is|as an ai)/i.test(q))
        || quoteMatches.find(q => !/^(?:we need to|the instruction|let's|here is|as an ai)/i.test(q));
      if (validQuote) {
        text = validQuote;
      }
    } else {
      // 3. 영문 추론 독백(Chain-of-thought) 감지 시 한국어 문장 구간 추출
      const hasMonologue = /we need to|the instruction|should be 1-2|let's produce|probably one sentence|in this case/i.test(text);
      if (hasMonologue) {
        const koreanMatch = text.match(/([가-힣\s!?,.~]{10,})/g);
        if (koreanMatch && koreanMatch.length > 0) {
          text = koreanMatch[0].trim();
        }
      }
    }

    // 4. 외곽에 중첩된 모든 종류의 따옴표(", ', “, ”, ‘, ’) 완전 제거
    text = text.replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '').trim();

    // 5. 공백 정리
    text = text.replace(/\s+/g, ' ').trim();

    // 6. 완전히 비어버린 경우 안전한 기본 인사말로 폴백
    if (!text) {
      text = '안녕하세요! Obsidian 마크다운 교열 및 번역을 돕는 Assistant Emily입니다.';
    }

    return text;
  }
}

