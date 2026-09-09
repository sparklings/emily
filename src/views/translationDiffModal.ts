import { App, Modal, Notice, TFile } from 'obsidian';
import { TranslationOptions, TranslationResult } from '../types/translation';
import { TranslationEngine } from '../core/translationEngine';
import { isSameLanguage } from '../core/languageDetector';
import { getTranslation, getLocalizedLanguageName } from '../i18n';
import { TranslationKeys } from '../i18n/types';

interface MarkdownBlock {
  type: 'frontmatter' | 'heading' | 'code' | 'list_item' | 'text' | 'empty';
  text: string;
}

interface AlignedRow {
  id: number;
  orig: MarkdownBlock;
  trans: MarkdownBlock;
}

/**
 * 번역 결과 대조 검토 모달 클래스
 * - 원문과 번역문을 좌우(Side-by-Side) 1:1 대조하여 시각적으로 검토
 * - 단락별 블록 동기화 및 전체 텍스트 모드 지원
 * - 새 파일 저장, 원문 하단 덧붙이기, 덮어쓰기 보존 전략 실행
 */
export class TranslationDiffModal extends Modal {
  private originalMarkdown: string;
  private translatedMarkdown: string;
  private currentEditedText: string;
  private activeFile: TFile;
  private options: TranslationOptions;
  private translationEngine: TranslationEngine;
  private onSaveCallback?: (finalText: string, action: string) => void;
  private displayLang?: string;
  private backdropClickHandler?: (e: MouseEvent) => void;
  private backdropMouseDownHandler?: (e: MouseEvent) => void;

  private viewMode: 'aligned' | 'full' = 'aligned';
  private alignedRows: AlignedRow[] = [];
  private bodyContainerEl: HTMLElement | null = null;
  private fullRightTextarea: HTMLTextAreaElement | null = null;

