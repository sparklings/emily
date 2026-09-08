import { MarkdownFormatter } from './markdownFormatter';

export interface MaskResult {
  maskedText: string;
  maskMap: Map<string, string>;
  frontmatter: string;
}

/**
 * 마크다운 문법 무손실 보존을 위한 전처리/후처리 마스킹 엔진
 * - 옵시디언 고유 문법(위키링크, 태그, 콜아웃, 각주) 및 수식($...$), 코드 블록을
 *   충돌 없는 고유 토큰(__EMILY_TYPE_ID__)으로 임시 치환하여 LLM 번역 중 변형을 원천 방지
 */
export class MarkdownMasker {
  /**
   * 마크다운 본문 내 보호 대상 요소를 고유 토큰으로 마스킹합니다.
   * @param markdown 원본 마크다운 텍스트
   * @param options 코드 주석 번역 여부 등 옵션 (translateCodeComments가 true이면 코드 블록은 마스킹하지 않고 통과)
   * @returns 마스킹된 텍스트, 치환 맵(maskMap), 분리된 YAML 프론트매터
   */
  static mask(markdown: string, options: { translateCodeComments?: boolean } = {}): MaskResult {
    const maskMap = new Map<string, string>();
    let counter = 0;

    const getPlaceholder = (prefix: string): string => {
      return `__EMILY_${prefix}_${counter++}__`;
    };

    // 1. 프론트매터(YAML) 분리
    const { frontmatter, body } = MarkdownFormatter.extractFrontmatter(markdown);
    let target = body;

    // 2. 코드 블록 (Code blocks: ```...```)
    if (!options.translateCodeComments) {
      target = target.replace(/```[\s\S]*?```/g, (match) => {
        const token = getPlaceholder('CODEBLOCK');
        maskMap.set(token, match);
        return token;
      });
    }

    // 3. 인라인 코드 (`...`)
    target = target.replace(/`([^`\n]+?)`/g, (match) => {
      const token = getPlaceholder('INLINECODE');
      maskMap.set(token, match);
      return token;
    });

    // 4. 블록 수식 ($$...$$) 및 인라인 수식 ($...$)
    target = target.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      const token = getPlaceholder('MATHBLOCK');
      maskMap.set(token, match);
      return token;
    });
    target = target.replace(/(?<!\\)\$(?!\$)([^$\n]+?)(?<!\\)\$/g, (match: string) => {
      const token = getPlaceholder('MATHINLINE');
      maskMap.set(token, match);
      return token;
    });

    // 5. 옵시디언 콜아웃 헤더 (> [!type] 또는 > [!type]+, > [!type]-)
    target = target.replace(/^(>\s*\[!)([a-zA-Z0-9_-]+)(\][+-]?)/gm, (match: string, prefix: string, calloutType: string, suffix: string) => {
      const token = getPlaceholder('CALLOUT');
      maskMap.set(token, calloutType);
      return `${prefix}${token}${suffix}`;
    });

    // 6. 옵시디언 내부 위키링크 ([[Note Name|Alias]] 또는 [[Note Name]])
    target = target.replace(/\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g, (match: string, linkTarget: string, alias: string | undefined) => {
      const targetToken = getPlaceholder('WIKITARGET');
      maskMap.set(targetToken, linkTarget);
      if (alias !== undefined) {
        return `[[${targetToken}|${alias}]]`;
      }
      return `[[${targetToken}]]`;
    });

    // 7. 옵시디언 해시태그 (#tag 또는 #parent/child)
    target = target.replace(/(?<=^|\s)#([a-zA-Z가-힣0-9_-]+(?:\/[a-zA-Z가-힣0-9_-]+)*)(?=\s|$|[.,!?])/gm, (match: string, tagName: string) => {
      const token = getPlaceholder('TAG');
      maskMap.set(token, `#${tagName}`);
      return token;
    });

    // 8. 옵시디언 각주 참조 ([^1], [^note])
    target = target.replace(/\[\^([a-zA-Z0-9_-]+)\]/g, (match) => {
      const token = getPlaceholder('FOOTNOTE');
      maskMap.set(token, match);
      return token;
    });

    // 9. 마크다운 이미지 임베드 (![Alt](path) 및 ![[Image.png]])
    target = target.replace(/!\[\[[^\]\n]+?\]\]/g, (match) => {
      const token = getPlaceholder('EMBED');
      maskMap.set(token, match);
      return token;
    });

    return {
      maskedText: target,
      maskMap,
      frontmatter
    };
  }

  /**
   * 번역 완료된 텍스트에서 마스킹 토큰을 원본 마크다운 문법 요소로 100% 무손실 복원합니다.
   * @param translatedText LLM이 생성한 번역 텍스트
   * @param maskMap 마스킹 토큰 ➔ 원본 문자열 매핑 Map
   * @param frontmatter 보존된 원본 프론트매터 (존재할 경우 최상단 결합)
   * @returns 완전 복원된 최종 마크다운 문서
   */
  static restore(translatedText: string, maskMap: Map<string, string>, frontmatter: string = ''): string {
    if (!translatedText) return frontmatter;

    let restored = translatedText;

    // 마스킹 토큰 역치환
    maskMap.forEach((originalValue, token) => {
      restored = restored.split(token).join(originalValue);
    });

    // 복원 후 혹시 남았을 수 있는 토큰 패턴 정리
    restored = restored.replace(/__EMILY_[A-Z]+_\d+__/g, (match) => {
      return maskMap.get(match) || match;
    });

    // 프론트매터가 있었다면 원본 100% 무손실 결합
    if (frontmatter) {
      const formattedFm = frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n';
      return `${formattedFm}${restored.trimStart()}`;
    }

    return restored;
  }
}