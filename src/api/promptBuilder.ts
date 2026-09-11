import { ProofreadOptions } from '../types/proofread';
import { TranslationOptions } from '../types/translation';

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
  static buildProofreadingPrompt(markdownContent: string, options: ProofreadOptions, customInstruction?: string): { system: string; user: string } {
    const categories: string[] = [];
    const allowedCatTokens: string[] = [];

    if (options.checkSpelling) {
      categories.push('- 맞춤법, 띄어쓰기, 오탈자 및 잘못된 조사 사용 검사');
      allowedCatTokens.push('"spelling"', '"bold_format"');
    }
    if (options.checkGrammar) {
      categories.push('- 문법 검사, 문맥 기반 문장 구조 및 시제 일치 검사');
      allowedCatTokens.push('"grammar"');
    }
    if (options.checkTone) {
      const toneGuide = options.targetTone === 'honorific'
        ? '하십시오체 (경어체: ~합니다, ~입니다, ~바랍니다)'
        : (options.targetTone === 'plain'
          ? '해라체 (평어·학술체: ~한다, ~이다, ~된다)'
          : (options.targetTone === 'polite'
            ? '해요체 (친근체: ~해요, ~돼요, ~있어요)'
            : '문서의 주된 지배적 문체 (Auto-detect)'));

      categories.push(`- 종결어미 및 문체 일관성 검사: 기준 문체인 [${toneGuide}]와 일치하지 않거나 본문 내에서 무의식적으로 혼용된 종결어미(예: ~합니다와 ~한다, ~해요의 혼용)를 검출하고 일관된 문체로 교정 제안`);
      allowedCatTokens.push('"tone"');
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

[필수 교열 원칙]
1. 한국어 조사 및 마크다운 볼드 서식 규칙:
   - 한국어는 조사 특성상 '**단어** 조사' 처럼 뒤에 공백 없이 조사가 붙으면 마크다운 서식이 깨질 수 있습니다. 또는 불필요하게 볼드 안에 조사가 들어가거나 잘못 띄어쓰기된 경우(예: '**서식 에**' -> '**서식에**')를 적극적으로 감지하여 올바른 옵시디언 마크다운으로 교정하십시오.
2. [프론트매터(YAML Frontmatter) 무결성 및 구조 절대 보존]:
   - 문서 최상단의 YAML 프론트매터(\`---\`로 둘러싸인 메타데이터: title, source, author, published, created, tags 등)는 절대 임의로 수정, 병합, 삭제하지 마십시오.
   - 프론트매터의 키, 값, 줄바꿈, 리스트 들여쓰기 구조를 한 줄로 합치지 마십시오.
   - 교열 제안(items)에 프론트매터 구조를 훼손하는 제안을 절대 포함하지 마십시오.
3. 기존 마크다운 본문 구조(헤딩 #, 코드블록, 링크 [[...]], 태그 #tag 등)를 손상시키지 마십시오.
4. [종결어미 및 문체 일관성 검사 시 주의사항]:
   - 인용구(> 블록 또는 따옴표 "..." 내의 인용 발언), 코드 블록(\`\`\`...\`\`\`) 및 인라인 코드(\`...\`), 수식($...$), YAML 프론트매터 내부의 문장은 화자의 원래 발언이나 코드 형식을 유지해야 하므로 종결어미 교정 대상에서 제외하고 원문 그대로 보존하십시오.
   - 문맥상 제목(# 헤딩)이나 목록형 명사형 종결(~함, ~기, ~것)은 불필요하게 억지로 서술형 종결어미로 바꾸지 마십시오.
5. 반드시 아래 JSON 규격으로만 응답해야 합니다. 마크다운 코드블록(\`\`\`json) 안에 담아주십시오.

[JSON 응답 스키마]
{
  "items": [
    {
      "id": "item_1",
      "original": "수정 대상 원본 문장 또는 단어",
      "replacement": "개선 제안 문장 또는 단어",
      "category": ${categoryEnumStr},
      "explanation": "수정 이유 및 교열 근거 상세 설명"
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
   * 마크다운 번역 작업을 위한 시스템 및 유저 프롬프트를 생성합니다.
   * - 출발어/도착어가 동일한 경우 "동일 언어 편집" 모드로 전환
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

    // 동일 언어 편집 모드: 번역 지침 대신 편집 지침 사용
    if (isSameLangEdit) {
      const system = `당신은 전문 마크다운 편집 AI "Assistant Emily"입니다.
마크다운 문서의 포맷, 링크, 코드 블록, 태그, 테이블 구조를 완벽히 유지하면서 문서를 편집하십시오.

[편집 지침]
- 언어: ${sourceLangText} (출발어와 도착어가 동일하므로 언어 변환 없이 편집만 수행)
- [프론트매터(YAML Frontmatter) 무결성 보존]:
  문서 최상단에 YAML 프론트매터(\`--- ... ---\`)가 존재하는 경우, 프론트매터의 키 이름, 값, 콜론, 따옴표, 줄바꿈 및 리스트 들여쓰기 구조를 100% 원본 그대로 완벽하게 보존하십시오.
- [보호 토큰 무결성]: 본문에 \`__EMILY_...\` 형태의 플레이스홀더 토큰이 포함되어 있다면, 토큰의 철자나 형식을 절대 수정하거나 삭제하지 말고 그대로 보존하십시오.
- 마크다운 문법(볼드, 이탤릭, 링크, 코드블록, 표, 콜아웃 등)이 깨지지 않도록 정확한 위치에 편집 내용을 배치하십시오.
- 결과물은 오직 편집된 마크다운 전문만을 출력하십시오 (불필요한 인사말이나 부가 설명 제외).`;

      let user = `다음 마크다운 문서를 편집 규정에 맞추어 편집하십시오.\n`;
      if (customInstruction && customInstruction.trim()) {
        user += `\n[편집자 특별 요청사항]\n${customInstruction.trim()}\n`;
      }
      user += `\n[마크다운 원문]\n${markdownContent}`;
      return { system, user };
    }

    // 1. 문체 (Tone) 지침
    let toneInstruction = '- 문체(Tone): 학술 및 기술 문서체 (~이다/한다, 간결하고 객관적이며 명확한 어조)';
    if (options.tone === 'polite') {
      toneInstruction = '- 문체(Tone): 정중한 경어체 (~합니다/하십시오, 신뢰감 있고 격식 있는 비즈니스 어조)';
    } else if (options.tone === 'casual') {
      toneInstruction = '- 문체(Tone): 친근한 대화체 (~해요/있어요, 블로그 및 친근한 설명 안내 어조)';
    }

    // 2. 스타일 (Style: 직역/의역) 지침
    let styleInstruction = '- 번역 스타일: 균형 잡힌 번역 (원문의 의미를 정확히 전달하면서 자연스러운 우리말로 정제)';
    if (options.style === 'literal') {
      styleInstruction = '- 번역 스타일: 직역 중심 (원문의 단어와 문맥 구조를 직관적이고 충실하게 반영)';
    } else if (options.style === 'natural') {
      styleInstruction = '- 번역 스타일: 자연스러운 의역 (문맥에 맞추어 유려하고 읽기 쉬운 현대적 표현으로 의역)';
    }

    // 3. 코드 블록 주석 번역 지침
    const codeCommentInstruction = options.translateCodeComments
      ? '- [코드 블록 주석 번역]: 코드 본체(변수명, 키워드, 함수명, 문법 구조)는 절대 수정하지 말고, 코드 내 주석(//, #, /* */) 및 설명 문자열만을 도착어로 번역하십시오.'
      : '- [코드 블록 보존]: 코드 블록 및 인라인 코드는 100% 원본 그대로 유지하십시오.';

    const system = `당신은 전문 마크다운 번역 AI "Assistant Emily"입니다.
마크다운 문서의 포맷, 링크, 코드 블록, 태그, 테이블 구조를 완벽히 유지하면서 고품질로 번역하십시오.

[번역 지침]
- 출발어: ${sourceLangText}
- 도착어: ${options.targetLanguage}
${toneInstruction}
${styleInstruction}
${codeCommentInstruction}
- 번역 범위 정책:
  ${
    options.scope === 'selection'
      ? '1. [선택 영역 번역] 입력으로 주어진 선택 텍스트 영역만을 정확하고 충실하게 도착어로 번역하십시오.'
      : options.scope === 'all'
      ? '2. [전체 완전 번역] 문서 전체의 모든 제목(헤딩)과 본문 문단을 도착어로 누락 없이 100% 완전하게 번역하십시오.'
      : '3. [단락별 원문 병기] 마크다운 문서를 단락(문단, 헤딩, 블록) 단위로 나누어, 각 단락마다 원문 단락을 그대로 먼저 출력하고 그 바로 다음 줄에 도착어로 번역된 단락을 1:1로 쌍을 이루어 병기하십시오.'
  }
- [프론트매터(YAML Frontmatter) 무결성 보존]:
  문서 최상단에 YAML 프론트매터(\`--- ... ---\`)가 존재하는 경우, 프론트매터의 키 이름, 값, 콜론, 따옴표, 줄바꿈 및 리스트 들여쓰기 구조를 100% 원본 그대로 완벽하게 보존하십시오. 프론트매터의 줄바꿈을 절대 한 줄로 합치거나 삭제하지 마십시오.
- [동영상 타임스탬프 처리]: 원문에 0:04, 0:27:, **1:29**:, [00:15] 등의 동영상 타임스탬프가 포함되어 있는 경우, 타임스탬프를 번역문에 그대로 남겨두지 말고 깨끗이 제거한 후 문단 단위로 자연스럽게 연결하여 번역하십시오.
- [필수 마크다운 볼드(**) 공백 규칙 - 한국어, 일본어, 한자어 필수]:
  한국어, 일본어, 한자어(중국어)에서 굵은 글씨(**단어**) 바로 뒤에 조사(은/는/이/가/을/를/의/에/와/과/로/라고/이다 등)나 한국어/일본어/한자 문자가 **직접** 이어질 때에만 닫는 볼드 태그(**) 뒤에 스페이스(공백 1칸)를 추가하십시오.
  (올바른 예: **컨슈머(Consumer)** 는, **퍼블리셔(Publisher)** 라고, **브로커(Broker)** 는, **큐(Queue)** 는)
  단, 볼드 바로 뒤에 콜론(:), 쉼표(,), 마침표(.), 괄호(), 물음표(?), 느낌표(!) 등 구두점이 오는 경우에는 절대로 공백을 추가하지 마십시오.
  (잘못된 예: **효율적인 소스 관리** : → 올바른 표현: **효율적인 소스 관리**: / **다중 노트북** , → **다중 노트북**,)
  공백이 없으면 옵시디언 마크다운 파서에서 볼드가 풀리고 ** 기호가 그대로 노출됩니다.
- [보호 토큰 무결성]: 본문에 \`__EMILY_...\` 형태의 플레이스홀더 토큰(예: \`__EMILY_WIKITARGET_0__\`, \`__EMILY_TAG_1__\`, \`__EMILY_CODEBLOCK_2__\` 등)이 포함되어 있다면, 토큰의 철자나 형식을 절대 수정하거나 번역하거나 삭제하지 말고 그대로 보존하십시오.
- 마크다운 문법(볼드, 이탤릭, 링크, 코드블록, 표, 콜아웃 등)이 깨지지 않도록 정확한 위치에 번역문을 배치하십시오.
- 본문의 모든 설명과 문장을 요약하거나 생략하지 말고 충실하고 상세하게 번역하십시오.
- 결과물은 오직 번역된 마크다운 전문만을 출력하십시오 (불필요한 인사말이나 부가 설명 제외).`;

    let user = `다음 마크다운 문서를 번역 규정에 맞추어 번역하십시오.\n`;

    if (customInstruction && customInstruction.trim()) {
      user += `\n[편집자 특별 요청사항]\n${customInstruction.trim()}\n`;
    }

    user += `\n[마크다운 원문]\n${markdownContent}`;

    return { system, user };
  }

  /**
   * 두 문서(현재 문서 vs 참조 소스 문서) 간 사실/수치/명칭 일관성을 검증하는 프롬프트를 생성합니다.
   * @param currentDocContent 검토할 현재 문서 본문
   * @param sourceDocContent 비교 기준이 되는 참조 소스 문서 본문
   * @param sourceDocName 참조 소스 파일명
   * @returns 시스템 프롬프트(system) 및 사용자 프롬프트(user) 객체
   */
  static buildConsistencyPrompt(
    currentDocContent: string,
    sourceDocContent: string,
    sourceDocName: string
  ): { system: string; user: string } {
    const system = `당신은 지식 볼트(Vault) 내부 일관성 검증 전문가 "Assistant Emily"입니다.
참조 소스 문서의 사실, 수치, 명칭, 논리적 기준과 비교하여 현재 문서에서 상충되거나 불일치하는 부분을 찾아내십시오.

반드시 다음 JSON 규격으로만 응답하십시오:
\`\`\`json
{
  "issues": [
    {
      "originalText": "현재 문서에서 상충되는 문장/수치",
      "sourceText": "참조 소스 문서에 기록된 올바른 내용/수치",
      "sourceFile": "${sourceDocName}",
      "discrepancyType": "contradiction" | "number_mismatch" | "terminology",
      "explanation": "어떤 불일치나 모순이 존재하는지에 대한 명확한 설명",
      "suggestedReplacement": "수정 제안 텍스트"
    }
  ]
}
\`\`\``;

    const user = `[참조 소스 문서: ${sourceDocName}]\n${sourceDocContent}\n\n[현재 검토 대상 문서]\n${currentDocContent}`;

    return { system, user };
  }

  /**
   * 사용자 자유 자연어 지시(Custom Instructions)에 따라 마크다운을 직접 수정/재구성하는 프롬프트를 생성합니다.
   * @param markdownContent 편집할 원본 마크다운 본문
   * @param customInstruction 사용자 입력 편집 요청사항
   * @returns 시스템 프롬프트(system) 및 사용자 프롬프트(user) 객체
   */
  static buildCustomEditPrompt(
    markdownContent: string,
    customInstruction: string
  ): { system: string; user: string } {
    const system = `당신은 Obsidian 마크다운 편집 및 서식 전문 AI "Assistant Emily"입니다.
사용자의 편집 요청사항을 충실히 반영하여 마크다운 문서를 직접 수정 및 재구성하십시오.
문서 최상단에 YAML 프론트매터(--- ... ---)가 존재하는 경우, 프론트매터의 키-값 쌍, 콜론, 들여쓰기, 줄바꿈 구조를 100% 원본 그대로 보존해야 합니다.
기존 마크다운 문서의 포맷, 링크, 코드 블록, 태그, 테이블 구조를 온전히 보존하십시오.
한국어, 일본어, 한자어의 경우 굵은 글씨(**단어**) 뒤에 조사나 문자가 올 때 닫는 볼드 태그 뒤에 공백 1칸을 추가하십시오 (예: **단어** 는).
반드시 편집이 완료된 최종 마크다운 본문만을 출력해야 합니다. 불필요한 인사말, 사족, 설명 문구는 절대 포함하지 마십시오.`;

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
3. 오직 편집자에게 건넬 최종 인사말 1~2문장만을 순수 텍스트로 즉시 출력하십시오.`;

      const user = `현재 시간대는 ${periodKorean}입니다. 편집자에게 건넬 Assistant Emily의 한국어 인사말을 1~2문장으로 작성해 주세요.`;

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
3. Output ONLY the final greeting sentence as plain text.`;

      const user = `The current time period is ${periodEnglish}. Please write Assistant Emily's warm 1-2 sentence greeting.`;

      return { system, user };
    }
  }

  /**
   * LLM 응답에서 <think> 태그, 영문 추론 독백(Chain-of-thought), 코드블록, 외곽 따옴표 등을 안전하게 정제합니다.
   * @param rawContent LLM 원시 응답 문자열
   * @returns 정제된 순수 인사말 문자열
   */
  static cleanGreetingMessage(rawContent: string): string {
    if (!rawContent) return '';
    let text = rawContent.trim();

    // 1. <think>...</think> 태그 제거 (DeepSeek-R1 등 추론 모델 대응)
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 2. ```thought ... ``` 또는 ```reasoning ... ``` 코드블록 제거
    text = text.replace(/```(?:thought|reasoning)?[\s\S]*?```/gi, '').trim();

    // 3. 영문 추론 독백(Chain-of-thought) 감지 및 실제 인사말 추출
    const hasMonologue = /we need to|the instruction|should be 1-2|let's produce|probably one sentence/i.test(text);
    if (hasMonologue) {
      // 본문 내 따옴표로 감싸인 완성된 문장 탐색
      const quotes = Array.from(text.matchAll(/"([^"]{10,})"/g)).map(m => m[1].trim());
      // 한글이 포함된 따옴표 우선 선택
      const koreanQuote = quotes.reverse().find(q => /[가-힣]/.test(q) && !/we need to|instruction/i.test(q));
      if (koreanQuote) {
        text = koreanQuote;
      } else if (quotes.length > 0) {
        const candidate = quotes.find(q => !/we need to|instruction/i.test(q));
        if (candidate) text = candidate;
      } else {
        // 따옴표가 없는 경우 마지막 한국어 문장 구간 추출
        const koreanMatch = text.match(/([가-힣\s!?,.~]{10,})/g);
        if (koreanMatch && koreanMatch.length > 0) {
          text = koreanMatch[koreanMatch.length - 1].trim();
        }
      }
    }

    // 4. 전체 문자열이 외곽 따옴표로 감싸진 경우 제거
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1).trim();
    }

    // 5. 공백 정리
    text = text.replace(/\s+/g, ' ').trim();

    // 6. 완전히 비어버린 경우 안전한 기본 인사말로 폴백
    if (!text) {
      text = '안녕하세요! Obsidian 마크다운 교열 및 번역을 돕는 Assistant Emily입니다.';
    }

    return text;
  }
}