  constructor(
    app: App,
    activeFile: TFile,
    originalMarkdown: string,
    translatedMarkdown: string,
    options: TranslationOptions,
    translationEngine: TranslationEngine,
    onSave?: (finalText: string, action: string) => void,
    displayLang?: string
  ) {
    super(app);
    this.activeFile = activeFile;
    this.originalMarkdown = originalMarkdown;
    this.translatedMarkdown = translatedMarkdown;
    this.currentEditedText = translatedMarkdown;
    this.options = options;
    this.translationEngine = translationEngine;
    this.onSaveCallback = onSave;
    this.displayLang = displayLang;

    this.alignedRows = this.computeAlignedRows();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.modalEl.addClass('emily-translation-diff-modal-window');
    const t = getTranslation(this.displayLang);

    // 동일 언어 편집 여부 판별
    const isSameLangEdit = this.options.isSameLangEdit
      ?? isSameLanguage(this.options.sourceLanguage, this.options.targetLanguage);

    // Prevent accidental dismissals from clicks outside the modal
    this.backdropClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !this.modalEl.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.shakeModal();
        const msg = isSameLangEdit
          ? t.transDiffModal.outsideDismissNoticeEdit
          : t.transDiffModal.outsideDismissNoticeTrans;
        new Notice(msg, 2500);
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

    // 1. Fixed Header (Pinned at top)
    const headerEl = contentEl.createDiv({ cls: 'emily-translation-modal-header' });
    const titleRow = headerEl.createDiv({ cls: 'emily-translation-modal-title-row' });
    
    const titleLeft = titleRow.createDiv({ cls: 'emily-translation-modal-title-left' });
    titleLeft.createEl('h2', {
      text: isSameLangEdit
        ? t.transDiffModal.reviewEditTitle
        : t.transDiffModal.reviewTransTitle
    });

    // View Mode Toggle Switch (Aligned Rows vs Full Document View)
    const toggleGroup = titleRow.createDiv({ cls: 'emily-translation-view-toggle-group' });
    const alignedBtn = toggleGroup.createEl('button', {
      text: t.transDiffModal.viewModeAligned,
      cls: `emily-translation-view-toggle-btn ${this.viewMode === 'aligned' ? 'is-active' : ''}`
    });
    const fullBtn = toggleGroup.createEl('button', {
      text: t.transDiffModal.viewModeFull,
      cls: `emily-translation-view-toggle-btn ${this.viewMode === 'full' ? 'is-active' : ''}`
    });

    alignedBtn.addEventListener('click', () => {
      if (this.viewMode === 'aligned') return;
      if (this.fullRightTextarea) {
        this.currentEditedText = this.fullRightTextarea.value;
      }
      this.viewMode = 'aligned';
      this.alignedRows = this.computeAlignedRows();
      alignedBtn.addClass('is-active');
      fullBtn.removeClass('is-active');
      this.renderBody(t, isSameLangEdit);
    });

    fullBtn.addEventListener('click', () => {
      if (this.viewMode === 'full') return;
      this.currentEditedText = this.reconstructMarkdownFromRows();
      this.viewMode = 'full';
      fullBtn.addClass('is-active');
      alignedBtn.removeClass('is-active');
      this.renderBody(t, isSameLangEdit);
    });

    const badgeRow = headerEl.createDiv({ cls: 'emily-translation-modal-badges' });
    const srcDisplay = getLocalizedLanguageName(this.options.sourceLanguage, t) || t.languages.auto;
    const tgtDisplay = getLocalizedLanguageName(this.options.targetLanguage, t);
    badgeRow.createSpan({
      text: isSameLangEdit
        ? `${srcDisplay} (${t.sidebar.sameLangEditSuffix})`
        : `${srcDisplay} ➔ ${tgtDisplay}`,
      cls: 'emily-badge is-active'
    });
    if (!isSameLangEdit) {
      if (this.options.tone) {
        const toneLabel = this.options.tone === 'academic' ? t.tones.academic : this.options.tone === 'polite' ? t.tones.polite : t.tones.casual;
        badgeRow.createSpan({ text: `${t.transDiffModal.toneLabel}: ${toneLabel}`, cls: 'emily-badge' });
      }
      if (this.options.style) {
        const styleLabel = this.options.style === 'literal' ? t.styles.literal : this.options.style === 'natural' ? t.styles.natural : t.styles.balanced;
        badgeRow.createSpan({ text: `${t.transDiffModal.styleLabel}: ${styleLabel}`, cls: 'emily-badge' });
      }
    }

    // 2. Central Diff Body (Isolated scroll area)
    this.bodyContainerEl = contentEl.createDiv({ cls: 'emily-translation-diff-body' });
    this.renderBody(t, isSameLangEdit);

    // 3. Fixed Footer (Pinned at bottom, always visible)
    const footerEl = contentEl.createDiv({ cls: 'emily-translation-modal-footer' });
    
    footerEl.createDiv({ cls: 'emily-translation-footer-left' });

    const rightActions = footerEl.createDiv({ cls: 'emily-translation-footer-right' });

    const newFileBtn = rightActions.createEl('button', {
      text: t.transDiffModal.saveNewFileBtn,
      cls: 'emily-btn-primary emily-translation-save-new-btn'
    });
    newFileBtn.addEventListener('click', () => {
      void (async () => {
        const currentText = this.getCurrentText();
        const opts = { ...this.options, preservation: 'new_file' as const };
        const res: Partial<TranslationResult> = {};
        await this.translationEngine.applyPreservationStrategy(this.activeFile, this.originalMarkdown, currentText, opts, res);
        new Notice(t.transDiffModal.saveNewFileNotice.replace('{path}', res.targetPath || ''));
        if (this.onSaveCallback) this.onSaveCallback(currentText, 'new_file');
        this.close();
      })();
    });

    const subRow = rightActions.createDiv({ cls: 'emily-translation-footer-subrow' });

    const appendBtn = subRow.createEl('button', {
      text: t.transDiffModal.appendBtn,
      cls: 'emily-btn-secondary emily-translation-append-btn'
    });
    appendBtn.addEventListener('click', () => {
      void (async () => {
        const currentText = this.getCurrentText();
        const opts = { ...this.options, preservation: 'append' as const };
        const res: Partial<TranslationResult> = {};
        await this.translationEngine.applyPreservationStrategy(this.activeFile, this.originalMarkdown, currentText, opts, res);
        new Notice(t.transDiffModal.appendNotice);
        if (this.onSaveCallback) this.onSaveCallback(currentText, 'append');
        this.close();
      })();
    });

    const overwriteBtn = subRow.createEl('button', {
      text: t.transDiffModal.overwriteBtn,
      cls: 'emily-btn-danger emily-translation-overwrite-btn'
    });
    overwriteBtn.addEventListener('click', () => {
      void (async () => {
        const currentText = this.getCurrentText();
        const opts = { ...this.options, preservation: 'overwrite' as const };
        const res: Partial<TranslationResult> = {};
        await this.translationEngine.applyPreservationStrategy(this.activeFile, this.originalMarkdown, currentText, opts, res);
        new Notice(t.transDiffModal.overwriteNotice);
        if (this.onSaveCallback) this.onSaveCallback(currentText, 'overwrite');
        this.close();
      })();
    });

    const closeBtn = subRow.createEl('button', {
      text: t.transDiffModal.closeBtn,
      cls: 'emily-btn-secondary emily-translation-close-btn'
    });
    closeBtn.addEventListener('click', () => {
      this.close();
    });
  }

