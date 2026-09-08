import { setIcon } from 'obsidian';
import { getTranslation } from '../i18n';

/**
 * 긴 마크다운 문서 또는 사이드바 폼에서 맨 위/맨 아래로 부드럽게 이동하는 플로팅 FAB 버튼 컴포넌트
 */
export class FloatingScrollNavigator {
  private containerEl: HTMLElement | null = null;
  private targetScrollEl: HTMLElement | null = null;

  /**
   * 플로팅 스크롤 버튼을 생성하고 부모 DOM 요소에 마운트합니다.
   * @param parent 마운트할 부모 HTML 요소
   * @param getScrollTarget 스크롤 대상 컨테이너 요소를 반환하는 함수
   * @param displayLang UI 표시 언어
   */
  init(parent: HTMLElement, getScrollTarget: () => HTMLElement | null, displayLang?: string) {
    this.remove();
    const t = getTranslation(displayLang);

    this.containerEl = parent.createDiv({ cls: 'emily-floating-scroll-controls' });

    // Scroll to Top Button
    const topBtn = this.containerEl.createEl('button', {
      cls: 'emily-fab-btn',
      attr: { title: t.common.scrollToTop, 'aria-label': t.common.scrollToTop }
    });
    setIcon(topBtn, 'arrow-up');
    topBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = getScrollTarget();
      if (target) {
        target.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    // Scroll to Bottom Button
    const bottomBtn = this.containerEl.createEl('button', {
      cls: 'emily-fab-btn',
      attr: { title: t.common.scrollToBottom, 'aria-label': t.common.scrollToBottom }
    });
    setIcon(bottomBtn, 'arrow-down');
    bottomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = getScrollTarget();
      if (target) {
        target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
      }
    });
  }

  remove() {
    if (this.containerEl) {
      this.containerEl.remove();
      this.containerEl = null;
    }
  }

  setVisible(visible: boolean) {
    if (this.containerEl) {
      this.containerEl.style.display = visible ? 'flex' : 'none';
    }
  }
}
