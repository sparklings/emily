import { App, Editor, Modal, Notice, setIcon } from 'obsidian';
import { ProofreadDiffItem } from '../types/proofread';
import { getTranslation } from '../i18n';
import { MarkdownFormatter } from '../core/markdownFormatter';

/**
 * 마크다운 교열 제안 대조 검토 모달 클래스
 * - AI가 제안한 맞춤법/문법 교정 항목을 목록으로 렌더링
 * - 항목별 개별 승인/거부 체크박스 및 에디터 위치 점프 기능
 * - 일괄 적용 시 마크다운 본문에 승인된 항목만 무손실 치환
 */
export class ProofreadDiffModal extends Modal {
  private items: ProofreadDiffItem[];
  private editor: Editor;
  private onApplyCallback?: (appliedItems: ProofreadDiffItem[]) => void;
  private onCancelCallback?: () => void;
  private displayLang?: string;
  private hasApplied: boolean = false;
  private backdropClickHandler?: (e: MouseEvent) => void;
  private backdropMouseDownHandler?: (e: MouseEvent) => void;

  constructor(
    app: App,
    editor: Editor,
    items: ProofreadDiffItem[],
    onApply?: (appliedItems: ProofreadDiffItem[]) => void,
    onCancel?: () => void,
    displayLang?: string
  ) {
    super(app);
    this.editor = editor;
    this.items = items;
    this.onApplyCallback = onApply;
    this.onCancelCallback = onCancel;
    this.displayLang = displayLang;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    const t = getTranslation(this.displayLang);

    // Prevent accidental dismissals from clicks outside the modal
    this.backdropClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !this.modalEl.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.shakeModal();
        new Notice(t.diffModal.outsideDismissNotice, 2500);
      }
    };

    this.backdropMouseDownHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !this.modalEl.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    this.containerEl.addEventListener('click', this.backdropClickHandler, { capture: true });
    this.containerEl.addEventListener('mousedown', this.backdropMouseDownHandler, { capture: true });

    contentEl.createEl('h2', { text: t.diffModal.title });

    if (this.items.length === 0) {
      contentEl.createEl('p', { text: t.diffModal.noIssues, cls: 'emily-option-desc' });
      const closeBtn = contentEl.createEl('button', { text: t.common.dismiss, cls: 'emily-btn-primary' });
      closeBtn.addEventListener('click', () => {
        this.hasApplied = true;
        this.onCancelCallback = undefined;
        if (this.onApplyCallback) {
          this.onApplyCallback([]);
          this.onApplyCallback = undefined;
        }
        this.close();
      });
      return;
    }

    const summaryEl = contentEl.createDiv({ cls: 'emily-diff-summary' });
    summaryEl.createSpan({ text: t.diffModal.summary.replace('{count}', this.items.length.toString()) });

    const listEl = contentEl.createDiv({ cls: 'emily-diff-items-list' });

    this.items.forEach((item, index) => {
      const card = listEl.createDiv({ cls: 'emily-diff-card' });

      const header = card.createDiv({ cls: 'emily-diff-header' });
      const leftHead = header.createDiv({ cls: 'flex items-center gap-2' });
      
      const checkbox = leftHead.createEl('input', { type: 'checkbox' });
      checkbox.checked = item.approved ?? true;
      checkbox.addEventListener('change', (e) => {
        item.approved = (e.target as HTMLInputElement).checked;
      });

      const catName = item.category === 'spelling' ? t.sidebar.spelling : (item.category === 'grammar' ? t.sidebar.grammar : (item.category === 'timestamp' ? t.sidebar.timestamp : (item.category === 'bold_format' ? t.sidebar.boldFormatCategory : item.category)));
      leftHead.createSpan({ text: `#${index + 1} [${catName}]`, cls: 'emily-badge' });

      const content = card.createDiv({ cls: 'emily-diff-content' });
      if (item.original) {
        content.createSpan({ text: item.original, cls: 'emily-diff-original' });
        content.createSpan({ text: ' ➔ ' });
      }
      content.createSpan({ text: item.replacement, cls: 'emily-diff-replacement' });

      if (item.explanation) {
        card.createDiv({ text: item.explanation, cls: 'emily-diff-explanation' });
      }
    });

    const footer = contentEl.createDiv({ cls: 'emily-diff-footer' });

    const applySelectedBtn = footer.createEl('button', { text: t.diffModal.applySelected, cls: 'emily-btn-secondary' });
    applySelectedBtn.addEventListener('click', () => {
      this.applyChanges(false);
    });

    const applyAllBtn = footer.createEl('button', { text: t.diffModal.applyAll, cls: 'emily-btn-primary' });
    applyAllBtn.addEventListener('click', () => {
      this.applyChanges(true);
    });

    const cancelBtn = footer.createEl('button', {
      text: t.common.cancel,
      cls: 'emily-btn-secondary'
    });
    cancelBtn.addEventListener('click', () => {
      this.cancelModal();
    });
  }

  private shakeModal() {
    this.modalEl.classList.remove('emily-modal-shake');
    void this.modalEl.offsetWidth;
    this.modalEl.classList.add('emily-modal-shake');
    setTimeout(() => {
      this.modalEl.classList.remove('emily-modal-shake');
    }, 400);
  }

  private cancelModal() {
    this.hasApplied = false;
    for (const item of this.items) {
      item.approved = false;
    }
    this.close();
  }

  private applyChanges(all: boolean) {
    let doc = this.editor.getValue();
    const appliedItems: ProofreadDiffItem[] = [];

    for (const item of this.items) {
      if (all || item.approved) {
        if (item.id === 'timestamp_clean_auto') {
          doc = MarkdownFormatter.cleanScriptTimestamps(doc);
          appliedItems.push(item);
        } else if (item.id === 'korean_bold_auto') {
          doc = MarkdownFormatter.fixKoreanBoldFormatting(doc);
          appliedItems.push(item);
        } else if (item.original && doc.includes(item.original)) {
          doc = MarkdownFormatter.replaceTextInDoc(doc, item.original, item.replacement);
          appliedItems.push(item);
        }
      }
    }

    this.editor.setValue(doc);
    this.hasApplied = true;
    this.onCancelCallback = undefined;
    const t = getTranslation(this.displayLang);
    new Notice(t.diffModal.appliedNotice.replace('{count}', appliedItems.length.toString()));
    if (this.onApplyCallback) {
      this.onApplyCallback(appliedItems);
      this.onApplyCallback = undefined;
    }
    this.close();
  }

  onClose() {
    if (this.backdropClickHandler) {
      this.containerEl.removeEventListener('click', this.backdropClickHandler, { capture: true });
      this.backdropClickHandler = undefined;
    }
    if (this.backdropMouseDownHandler) {
      this.containerEl.removeEventListener('mousedown', this.backdropMouseDownHandler, { capture: true });
      this.backdropMouseDownHandler = undefined;
    }
    const { contentEl } = this;
    contentEl.empty();
    if (!this.hasApplied && this.onCancelCallback) {
      const cb = this.onCancelCallback;
      this.onCancelCallback = undefined;
      cb();
    }
  }
}