  private renderBody(t: TranslationKeys, isSameLangEdit: boolean) {
    if (!this.bodyContainerEl) return;
    this.bodyContainerEl.empty();

    if (this.viewMode === 'aligned') {
      this.renderAlignedView(this.bodyContainerEl, t, isSameLangEdit);
    } else {
      this.renderFullView(this.bodyContainerEl, t, isSameLangEdit);
    }
  }

  private renderAlignedView(parent: HTMLElement, t: TranslationKeys, isSameLangEdit: boolean) {
    // Column Header Bar
    const headerBar = parent.createDiv({ cls: 'emily-diff-rows-header-bar' });
    
    const leftHead = headerBar.createDiv({ cls: 'emily-diff-rows-header-item' });
    leftHead.createSpan({ text: isSameLangEdit ? t.transDiffModal.originalEditHeader : t.transDiffModal.originalTransHeader });

    const rightHead = headerBar.createDiv({ cls: 'emily-diff-rows-header-item' });
    rightHead.createSpan({ text: isSameLangEdit ? t.transDiffModal.resultEditHeader : t.transDiffModal.resultTransHeader });

    // Scrollable Rows Container
    const scrollArea = parent.createDiv({ cls: 'emily-diff-rows-scroll-area' });

    this.alignedRows.forEach((row) => {
      const card = scrollArea.createDiv({
        cls: `emily-diff-row-card ${row.orig.type === 'heading' || row.trans.type === 'heading' ? 'is-heading' : ''}`
      });

      // Left Cell: Original Markdown
      if (row.orig.type === 'empty' || !row.orig.text.trim()) {
        const leftCell = card.createDiv({ cls: 'emily-diff-cell left is-empty' });
        leftCell.createSpan({ text: t.transDiffModal.emptyBlockPlaceholder });
      } else {
        const leftCell = card.createDiv({ cls: 'emily-diff-cell left' });
        leftCell.setText(row.orig.text);
      }

      // Right Cell: Translated / Edited Markdown (Editable)
      const rightCell = card.createDiv({
        cls: `emily-diff-cell right ${row.trans.type === 'empty' && !row.trans.text.trim() ? 'is-empty' : ''}`
      });
      const textarea = rightCell.createEl('textarea', { cls: 'emily-diff-cell-editor' });
      textarea.value = row.trans.text;
      if (row.trans.type === 'empty' && !row.trans.text.trim()) {
        textarea.placeholder = t.transDiffModal.emptyBlockPlaceholder;
      }

      textarea.addEventListener('input', () => {
        row.trans.text = textarea.value;
        this.autoResizeTextarea(textarea);
      });

      // Adjust height after element attachment
      window.setTimeout(() => this.autoResizeTextarea(textarea), 0);
    });
  }

  private renderFullView(parent: HTMLElement, t: TranslationKeys, isSameLangEdit: boolean) {
    const gridContainer = parent.createDiv({ cls: 'emily-translation-side-by-side' });

    // Left Column: Original Markdown
    const leftCol = gridContainer.createDiv({ cls: 'emily-translation-col left' });
    const leftHeader = leftCol.createDiv({ cls: 'emily-translation-col-header' });
    leftHeader.createSpan({ text: isSameLangEdit ? t.transDiffModal.originalEditHeader : t.transDiffModal.originalTransHeader });
    const leftPre = leftCol.createEl('pre', { cls: 'emily-translation-view-pre' });
    leftPre.createEl('code', { text: this.originalMarkdown });

    // Right Column: Translated / Edited Markdown (Editable)
    const rightCol = gridContainer.createDiv({ cls: 'emily-translation-col right' });
    const rightHeader = rightCol.createDiv({ cls: 'emily-translation-col-header' });
    rightHeader.createSpan({ text: isSameLangEdit ? t.transDiffModal.resultEditHeader : t.transDiffModal.resultTransHeader });

    const rightTextarea = rightCol.createEl('textarea', { cls: 'emily-translation-edit-textarea' });
    rightTextarea.value = this.currentEditedText;
    this.fullRightTextarea = rightTextarea;

    rightTextarea.addEventListener('input', () => {
      this.currentEditedText = rightTextarea.value;
    });

    // Synchronize scrolling between left and right
    let isSyncingLeft = false;
    let isSyncingRight = false;

    leftPre.addEventListener('scroll', () => {
      if (!isSyncingLeft) {
        isSyncingRight = true;
        const percentage = leftPre.scrollTop / (leftPre.scrollHeight - leftPre.clientHeight || 1);
        rightTextarea.scrollTop = percentage * (rightTextarea.scrollHeight - rightTextarea.clientHeight);
      }
      isSyncingLeft = false;
    });

    rightTextarea.addEventListener('scroll', () => {
      if (!isSyncingRight) {
        isSyncingLeft = true;
        const percentage = rightTextarea.scrollTop / (rightTextarea.scrollHeight - rightTextarea.clientHeight || 1);
        leftPre.scrollTop = percentage * (leftPre.scrollHeight - leftPre.clientHeight);
      }
      isSyncingRight = false;
    });
  }

  private autoResizeTextarea(textarea: HTMLTextAreaElement) {
    textarea.setCssStyles({ height: 'auto' });
    textarea.setCssStyles({ height: `${Math.max(34, textarea.scrollHeight)}px` });
  }

  private computeAlignedRows(): AlignedRow[] {
    const origBlocks = this.splitMarkdownIntoBlocks(this.originalMarkdown);
    const transBlocks = this.splitMarkdownIntoBlocks(this.currentEditedText);
    return this.alignBlocks(origBlocks, transBlocks);
  }

  private splitMarkdownIntoBlocks(md: string): MarkdownBlock[] {
    if (!md) return [];
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const blocks: MarkdownBlock[] = [];
    let currentBlock: string[] = [];
    let inCodeBlock = false;
    let inFrontmatter = false;
    let currentType: MarkdownBlock['type'] = 'text';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Frontmatter check at start
      if (i === 0 && line.trim() === '---') {
        inFrontmatter = true;
        currentBlock.push(line);
        continue;
      }
      if (inFrontmatter) {
        currentBlock.push(line);
        if (line.trim() === '---') {
          inFrontmatter = false;
          blocks.push({ type: 'frontmatter', text: currentBlock.join('\n') });
          currentBlock = [];
          currentType = 'text';
        }
        continue;
      }

      // Code block check
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          currentBlock.push(line);
          blocks.push({ type: 'code', text: currentBlock.join('\n') });
          currentBlock = [];
          inCodeBlock = false;
          currentType = 'text';
          continue;
        } else {
          if (currentBlock.length > 0) {
            blocks.push({ type: currentType, text: currentBlock.join('\n') });
            currentBlock = [];
          }
          inCodeBlock = true;
          currentBlock.push(line);
          continue;
        }
      }
      if (inCodeBlock) {
        currentBlock.push(line);
        continue;
      }

      // Empty line separates blocks
      if (!line.trim()) {
        if (currentBlock.length > 0) {
          blocks.push({ type: currentType, text: currentBlock.join('\n') });
          currentBlock = [];
          currentType = 'text';
        }
        continue;
      }

      // Horizontal rules
      if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
        if (currentBlock.length > 0) {
          blocks.push({ type: currentType, text: currentBlock.join('\n') });
          currentBlock = [];
        }
        blocks.push({ type: 'text', text: line });
        currentType = 'text';
        continue;
      }

      // Headings are their own block
      if (/^#{1,6}\s+/.test(line)) {
        if (currentBlock.length > 0) {
          blocks.push({ type: currentType, text: currentBlock.join('\n') });
          currentBlock = [];
        }
        blocks.push({ type: 'heading', text: line });
        currentType = 'text';
        continue;
      }

      // List items
      if (/^(\s*[-*+]|\s*\d+\.)\s+/.test(line)) {
        if (currentBlock.length > 0) {
          blocks.push({ type: currentType, text: currentBlock.join('\n') });
          currentBlock = [];
        }
        currentBlock.push(line);
        currentType = 'list_item';
        continue;
      }

      // Continuation of list item if indented
      if (currentType === 'list_item' && /^\s{2,}|\t/.test(line)) {
        currentBlock.push(line);
        continue;
      }

      // If we were in a list item and line is NOT indented, flush list item
      if (currentType === 'list_item') {
        blocks.push({ type: 'list_item', text: currentBlock.join('\n') });
        currentBlock = [];
        currentType = 'text';
      }

      // Otherwise append to current paragraph block
      currentBlock.push(line);
      currentType = 'text';
    }

    if (currentBlock.length > 0) {
      blocks.push({ type: currentType, text: currentBlock.join('\n') });
    }

    return blocks;
  }

  private alignBlocks(origBlocks: MarkdownBlock[], transBlocks: MarkdownBlock[]): AlignedRow[] {
    const n = origBlocks.length;
    const m = transBlocks.length;

    if (n === 0 && m === 0) return [];
    if (n === m) {
      let matchCount = 0;
      for (let k = 0; k < n; k++) {
        if (origBlocks[k].type === transBlocks[k].type) matchCount++;
      }
      if (matchCount / n >= 0.8) {
        return origBlocks.map((ob, idx) => ({
          id: idx + 1,
          orig: ob,
          trans: transBlocks[idx]
        }));
      }
    }

    // Token extractor for matching shared proper nouns, code identifiers, URLs, etc.
    function extractTokens(text: string): Set<string> {
      const tokens = new Set<string>();
      const matches = text.toLowerCase().match(/[a-z0-9_\-\.\:\/]{3,}/g) || [];
      for (const token of matches) tokens.add(token);
      return tokens;
    }

    const origTokens = origBlocks.map(b => extractTokens(b.text));
    const transTokens = transBlocks.map(b => extractTokens(b.text));

    function getHeadingLevel(b: MarkdownBlock): number {
      if (b.type !== 'heading') return 0;
      const match = b.text.match(/^#+/);
      return match ? match[0].length : 0;
    }
    const origHeadingLevels = origBlocks.map(getHeadingLevel);
    const transHeadingLevels = transBlocks.map(getHeadingLevel);

    function matchScore(i: number, j: number): number {
      const ob = origBlocks[i - 1];
      const tb = transBlocks[j - 1];

      // 1. Frontmatter always pairs strictly at document top
      if (ob.type === 'frontmatter' || tb.type === 'frontmatter') {
        return (ob.type === 'frontmatter' && tb.type === 'frontmatter') ? 100 : -100;
      }

      // 2. Code blocks pair with code blocks
      if (ob.type === 'code' || tb.type === 'code') {
        if (ob.type !== tb.type) return -20;
        return 30;
      }

      // 3. Headings require identical heading levels (## with ##, ### with ###)
      if (ob.type === 'heading' || tb.type === 'heading') {
        if (ob.type !== tb.type) return -30;
        const oLevel = origHeadingLevels[i - 1];
        const tLevel = transHeadingLevels[j - 1];
        if (oLevel !== tLevel) return -25;

        let common = 0;
        for (const t of origTokens[i - 1]) {
          if (transTokens[j - 1].has(t)) common++;
        }
        return 25 + common * 6;
      }

      // 4. List items
      if (ob.type === 'list_item' || tb.type === 'list_item') {
        if (ob.type !== tb.type) return -10;
        let common = 0;
        for (const t of origTokens[i - 1]) {
          if (transTokens[j - 1].has(t)) common++;
        }
        return 15 + common * 4;
      }

      // 5. Regular text paragraphs
      if (ob.type === 'text' && tb.type === 'text') {
        let common = 0;
        for (const t of origTokens[i - 1]) {
          if (transTokens[j - 1].has(t)) common++;
        }
        return 12 + common * 4;
      }

      return -15;
    }

    const GAP_PENALTY = 5;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = 1; i <= n; i++) dp[i][0] = -i * GAP_PENALTY;
    for (let j = 1; j <= m; j++) dp[0][j] = -j * GAP_PENALTY;

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const score = matchScore(i, j);
        dp[i][j] = Math.max(
          dp[i - 1][j - 1] + score,
          dp[i - 1][j] - GAP_PENALTY,
          dp[i][j - 1] - GAP_PENALTY
        );
      }
    }

    let i = n;
    let j = m;
    const result: AlignedRow[] = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + matchScore(i, j))) < 1e-6) {
        result.unshift({
          id: 0,
          orig: origBlocks[i - 1],
          trans: transBlocks[j - 1]
        });
        i--;
        j--;
      } else if (i > 0 && (j === 0 || Math.abs(dp[i][j] - (dp[i - 1][j] - GAP_PENALTY)) < 1e-6)) {
        result.unshift({
          id: 0,
          orig: origBlocks[i - 1],
          trans: { type: 'empty', text: '' }
        });
        i--;
      } else {
        result.unshift({
          id: 0,
          orig: { type: 'empty', text: '' },
          trans: transBlocks[j - 1]
        });
        j--;
      }
    }

    result.forEach((r, idx) => { r.id = idx + 1; });
    return result;
  }

  private reconstructMarkdownFromRows(): string {
    const parts: string[] = [];
    let prevType = '';

    for (const row of this.alignedRows) {
      const text = row.trans ? row.trans.text.trim() : '';
      if (!text) continue;

      if (parts.length === 0) {
        parts.push(text);
        prevType = row.trans.type;
        continue;
      }

      if (prevType === 'list_item' && row.trans.type === 'list_item') {
        parts.push('\n' + text);
      } else {
        parts.push('\n\n' + text);
      }

      prevType = row.trans.type;
    }

    return parts.join('');
  }

  private getCurrentText(): string {
    if (this.viewMode === 'aligned') {
      return this.reconstructMarkdownFromRows();
    }
    if (this.fullRightTextarea) {
      return this.fullRightTextarea.value;
    }
    return this.currentEditedText;
  }

  private shakeModal() {
    this.modalEl.removeClass('emily-modal-shake');
    // Force DOM reflow to restart css animation
    void this.modalEl.offsetWidth;
    this.modalEl.addClass('emily-modal-shake');
  }

  onClose() {
    if (this.backdropClickHandler) {
      this.containerEl.removeEventListener('click', this.backdropClickHandler, { capture: true });
    }
    if (this.backdropMouseDownHandler) {
      this.containerEl.removeEventListener('mousedown', this.backdropMouseDownHandler, { capture: true });
    }
    const { contentEl } = this;
    contentEl.empty();
  }
}