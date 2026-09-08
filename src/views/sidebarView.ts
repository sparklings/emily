import { ItemView, WorkspaceLeaf, setIcon, Notice, MarkdownView, TFile } from 'obsidian';
import type EmilyPlugin from '../main';
import { EMILY_VIEW_TYPE } from '../constants';
import { getTranslation, getDefaultTargetLanguageName, getSourceLanguages, getSupportedLanguages, getLocalizedLanguageName, normalizeLanguageCode } from '../i18n';
import { ProofreadOptions, ProofreadDiffItem } from '../types/proofread';
import { TranslationOptions, TranslationTone, TranslationStyle } from '../types/translation';
import { ProofreadDiffModal } from './proofreadDiffModal';
import { TranslationDiffModal } from './translationDiffModal';
import { detectDocumentLanguage, isSameLanguage } from '../core/languageDetector';
import { PromptBuilder } from '../api/promptBuilder';
import { MarkdownFormatter } from '../core/markdownFormatter';
import { LLMUsage } from '../api/llmClient';
import { TranslationKeys } from '../i18n/types';

function getISODateTimeString(date: Date = new Date()): string {
  const pad = (num: number) => num.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offH = pad(Math.floor(absOffset / 60));
  const offM = pad(absOffset % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${offH}:${offM}`;
}

interface RollingSessionData {
  id: number;
  timestamp: string;
  fileName: string;
  filePath?: string;
  sessionType?: 'proofread' | 'translation' | 'custom_edit';
  status?: 'completed' | 'cancelled';
  targetPath?: string;
  promptText: string;
  model: string;
  totalTimeMs: number;
  tokensPerSec?: number;
  usage?: LLMUsage;
  responseId?: string;
  finishReason?: string;
  systemFingerprint?: string;
  createdTimestamp?: number;
  itemsCount: number;
  items?: ProofreadDiffItem[];
  originalMarkdown?: string;
  translatedMarkdown?: string;
  proofreadOptions: ProofreadOptions;
  translationOptions: TranslationOptions;
  /** 출발어 = 도착어인 경우 true (세션 카드 레이블을 "편집"으로 표시) */
  isSameLangEdit?: boolean;
  sessionEl?: HTMLElement;
}

export class EmilySidebarView extends ItemView {
  private plugin: EmilyPlugin;

  // Rolling Sessions State
  private sessionCounter: number = 0;
  private sessions: RollingSessionData[] = [];

  // Active Form State
  private proofreadOptions: ProofreadOptions = {
    checkSpelling: false,
    checkGrammar: false,
    removeTimestamps: false,
    improveExpression: false,
    checkConsistency: false,
    searchCitation: false,
    vaultSourcePath: undefined
  };

  private translationOptions: TranslationOptions = {
    enabled: false,
    sourceLanguage: 'auto',
    targetLanguage: '',
    scope: 'selection',
    preservation: 'new_file'
  };

  private customPromptText: string = '';
  private selectedSourceFileName: string = '';
  private lastCreatedTempPath: string | null = null;
  private isExecuting: boolean = false;
  private lockedTargetFile: TFile | null = null;
  private lockedTargetView: MarkdownView | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // UI Containers
  private contentScrollEl: HTMLElement | null = null;
  private sessionsContainerEl: HTMLElement | null = null;
  private activeFormContainerEl: HTMLElement | null = null;
  private promptTargetFileEl: HTMLElement | null = null;
  private sourcePathBadgeEl: HTMLElement | null = null;
  private sidebarNavigatorEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: EmilyPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.initOptionsFromSettings();
  }

  public initOptionsFromSettings() {
    const t = getTranslation(this.plugin.settings.language);
    this.proofreadOptions = {
      checkSpelling: this.plugin.settings.defaultProofreadSpelling ?? false,
      checkGrammar: this.plugin.settings.defaultProofreadGrammar ?? false,
      removeTimestamps: this.plugin.settings.defaultProofreadTimestamp ?? false,
      improveExpression: false,
      checkConsistency: false,
      searchCitation: false,
      vaultSourcePath: undefined
    };

    const rawSrc = this.plugin.settings.defaultTranslationSource || 'auto';
    const rawTgt = this.plugin.settings.defaultTranslationTarget || getDefaultTargetLanguageName(t);

    this.translationOptions = {
      enabled: this.plugin.settings.defaultTranslationEnabled || false,
      sourceLanguage: getLocalizedLanguageName(rawSrc, t),
      targetLanguage: getLocalizedLanguageName(rawTgt, t),
      scope: this.plugin.settings.defaultTranslationScope || 'selection',
      preservation: this.plugin.settings.defaultPreservationStrategy || 'new_file',
      tone: this.plugin.settings.defaultTranslationTone || 'academic',
      style: this.plugin.settings.defaultTranslationStyle || 'balanced',
      translateCodeComments: this.plugin.settings.defaultTranslateCodeComments || false
    };
  }

  public syncWithOptionsFromSettings() {
    this.initOptionsFromSettings();
    if (this.activeFormContainerEl) {
      const t = getTranslation(this.plugin.settings.language);
      this.renderActiveForm(this.activeFormContainerEl, t);
    }
  }

  getViewType(): string {
    return EMILY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Assistant Emily';
  }

  getIcon(): string {
    return 'sparkles';
  }

  async onOpen() {
    this.initOptionsFromSettings();
    this.renderView();

    // Listen for workspace active note changes in real time
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.updateTargetDocument();
      })
    );
    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        this.updateTargetDocument();
      })
    );
  }

  renderView() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('emily-sidebar-container');
    const t = getTranslation(this.plugin.settings.language);

    // Responsive width listener:
    // - width < 320px: Compact mode (hide all button text, show icon only)
    // - 320px <= width < 380px: Narrow mode (show main text, hide parenthetical extra text)
    // - width >= 380px: Full mode (show main text + parenthetical extra text)
    const updateResponsiveWidth = (width: number) => {
      if (width <= 0) return;
      container.style.setProperty('--emily-sidebar-width', `${width}px`);

      if (width < 320) {
        container.addClass('is-compact-sidebar');
        container.addClass('is-narrow-sidebar');
      } else if (width < 380) {
        container.removeClass('is-compact-sidebar');
        container.addClass('is-narrow-sidebar');
      } else {
        container.removeClass('is-compact-sidebar');
        container.removeClass('is-narrow-sidebar');
      }
    };

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          updateResponsiveWidth(entry.contentRect.width);
        }
      });
      this.resizeObserver.observe(container);
    }

    // Initial check for current width
    const currentWidth = container.getBoundingClientRect().width;
    updateResponsiveWidth(currentWidth);

    // 1. Sidebar Header
    const header = container.createDiv({ cls: 'emily-sidebar-header' });
    const titleWrap = header.createDiv({ cls: 'emily-sidebar-title' });
    const iconSpan = titleWrap.createSpan();
    setIcon(iconSpan, 'sparkles');
    titleWrap.createSpan({ text: t.sidebar.title });

    const actions = header.createDiv({ cls: 'emily-header-actions' });
    const collapseControlBtn = actions.createEl('button', {
      cls: 'emily-icon-btn',
      attr: { title: t.sidebar.collapseAll }
    });
    setIcon(collapseControlBtn, 'chevrons-up-down');
    collapseControlBtn.addEventListener('click', () => this.toggleControlAccordions());

    const foldHistoryBtn = actions.createEl('button', {
      cls: 'emily-icon-btn',
      attr: { title: t.sidebar.foldHistory }
    });
    setIcon(foldHistoryBtn, 'history');
    foldHistoryBtn.addEventListener('click', () => this.toggleHistorySessions());

    // 2. Scrollable Content Area (Holds History Sessions + Active Form)
    this.contentScrollEl = container.createDiv({ cls: 'emily-sidebar-content' });

    // Sessions history container
    this.sessionsContainerEl = this.contentScrollEl.createDiv({ cls: 'emily-sessions-history-container' });

    // Active Form container (Where the current/next form lives)
    this.activeFormContainerEl = this.contentScrollEl.createDiv({ cls: 'emily-active-form-container' });
    this.renderActiveForm(this.activeFormContainerEl, t);

    // 4. Sidebar Floating Navigator (Docked inside sidebar at bottom-right)
    this.renderSidebarNavigator(container);

    // View-wide Ctrl+Enter capture listener to reliably start pipeline
    this.containerEl.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
        if ((e.ctrlKey || e.metaKey) && isEnter) {
          const applyBtn = this.activeFormContainerEl?.querySelector('.emily-btn-primary') as HTMLButtonElement;
          if (applyBtn && !applyBtn.disabled && !this.isExecuting) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            applyBtn.click();
          }
        }
      },
      { capture: true }
    );
  }

  public updateTargetDocument() {
    if (!this.promptTargetFileEl) return;
    const t = getTranslation(this.plugin.settings.language);

    // If a pipeline task is actively running, lock the target document display
    if (this.isExecuting && this.lockedTargetFile) {
      this.promptTargetFileEl.empty();
      const iconSpan = this.promptTargetFileEl.createSpan({ cls: 'emily-prompt-file-icon' });
      setIcon(iconSpan, 'lock');
      const nameSpan = this.promptTargetFileEl.createSpan({ cls: 'emily-prompt-file-name' });
      nameSpan.setText(this.lockedTargetFile.name);
      this.promptTargetFileEl.setAttribute(
        'title',
        t.sidebar.targetLockedTooltip.replace('{path}', this.lockedTargetFile.path)
      );
      this.promptTargetFileEl.addClass('is-locked');
      return;
    }

    this.promptTargetFileEl.removeClass('is-locked');
    const target = this.plugin.getTargetMarkdownView();
    if (target?.file) {
      this.promptTargetFileEl.empty();
      const iconSpan = this.promptTargetFileEl.createSpan({ cls: 'emily-prompt-file-icon' });
      setIcon(iconSpan, 'file-text');
      const nameSpan = this.promptTargetFileEl.createSpan({ cls: 'emily-prompt-file-name' });
      nameSpan.setText(target.file.name);
      this.promptTargetFileEl.setAttribute('title', target.file.path);
    } else {
      this.promptTargetFileEl.empty();
      const iconSpan = this.promptTargetFileEl.createSpan({ cls: 'emily-prompt-file-icon' });
      setIcon(iconSpan, 'file-question');
      const nameSpan = this.promptTargetFileEl.createSpan({ cls: 'emily-prompt-file-name is-empty' });
      nameSpan.setText(t.sidebar.noActiveDoc);
      this.promptTargetFileEl.setAttribute('title', t.sidebar.noActiveDoc);
    }
  }

  // Backward compatibility alias
  public updateDocBar() {
    this.updateTargetDocument();
  }

  private renderActiveForm(parent: HTMLElement, t: TranslationKeys) {
    parent.empty();
    parent.removeClass('is-form-executing');

    if (this.sessions.length > 0) {
      const divider = parent.createDiv({ cls: 'emily-rolling-divider' });
      divider.setText(`${t.sidebar.newSession}${this.sessions.length + 1}`);
    }

    // Section 1: 교열 (Proofreading)
    this.renderProofreadingSection(parent, t);

    // Section 2: 번역 (Translation)
    this.renderTranslationSection(parent, t);

    // Section 3: 편집 (Custom Editor Prompt & LLM Execution)
    this.renderCustomPromptSection(parent, t);
  }

  private renderProofreadingSection(parent: HTMLElement, t: TranslationKeys) {
    const getProofreadCount = () => {
      let count = 0;
      if (this.proofreadOptions.checkSpelling) count++;
      if (this.proofreadOptions.checkGrammar) count++;
      if (this.proofreadOptions.removeTimestamps) count++;
      if (this.proofreadOptions.improveExpression) count++;
      if (this.proofreadOptions.checkConsistency) count++;
      if (this.proofreadOptions.searchCitation) count++;
      return count;
    };

    const section = parent.createDiv({ cls: 'emily-accordion-section' });

    const header = section.createDiv({
      cls: 'emily-accordion-header',
      attr: { role: 'button', tabindex: '0', 'aria-expanded': 'false' }
    });
    const titleWrap = header.createDiv({ cls: 'emily-accordion-title-wrap' });
    const chevron = titleWrap.createSpan({ cls: 'emily-chevron-icon' });
    setIcon(chevron, 'chevron-right');
    titleWrap.createSpan({ text: t.sidebar.proofreading });

    // Circular Count Badge
    const countBadge = header.createSpan({
      cls: `emily-count-badge ${getProofreadCount() > 0 ? '' : 'is-zero'}`
    });
    countBadge.setText(String(getProofreadCount()));

    const updateProofCountBadge = () => {
      const c = getProofreadCount();
      countBadge.setText(String(c));
      if (c > 0) {
        countBadge.removeClass('is-zero');
      } else {
        countBadge.addClass('is-zero');
      }
    };

    const body = section.createDiv({
      cls: 'emily-accordion-body is-collapsed'
    });
    header.addEventListener('click', () => {
      if (this.isExecuting || header.hasClass('is-disabled')) return;
      this.toggleAccordion(header, body);
    });
    header.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.isExecuting || header.hasClass('is-disabled')) return;
      if (e.target === header && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.toggleAccordion(header, body);
      }
    });

    const groupWrap = body.createDiv({ cls: 'emily-field-group' });
    groupWrap.createSpan({
      text: t.sidebar.proofreadScope,
      cls: 'emily-field-label font-semibold'
    });

    const grid = groupWrap.createDiv({ cls: 'emily-segmented-grid' });

    // 1. 맞춤법 검사 (Spell Check)
    this.createToggleSegmentedButton(
      grid,
      'check-check',
      t.sidebar.spelling,
      t.sidebar.spellingDesc,
      Boolean(this.proofreadOptions.checkSpelling),
      (checked) => {
        this.proofreadOptions.checkSpelling = checked;
        updateProofCountBadge();
      }
    );

    // 2. 문법 검사 (Grammar Check)
    this.createToggleSegmentedButton(
      grid,
      'book-open',
      t.sidebar.grammar,
      t.sidebar.grammarDesc,
      Boolean(this.proofreadOptions.checkGrammar),
      (checked) => {
        this.proofreadOptions.checkGrammar = checked;
        updateProofCountBadge();
      }
    );

    // 3. 타임스탬프 삭제 (Timestamp Clean & Concatenation)
    this.createToggleSegmentedButton(
      grid,
      'clock',
      t.sidebar.timestamp,
      t.sidebar.timestampDesc,
      Boolean(this.proofreadOptions.removeTimestamps),
      (checked) => {
        this.proofreadOptions.removeTimestamps = checked;
        updateProofCountBadge();
      }
    );

    /*
     * ============================================================================
     * [추후 개발 예정 기능 - 현재 숨김 및 주석 처리]
     * 아래 기능들(표현 개선, 내부 일관성 검증, 인용 근거 검색)은 향후 고도화 단계에서 개발될 예정입니다.
     * ============================================================================
     *
     * // 3. 표현 개선 (추후 개발 예정)
     * this.createCheckboxItem(
     *   optionsList,
     *   t.sidebar.expression,
     *   t.sidebar.expressionDesc,
     *   this.proofreadOptions.improveExpression,
     *   (val) => { this.proofreadOptions.improveExpression = val; }
     * );
     *
     * // 4. 내부 일관성 검증 + 소스 선택 버튼 (추후 개발 예정)
     * const consistencyItem = optionsList.createDiv({ cls: 'emily-option-item' });
     * const consistencyCheck = consistencyItem.createEl('input', { type: 'checkbox' });
     * consistencyCheck.checked = this.proofreadOptions.checkConsistency;
     * consistencyCheck.addEventListener('change', () => {
     *   this.proofreadOptions.checkConsistency = consistencyCheck.checked;
     * });
     *
     * const consistencyInfo = consistencyItem.createDiv({ cls: 'emily-option-text flex-1' });
     * const topRow = consistencyInfo.createDiv({ cls: 'flex items-center justify-between w-full' });
     * topRow.createSpan({ text: t.sidebar.consistency, cls: 'emily-option-label' });
     *
     * const sourceBtn = topRow.createEl('button', {
     *   text: t.sidebar.selectSource,
     *   cls: 'emily-btn-secondary'
     * });
     * sourceBtn.addEventListener('click', (e) => {
     *   e.stopPropagation();
     *   new VaultSourceSelectModal(this.app, (file: TFile) => {
     *     this.proofreadOptions.vaultSourcePath = file.path;
     *     this.selectedSourceFileName = file.name;
     *     if (this.sourcePathBadgeEl) {
     *       this.sourcePathBadgeEl.setText(`소스: ${file.name}`);
     *       this.sourcePathBadgeEl.style.display = 'inline-block';
     *     }
     *     new Notice(`참조 소스 문서 [${file.name}] 가 연결되었습니다.`);
     *   }).open();
     * });
     *
     * consistencyInfo.createSpan({ text: t.sidebar.consistencyDesc, cls: 'emily-option-desc' });
     * this.sourcePathBadgeEl = consistencyInfo.createSpan({
     *   text: this.selectedSourceFileName ? `소스: ${this.selectedSourceFileName}` : '',
     *   cls: 'emily-badge is-warning'
     * });
     * this.sourcePathBadgeEl.style.display = this.selectedSourceFileName ? 'inline-block' : 'none';
     * this.sourcePathBadgeEl.style.marginTop = '4px';
     *
     * // 5. 인용 근거 검색 (추후 개발 예정)
     * this.createCheckboxItem(
     *   optionsList,
     *   t.sidebar.citation,
     *   t.sidebar.citationDesc,
     *   this.proofreadOptions.searchCitation,
     *   (val) => { this.proofreadOptions.searchCitation = val; }
     * );
     */
  }

  private renderTranslationSection(parent: HTMLElement, t: TranslationKeys) {
    const section = parent.createDiv({ cls: 'emily-accordion-section' });

    const header = section.createDiv({
      cls: 'emily-accordion-header',
      attr: { role: 'button', tabindex: '0', 'aria-expanded': 'false' }
    });
    const titleWrap = header.createDiv({ cls: 'emily-accordion-title-wrap' });
    const chevron = titleWrap.createSpan({ cls: 'emily-chevron-icon' });
    setIcon(chevron, 'chevron-right');
    titleWrap.createSpan({ text: t.sidebar.translation });

    // Right Action Area: Switch UI (No count badge since translation has no multiple sub-options)
    const headerRight = header.createDiv({ cls: 'emily-accordion-header-right' });

    const switchLabel = headerRight.createEl('label', {
      cls: 'emily-toggle-switch',
      attr: {
        title: this.translationOptions.enabled
          ? t.sidebar.transEnabledTooltipOn
          : t.sidebar.transEnabledTooltipOff
      }
    });
    const switchInput = switchLabel.createEl('input', { type: 'checkbox' });
    switchInput.checked = Boolean(this.translationOptions.enabled);
    switchLabel.createSpan({ cls: 'emily-toggle-slider' });

    const body = section.createDiv({
      cls: 'emily-accordion-body is-collapsed'
    });

    const bodyContent = body.createDiv({
      cls: `emily-translation-body-content ${this.translationOptions.enabled ? '' : 'is-disabled'}`
    });

    const updateBodyEnabledState = () => {
      if (this.translationOptions.enabled) {
        bodyContent.removeClass('is-disabled');
      } else {
        bodyContent.addClass('is-disabled');
      }
    };

    // 1. 우측 액션 영역(스위치 및 카운트 뱃지) 이벤트 전파 격리
    // 스위치 영역 클릭 시 상위 header의 아코디언 토글 이벤트로 전파되어 중복 실행되는 현상 원천 차단
    headerRight.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    headerRight.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    switchLabel.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    switchLabel.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    // 2. 스위치 ON/OFF 변경 이벤트
    switchInput.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    switchInput.addEventListener('change', (e) => {
      e.stopPropagation();
      const isChecked = switchInput.checked;
      this.translationOptions.enabled = isChecked;
      updateBodyEnabledState();
      switchLabel.setAttribute(
        'title',
        isChecked ? t.sidebar.transEnabledTooltipOn : t.sidebar.transEnabledTooltipOff
      );

      // UX 개선: 사용자가 번역 스위치를 켤 때(ON), 옵션을 즉시 확인하고 설정할 수 있도록 아코디언을 자동으로 펼침
      if (isChecked && !header.hasClass('is-expanded')) {
        this.toggleAccordion(header, body);
      }
    });

    // 3. 타이틀바(아코디언 헤더) 클릭 이벤트: 스위치 영역을 제외한 타이틀바 영역 클릭 시에만 아코디언 접기/펼치기
    header.addEventListener('click', (e: MouseEvent) => {
      if (this.isExecuting || header.hasClass('is-disabled')) return;
      const target = e.target as HTMLElement;
      if (target && target.closest('.emily-accordion-header-right')) {
        return;
      }
      this.toggleAccordion(header, body);
    });

    // 4. 키보드 접근성: 타이틀바 포커스 상태에서 Enter/Space로 아코디언 토글
    header.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.isExecuting || header.hasClass('is-disabled')) return;
      if (e.target === header && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.toggleAccordion(header, body);
      }
    });

    // Language Direction Row
    const dirGroup = bodyContent.createDiv({ cls: 'emily-field-group' });
    const dirRow = dirGroup.createDiv({ cls: 'emily-direction-row' });

    // Source Language Select
    const srcBox = dirRow.createDiv({ cls: 'emily-select-box' });
    const srcSelect = srcBox.createEl('select', { cls: 'dropdown emily-select-input' });
    const srcLanguages = getSourceLanguages(t);
    const rawSrc = this.translationOptions.sourceLanguage || this.plugin.settings.defaultTranslationSource || 'auto';
    const currentSrcLocalized = getLocalizedLanguageName(rawSrc, t);
    const currentSrcCode = normalizeLanguageCode(rawSrc);
    this.translationOptions.sourceLanguage = currentSrcLocalized;

    srcLanguages.forEach((lang) => {
      const opt = srcSelect.createEl('option', { text: lang.name, value: lang.name });
      if (
        lang.name === currentSrcLocalized ||
        lang.name === rawSrc ||
        lang.code === currentSrcCode ||
        (currentSrcCode === 'auto' && lang.code === 'auto')
      ) {
        opt.selected = true;
      }
    });
    srcSelect.addEventListener('change', () => {
      this.translationOptions.sourceLanguage = srcSelect.value;
    });

    // Arrow in middle indicating translation direction
    const arrowEl = dirRow.createDiv({ cls: 'emily-direction-arrow' });
    arrowEl.setText('➔');

    // Target Language Select
    const tgtBox = dirRow.createDiv({ cls: 'emily-select-box' });
    const tgtSelect = tgtBox.createEl('select', { cls: 'dropdown emily-select-input' });
    const tgtLanguages = getSupportedLanguages(t);
    const rawTgt = this.translationOptions.targetLanguage || this.plugin.settings.defaultTranslationTarget || getDefaultTargetLanguageName(t);
    const currentTgtLocalized = getLocalizedLanguageName(rawTgt, t);
    const currentTgtCode = normalizeLanguageCode(rawTgt);
    this.translationOptions.targetLanguage = currentTgtLocalized;

    tgtLanguages.forEach((lang) => {
      const opt = tgtSelect.createEl('option', { text: lang.name, value: lang.name });
      if (
        lang.name === currentTgtLocalized ||
        lang.name === rawTgt ||
        lang.code === currentTgtCode
      ) {
        opt.selected = true;
      }
    });
    tgtSelect.addEventListener('change', () => {
      this.translationOptions.targetLanguage = tgtSelect.value;
    });

    // 1. 번역 범위 (Scope: 3-Button Segmented Grid with Icons & Rich Tooltips)
    this.createSegmentedGroup(
      bodyContent,
      t.sidebar.transScope,
      [
        {
          value: 'selection',
          icon: 'text-select',
          label: t.scopes.selection,
          desc: t.scopes.selectionDesc
        },
        {
          value: 'all',
          icon: 'globe',
          label: t.scopes.all,
          desc: t.scopes.allDesc
        },
        {
          value: 'paragraph_bilingual',
          icon: 'split',
          label: t.scopes.paragraphBilingual,
          desc: t.scopes.paragraphBilingualDesc
        }
      ],
      this.translationOptions.scope || 'selection',
      (val) => {
        this.translationOptions.scope = val;
      }
    );

    // 2. 원문 보존 방식 (Preservation: 3-Button Segmented Grid with Icons & Rich Tooltips)
    this.createSegmentedGroup(
      bodyContent,
      t.sidebar.preservation,
      [
        {
          value: 'new_file',
          icon: 'file-plus',
          label: t.preservation.newFile,
          desc: t.preservation.newFileDesc
        },
        {
          value: 'append',
          icon: 'file-down',
          label: t.preservation.append,
          desc: t.preservation.appendDesc
        },
        {
          value: 'overwrite',
          icon: 'file-edit',
          label: t.preservation.overwrite,
          desc: t.preservation.overwriteDesc
        }
      ],
      this.translationOptions.preservation || 'new_file',
      (val) => {
        this.translationOptions.preservation = val;
      }
    );

    // 3. 번역 문체 (Tone)
    this.createSegmentedGroup(
      bodyContent,
      t.tones.title,
      [
        {
          value: 'academic',
          icon: 'book-open',
          label: t.tones.academic,
          desc: t.tones.academicDesc
        },
        {
          value: 'polite',
          icon: 'smile',
          label: t.tones.polite,
          desc: t.tones.politeDesc
        },
        {
          value: 'casual',
          icon: 'message-circle',
          label: t.tones.casual,
          desc: t.tones.casualDesc
        }
      ],
      this.translationOptions.tone || 'academic',
      (val: TranslationTone) => {
        this.translationOptions.tone = val;
      }
    );

    // 4. 번역 스타일 (Style)
    this.createSegmentedGroup(
      bodyContent,
      t.styles.title,
      [
        {
          value: 'balanced',
          icon: 'scale',
          label: t.styles.balanced,
          desc: t.styles.balancedDesc
        },
        {
          value: 'literal',
          icon: 'type',
          label: t.styles.literal,
          desc: t.styles.literalDesc
        },
        {
          value: 'natural',
          icon: 'feather',
          label: t.styles.natural,
          desc: t.styles.naturalDesc
        }
      ],
      this.translationOptions.style || 'balanced',
      (val: TranslationStyle) => {
        this.translationOptions.style = val;
      }
    );

    // 5. 기타 고급 옵션 (코드 블록 주석 번역)
    const extraOptionsGroup = bodyContent.createDiv({ cls: 'emily-field-group' });
    const codeCommentRow = extraOptionsGroup.createEl('label', { cls: 'emily-checkbox-row' });
    const codeCommentCheckbox = codeCommentRow.createEl('input', {
      type: 'checkbox',
      cls: 'emily-checkbox-input'
    });
    codeCommentCheckbox.checked = Boolean(this.translationOptions.translateCodeComments);
    codeCommentCheckbox.addEventListener('change', () => {
      this.translationOptions.translateCodeComments = codeCommentCheckbox.checked;
    });
    codeCommentRow.createSpan({
      text: t.sidebar.translateCodeComments,
      cls: 'emily-checkbox-label emily-field-label font-semibold'
    });
  }

  private renderCustomPromptSection(parent: HTMLElement, t: TranslationKeys) {
    const section = parent.createDiv({ cls: 'emily-custom-prompt-container' });

    // Textarea Wrap & Target Document Indicator
    const promptWrap = section.createDiv({ cls: 'emily-textarea-wrap' });

    // Dedicated target document indicator directly above textarea
    this.promptTargetFileEl = promptWrap.createDiv({ cls: 'emily-prompt-target-file' });
    this.promptTargetFileEl.addEventListener('click', () => {
      void (async () => {
        if (this.isExecuting && this.lockedTargetFile) {
          await this.openFileInTargetPane(this.lockedTargetFile.path);
        } else {
          const target = this.plugin.getTargetMarkdownView();
          if (target?.leaf) {
            this.app.workspace.setActiveLeaf(target.leaf, { focus: true });
          }
        }
      })();
    });
    this.updateTargetDocument();

    const textareaEl = promptWrap.createEl('textarea', {
      cls: 'emily-textarea',
      attr: {
        placeholder: t.sidebar.promptPlaceholder
      }
    });
    textareaEl.value = this.customPromptText;

    // Start Task Button with (Ctrl+Enter) hint and right-aligned character count
    const applyBtn = section.createEl('button', {
      cls: 'emily-btn-primary',
      attr: {
        type: 'button'
      }
    });

    const updateButtonTooltip = () => {
      const charCount = `${this.customPromptText.length.toLocaleString()}${t.sidebar.charCountSuffix}`;
      applyBtn.setAttribute('title', `${t.sidebar.applyBtn} (Ctrl+Enter) • ${charCount}`);
    };
    updateButtonTooltip();

    // Left spacer for perfect centering
    applyBtn.createSpan({ cls: 'emily-btn-spacer' });

    // Center content: Start Task (Ctrl+Enter)
    const btnCenter = applyBtn.createSpan({ cls: 'emily-btn-center-wrap' });
    btnCenter.createSpan({ text: t.sidebar.applyBtn, cls: 'emily-btn-main-label' });
    btnCenter.createSpan({ text: ' (Ctrl+Enter)', cls: 'emily-btn-shortcut-hint' });

    // Far-right content: character count
    const counterBadge = applyBtn.createSpan({
      text: `${this.customPromptText.length.toLocaleString()}${t.sidebar.charCountSuffix}`,
      cls: 'emily-btn-char-counter'
    });

    // Real-time character count update (without any arbitrary maxlength limit)
    textareaEl.addEventListener('input', () => {
      this.customPromptText = textareaEl.value;
      counterBadge.setText(`${textareaEl.value.length.toLocaleString()}${t.sidebar.charCountSuffix}`);
      updateButtonTooltip();
    });

    // Keyboard shortcut (Ctrl+Enter or Cmd+Enter to start task)
    // capture: true prevents Obsidian global workspace hotkeys from intercepting Ctrl+Enter
    const handleCtrlEnter = (e: KeyboardEvent) => {
      const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
      if ((e.ctrlKey || e.metaKey) && isEnter) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (!applyBtn.disabled && !this.isExecuting) {
          applyBtn.click();
        }
      }
    };

    textareaEl.addEventListener('keydown', handleCtrlEnter, { capture: true });
    promptWrap.addEventListener('keydown', handleCtrlEnter, { capture: true });
    section.addEventListener('keydown', handleCtrlEnter, { capture: true });

    // Live Status Output Box (Inside current form during execution)
    const statusBoxEl = section.createDiv({ cls: 'emily-status-box' });

    applyBtn.addEventListener('click', () => {
      void this.executePipeline(applyBtn, statusBoxEl, textareaEl, t);
    });
  }

  private setFormDisabledState(disabled: boolean) {
    this.isExecuting = disabled;
    if (!disabled) {
      this.lockedTargetFile = null;
      this.lockedTargetView = null;
      this.updateTargetDocument();
    }
    if (!this.activeFormContainerEl) return;

    if (disabled) {
      this.activeFormContainerEl.addClass('is-form-executing');
    } else {
      this.activeFormContainerEl.removeClass('is-form-executing');
    }

    const formElements = this.activeFormContainerEl.querySelectorAll(
      'input, select, textarea, .emily-segmented-btn, .emily-accordion-header'
    );

    formElements.forEach((el) => {
      if (
        el.instanceOf(HTMLInputElement) ||
        el.instanceOf(HTMLSelectElement) ||
        el.instanceOf(HTMLTextAreaElement) ||
        el.instanceOf(HTMLButtonElement)
      ) {
        el.disabled = disabled;
      }
      if (disabled) {
        el.addClass('is-disabled');
      } else {
        el.removeClass('is-disabled');
      }
    });
  }

  private async executePipeline(
    applyBtn: HTMLButtonElement,
    statusBoxEl: HTMLElement,
    textareaEl: HTMLTextAreaElement,
    t: TranslationKeys
  ) {
    const targetView = this.lockedTargetView || this.plugin.getTargetMarkdownView();
    if (!targetView || !targetView.file) {
      new Notice(t.sidebar.noTargetDocNotice);
      return;
    }

    const editor = targetView.editor;
    const currentDoc = editor.getValue();
    const activeFile = targetView.file;

    if (!currentDoc.trim()) {
      new Notice(t.sidebar.emptyDocNotice);
      return;
    }

    const hasProofreadOptions = Boolean(
      this.proofreadOptions.checkSpelling ||
      this.proofreadOptions.checkGrammar ||
      this.proofreadOptions.removeTimestamps ||
      this.proofreadOptions.improveExpression ||
      this.proofreadOptions.checkConsistency ||
      this.proofreadOptions.searchCitation
    );

    const hasTranslation = Boolean(this.translationOptions.enabled);
    const promptText = (this.customPromptText || '').trim();

    if (!hasProofreadOptions && !hasTranslation && !promptText) {
      new Notice(t.sidebar.specifyTaskNotice);
      return;
    }

    // API 연결 설정 유효성 검사 (엔드포인트 누락 또는 원격 API 키 누락 시 사전 안내)
    const baseUrl = (this.plugin.settings.apiBaseUrl || '').trim();
    const apiKey = (this.plugin.settings.apiKey || '').trim();
    if (!baseUrl) {
      new Notice('API Base URL이 설정되지 않았습니다. [설정 > Assistant Emily]에서 엔드포인트를 입력해 주세요.');
      return;
    }
    const isLocalEndpoint = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(baseUrl);
    if (!isLocalEndpoint && !apiKey) {
      new Notice('API Key가 설정되지 않았습니다. [설정 > Assistant Emily]에서 API 키를 입력해 주세요.');
      return;
    }

    // Set UI to Loading & Disabled State (Lock target document & all options during execution)
    this.lockedTargetFile = activeFile;
    this.lockedTargetView = targetView;
    this.isExecuting = true;
    this.setFormDisabledState(true);
    this.updateTargetDocument();
    applyBtn.disabled = true;
    statusBoxEl.addClass('is-visible');

    const initialStep2Title = hasTranslation
      ? t.sidebar.pipelineLlmTrans
      : (hasProofreadOptions
          ? t.sidebar.pipelineLlmProof
          : t.sidebar.pipelineLlmCustom);

    const pipelineStartTime = Date.now();
    let timerInterval: number | null = null;
    const stopPipelineTimer = () => {
      if (timerInterval !== null) {
        window.clearInterval(timerInterval);
        timerInterval = null;
      }
    };

    statusBoxEl.empty();
    const statusHeader = statusBoxEl.createDiv({ cls: 'emily-status-header' });
    statusHeader.createSpan({ text: `⚡ ${t.sidebar.pipelineStream}`, cls: 'font-semibold text-xs' });
    const badgeSpan = statusHeader.createSpan({ cls: 'emily-badge is-active' });
    badgeSpan.createSpan({ cls: 'emily-badge-spinner' });
    badgeSpan.createSpan({ text: t.sidebar.pipelineRunning, cls: 'emily-badge-label' });
    const timerTextEl = badgeSpan.createSpan({ text: '0.0s', cls: 'emily-timer-text' });
    const dotsAnim = badgeSpan.createSpan({ cls: 'emily-dots-anim' });
    dotsAnim.createSpan({ text: '.' });
    dotsAnim.createSpan({ text: '.' });
    dotsAnim.createSpan({ text: '.' });

    const timelineContainer = statusBoxEl.createDiv({ cls: 'emily-timeline-steps' });
    const createStepNode = (id: string, title: string, desc: string, status: 'is-active' | 'is-pending' = 'is-pending') => {
      const step = timelineContainer.createDiv({ cls: `emily-timeline-step ${status}`, attr: { id } });
      const node = step.createDiv({ cls: 'emily-timeline-node' });
      node.createSpan({ cls: 'emily-timeline-dot' });
      const body = step.createDiv({ cls: 'emily-timeline-body' });
      body.createDiv({ text: title, cls: 'emily-timeline-title' });
      body.createDiv({ text: desc, cls: 'emily-timeline-desc' });
      return step;
    };

    const step1 = createStepNode('step-1', t.sidebar.pipelineParsing, t.sidebar.pipelineParsingDesc, 'is-active');
    const step2 = createStepNode('step-2', initialStep2Title, t.sidebar.pipelinePending, 'is-pending');
    const step3 = createStepNode('step-3', t.sidebar.pipelineSync, t.sidebar.pipelinePending, 'is-pending');

    timerInterval = window.setInterval(() => {
      if (timerTextEl) {
        const elapsed = ((Date.now() - pipelineStartTime) / 1000).toFixed(1);
        timerTextEl.textContent = `${elapsed}s`;
      }
    }, 100);

    try {
      const detectedLang = detectDocumentLanguage(currentDoc, this.plugin.settings.language);
      const isAutoSrc = !this.translationOptions.sourceLanguage ||
        normalizeLanguageCode(this.translationOptions.sourceLanguage) === 'auto';

      // Step 1 Complete
      await new Promise((r) => window.setTimeout(r, 150));
      this.updateTimelineStep(
        step1,
        'done',
        t.sidebar.pipelineParsing,
        t.sidebar.detectDoneDesc.replace('{lang}', detectedLang.name)
      );

      const step2 = statusBoxEl.querySelector('#step-2') as HTMLElement;
      const step3 = statusBoxEl.querySelector('#step-3') as HTMLElement;

      if (hasTranslation) {
        // ==========================================
        // 🚀 1. 번역 또는 동일 언어 편집 파이프라인 실행
        // ==========================================
        const isSelectionScope = this.translationOptions.scope === 'selection';
        const selectedText = isSelectionScope ? editor.getSelection() : '';

        if (isSelectionScope && (!selectedText || !selectedText.trim())) {
          stopPipelineTimer();
          new Notice(t.sidebar.selectTextToTranslateNotice);
          this.setFormDisabledState(false);
          applyBtn.disabled = false;
          statusBoxEl.removeClass('is-visible');
          return;
        }

        const contentToTranslate = isSelectionScope ? selectedText : currentDoc;
        const transDetected = detectDocumentLanguage(contentToTranslate, this.plugin.settings.language);
        const transEffectiveSrc = isAutoSrc ? transDetected.name : this.translationOptions.sourceLanguage;

        // 출발어 = 도착어 판별: 동일 언어이면 "편집", 다른 언어이면 "번역"
        const isSameLangEdit = isSameLanguage(transEffectiveSrc, this.translationOptions.targetLanguage);
        const opLabel = isSameLangEdit ? t.sidebar.opLabelEdit : t.sidebar.opLabelTrans;
        const langLabel = isSameLangEdit
          ? `${transEffectiveSrc} (${t.sidebar.sameLangEditSuffix})`
          : `${transEffectiveSrc} ➔ ${this.translationOptions.targetLanguage}`;

        this.updateTimelineStep(
          step2,
          'active',
          `LLM ${opLabel} (${langLabel})`,
          t.sidebar.opRunningDesc.replace('{op}', opLabel)
        );

        const transEngine = this.plugin.getTranslationEngine();
        const transOptionsWithDetected: TranslationOptions = {
          ...this.translationOptions,
          sourceLanguage: transEffectiveSrc,
          isSameLangEdit,
          tone: this.translationOptions.tone || this.plugin.settings.defaultTranslationTone,
          style: this.translationOptions.style || this.plugin.settings.defaultTranslationStyle,
          translateCodeComments: this.translationOptions.translateCodeComments ?? this.plugin.settings.defaultTranslateCodeComments
        };

        const transResult = await transEngine.runTranslation(
          activeFile,
          contentToTranslate,
          transOptionsWithDetected,
          promptText,
          (current, total) => {
            if (total > 1) {
              this.updateTimelineStep(
                step2,
                'active',
                `LLM ${opLabel} (${langLabel}) [${current}/${total}]`,
                t.sidebar.runningChunkDesc.replace('{op}', opLabel).replace('{current}', String(current)).replace('{total}', String(total))
              );
            }
          }
        );

        if (transResult.result.targetPath) {
          this.lastCreatedTempPath = transResult.result.targetPath;
        }

        const chunkInfo = transResult.result.chunksCount && transResult.result.chunksCount > 1
          ? t.sidebar.chunkSplitInfo.replace('{count}', String(transResult.result.chunksCount))
          : '';

        this.updateTimelineStep(
          step2,
          'done',
          `LLM ${opLabel} (${langLabel})${chunkInfo}`,
          t.sidebar.opCompletedDesc.replace('{op}', opLabel).replace('{time}', String(transResult.totalTimeMs)).replace('{speed}', String(transResult.tokensPerSec || 0))
        );

        let syncDesc = isSameLangEdit ? t.sidebar.syncDirectEditDone : t.sidebar.syncDirectTransDone;
        if (this.translationOptions.preservation === 'new_file') {
          const newName = transResult.result.targetPath?.split('/').pop() || '';
          syncDesc = isSameLangEdit
            ? t.sidebar.syncNewFileEditDone.replace('{file}', newName)
            : t.sidebar.syncNewFileTransDone.replace('{file}', newName);
        } else if (this.translationOptions.preservation === 'append') {
          if (isSelectionScope) {
            const cleanSelected = selectedText.trimEnd();
            const cleanTranslated = transResult.result.translatedMarkdown.trim();
            editor.replaceSelection(`${cleanSelected}\n\n${cleanTranslated}`);
            syncDesc = isSameLangEdit ? t.sidebar.syncAppendEditDone : t.sidebar.syncAppendTransDone;
          } else {
            syncDesc = isSameLangEdit ? t.sidebar.syncAppendDocEditDone : t.sidebar.syncAppendDocTransDone;
          }
        } else {
          if (isSelectionScope) {
            editor.replaceSelection(transResult.result.translatedMarkdown.trim());
            syncDesc = isSameLangEdit ? t.sidebar.syncReplaceEditDone : t.sidebar.syncReplaceTransDone;
          }
        }

        this.updateTimelineStep(
          step3,
          'done',
          isSameLangEdit ? t.sidebar.syncTitleEdit : t.sidebar.syncTitleTrans,
          syncDesc
        );

        stopPipelineTimer();
        const badgeEl = statusBoxEl.querySelector('.emily-badge') as HTMLElement;
        if (badgeEl) {
          badgeEl.className = 'emily-badge is-done';
          badgeEl.empty();
          badgeEl.createSpan({ text: t.sidebar.pipelineDone });
          badgeEl.createSpan({ cls: 'emily-timer-text', text: `${((Date.now() - pipelineStartTime) / 1000).toFixed(1)}s` });
        }

        this.finalizeCompletedSession({
          activeFile,
          sessionType: 'translation',
          isSameLangEdit,
          targetPath: transResult.result.targetPath,
          model: transResult.model,
          totalTimeMs: transResult.totalTimeMs,
          tokensPerSec: transResult.tokensPerSec,
          usage: transResult.usage,
          responseId: transResult.id,
          finishReason: transResult.finish_reason,
          systemFingerprint: transResult.system_fingerprint,
          createdTimestamp: transResult.created,
          items: [],
          originalMarkdown: contentToTranslate,
          translatedMarkdown: transResult.result.translatedMarkdown,
          effectiveSrc: transEffectiveSrc,
          t
        });
      } else if (hasProofreadOptions) {
        // ==========================================
        // 📝 2. 교열 (Proofreading) 파이프라인 실행
        // ==========================================
        const appliedProofOpts: string[] = [];
        if (this.proofreadOptions.checkSpelling) appliedProofOpts.push(t.sidebar.spelling);
        if (this.proofreadOptions.checkGrammar) appliedProofOpts.push(t.sidebar.grammar);
        if (this.proofreadOptions.removeTimestamps) appliedProofOpts.push(t.sidebar.timestamp);
        if (this.proofreadOptions.improveExpression) appliedProofOpts.push(t.sidebar.expression);
        if (this.proofreadOptions.checkConsistency) appliedProofOpts.push(t.sidebar.consistency);
        if (this.proofreadOptions.searchCitation) appliedProofOpts.push(t.sidebar.citation);
        const proofOptsSummary = appliedProofOpts.join(', ');

        this.updateTimelineStep(
          step2,
          'active',
          `${t.sidebar.pipelineLlmProof} (${proofOptsSummary})`,
          t.sidebar.opProofRunningDesc
        );

        const proofreader = this.plugin.getProofreadingEngine();
        const proofResult = await proofreader.runProofreading(
          currentDoc,
          this.proofreadOptions,
          promptText
        );

        this.updateTimelineStep(
          step2,
          'done',
          `${t.sidebar.pipelineLlmProof} (${proofOptsSummary})`,
          t.sidebar.opProofCompletedDesc.replace('{time}', String(proofResult.totalTimeMs)).replace('{speed}', String(proofResult.tokensPerSec || 0))
        );

        if (proofResult.items.length === 0) {
          this.updateTimelineStep(
            step3,
            'done',
            t.sidebar.pipelineDone,
            t.sidebar.noIssuesDetected
          );

          stopPipelineTimer();
          const badgeEl = statusBoxEl.querySelector('.emily-badge') as HTMLElement;
          if (badgeEl) {
            badgeEl.className = 'emily-badge is-done';
            badgeEl.empty();
            badgeEl.createSpan({ text: t.sidebar.pipelineDone });
            badgeEl.createSpan({ cls: 'emily-timer-text', text: `${((Date.now() - pipelineStartTime) / 1000).toFixed(1)}s` });
          }

          this.finalizeCompletedSession({
            activeFile,
            sessionType: 'proofread',
            model: proofResult.model,
            totalTimeMs: proofResult.totalTimeMs,
            tokensPerSec: proofResult.tokensPerSec,
            usage: proofResult.usage,
            responseId: proofResult.id,
            finishReason: proofResult.finish_reason,
            systemFingerprint: proofResult.system_fingerprint,
            createdTimestamp: proofResult.created,
            items: [],
            effectiveSrc: detectedLang.name,
            t
          });
        } else {
          this.updateTimelineStep(
            step3,
            'active',
            t.sidebar.pipelineReviewPending,
            t.sidebar.reviewPendingCount.replace('{count}', String(proofResult.items.length))
          );

          stopPipelineTimer();
          const badgeEl = statusBoxEl.querySelector('.emily-badge') as HTMLElement;
          if (badgeEl) {
            badgeEl.className = 'emily-badge is-done';
            badgeEl.empty();
            badgeEl.createSpan({ text: t.sidebar.pipelineReviewPending });
            badgeEl.createSpan({ cls: 'emily-timer-text', text: `${((Date.now() - pipelineStartTime) / 1000).toFixed(1)}s` });
          }

          const modal = new ProofreadDiffModal(
            this.app,
            editor,
            proofResult.items,
            (appliedItems: ProofreadDiffItem[]) => {
              this.updateTimelineStep(
                step3,
                'done',
                t.sidebar.syncTitleProof,
                t.sidebar.appliedChangesCount.replace('{count}', String(appliedItems.length))
              );
              this.finalizeCompletedSession({
                activeFile,
                sessionType: 'proofread',
                model: proofResult.model,
                totalTimeMs: proofResult.totalTimeMs,
                tokensPerSec: proofResult.tokensPerSec,
                usage: proofResult.usage,
                responseId: proofResult.id,
                finishReason: proofResult.finish_reason,
                systemFingerprint: proofResult.system_fingerprint,
                createdTimestamp: proofResult.created,
                items: appliedItems,
                effectiveSrc: detectedLang.name,
                t
              });
            },
            () => {
              this.updateTimelineStep(
                step3,
                'warning',
                t.sidebar.pipelineCancelled,
                t.sidebar.reviewCancelDesc
              );
              new Notice(t.sidebar.pipelineCancelledNotice);
              this.finalizeCompletedSession({
                activeFile,
                sessionType: 'proofread',
                status: 'cancelled',
                model: proofResult.model,
                totalTimeMs: proofResult.totalTimeMs,
                tokensPerSec: proofResult.tokensPerSec,
                usage: proofResult.usage,
                responseId: proofResult.id,
                finishReason: proofResult.finish_reason,
                systemFingerprint: proofResult.system_fingerprint,
                createdTimestamp: proofResult.created,
                items: proofResult.items,
                effectiveSrc: detectedLang.name,
                t
              });
            },
            this.plugin.settings.language
          );
          modal.open();
        }
      } else {
        // ==========================================
        // ✏️ 3. 직접 편집 / 질의 (Custom Edit / Query) 파이프라인 실행
        // ==========================================
        this.updateTimelineStep(
          step2,
          'active',
          t.sidebar.pipelineLlmCustom,
          t.sidebar.opDirectEditRunningDesc
        );

        const llmClient = this.plugin.getLLMClient();
        const promptPayload = PromptBuilder.buildCustomEditPrompt(currentDoc, promptText);
        const startTime = Date.now();
        const response = await llmClient.chatCompletion([
          { role: 'system', content: promptPayload.system },
          { role: 'user', content: promptPayload.user }
        ]);

        let editedDoc = response.content.trim();
        // Remove markdown block wrapper if LLM wrapped entire output in ```markdown ... ```
        if (editedDoc.startsWith('```markdown') && editedDoc.endsWith('```')) {
          editedDoc = editedDoc.slice(11, -3).trim();
        } else if (editedDoc.startsWith('```md') && editedDoc.endsWith('```')) {
          editedDoc = editedDoc.slice(5, -3).trim();
        } else if (editedDoc.startsWith('```') && editedDoc.endsWith('```')) {
          editedDoc = editedDoc.slice(3, -3).trim();
        }

        // Apply East Asian bold spacing rule (**단어** 조사 -> **단어** 조사)
        editedDoc = MarkdownFormatter.fixEastAsianBoldSpacing(editedDoc);

        const totalTimeMs = Date.now() - startTime;
        const tokensPerSec = response.tokensPerSec || Math.round((editedDoc.length / 4) / (totalTimeMs / 1000 || 1));

        this.updateTimelineStep(
          step2,
          'done',
          t.sidebar.pipelineLlmCustom,
          t.sidebar.opDirectEditCompletedDesc.replace('{time}', String(totalTimeMs)).replace('{speed}', String(tokensPerSec))
        );

        // Apply edited text directly to active editor
        editor.setValue(editedDoc);

        this.updateTimelineStep(
          step3,
          'done',
          t.sidebar.syncTitleCustom,
          t.sidebar.syncDescCustom
        );

        stopPipelineTimer();
        const badgeEl = statusBoxEl.querySelector('.emily-badge') as HTMLElement;
        if (badgeEl) {
          badgeEl.className = 'emily-badge is-done';
          badgeEl.empty();
          badgeEl.createSpan({ text: t.sidebar.pipelineDone });
          badgeEl.createSpan({ cls: 'emily-timer-text', text: `${((Date.now() - pipelineStartTime) / 1000).toFixed(1)}s` });
        }

        this.finalizeCompletedSession({
          activeFile,
          sessionType: 'custom_edit',
          model: response.model || this.plugin.settings.modelName,
          totalTimeMs,
          tokensPerSec,
          usage: response.usage,
          responseId: response.id,
          finishReason: response.finish_reason,
          systemFingerprint: response.system_fingerprint,
          createdTimestamp: response.created,
          items: [],
          effectiveSrc: detectedLang.name,
          t
        });
      }
    } catch (err: unknown) {
      console.error(err);
      stopPipelineTimer();
      const rawMsg = err instanceof Error ? err.message : String(err);
      const isContextOrSizeError = /context|chunk|memory|token|length|too large|413|rate_limit|exceeded|payload|overflow|maximum context/i.test(rawMsg);

      const userNotice = isContextOrSizeError
        ? t.sidebar.contextLimitUserNotice.replace('{msg}', rawMsg)
        : t.sidebar.taskFailedUserNotice.replace('{msg}', rawMsg);

      new Notice(userNotice, 8000);

      // 1. Mark Pipeline Status Badge as Error
      const badgeEl = statusBoxEl.querySelector('.emily-badge') as HTMLElement;
      if (badgeEl) {
        badgeEl.className = 'emily-badge is-error';
        badgeEl.empty();
        badgeEl.createSpan({ text: t.sidebar.statusError });
        badgeEl.createSpan({ cls: 'emily-timer-text', text: `${((Date.now() - pipelineStartTime) / 1000).toFixed(1)}s` });
      }

      // 2. Mark active/pending timeline steps as Error
      const step1 = statusBoxEl.querySelector('#step-1') as HTMLElement;
      const step2 = statusBoxEl.querySelector('#step-2') as HTMLElement;
      const step3 = statusBoxEl.querySelector('#step-3') as HTMLElement;

      if (step2?.classList.contains('is-active') || (step2?.classList.contains('is-pending') && !step1?.classList.contains('is-active'))) {
        this.updateTimelineStep(step2, 'error', undefined, t.sidebar.stepOperationErrorMsg.replace('{msg}', rawMsg));
      } else if (step3?.classList.contains('is-active') || step3?.classList.contains('is-pending')) {
        this.updateTimelineStep(step3, 'error', undefined, t.sidebar.stepSyncErrorMsg.replace('{msg}', rawMsg));
      } else if (step1?.classList.contains('is-active')) {
        this.updateTimelineStep(step1, 'error', undefined, t.sidebar.stepInitErrorMsg.replace('{msg}', rawMsg));
      }

      // 3. Render Error Banner with description & raw message
      const errBox = statusBoxEl.createDiv({ cls: 'emily-error-banner' });
      const errorTitle = isContextOrSizeError
        ? t.sidebar.contextLimitTitle
        : t.sidebar.errorOccurredTitle;
      const errorDesc = isContextOrSizeError
        ? t.sidebar.contextLimitDesc
        : t.sidebar.genericErrorDesc;

      errBox.createDiv({ cls: 'emily-error-title', text: errorTitle });
      errBox.createDiv({ cls: 'emily-error-desc', text: errorDesc });
      const rawDiv = errBox.createDiv({ cls: 'emily-error-raw' });
      rawDiv.createEl('strong', { text: `${t.sidebar.systemErrorMsg} ` });
      rawDiv.createSpan({ text: rawMsg });

      // 4. Action Buttons: [재시작하기] & [작업 취소]
      const actionsWrap = errBox.createDiv({ cls: 'emily-error-actions' });
      const retryBtn = actionsWrap.createEl('button', {
        text: t.sidebar.retryBtn,
        cls: 'emily-btn-primary emily-retry-btn'
      });

      const cancelBtn = actionsWrap.createEl('button', {
        text: t.sidebar.cancelBtn,
        cls: 'emily-btn-secondary emily-cancel-btn'
      });

      // [재시작하기] 핸들러: 기존 오류 박스를 보존(동결)하고, 바로 아래에 신규 스트림을 append하여 재시작
      retryBtn.addEventListener('click', () => {
        retryBtn.disabled = true;
        cancelBtn.disabled = true;

        const parentEl = statusBoxEl.parentElement || statusBoxEl;
        const newStatusBoxEl = parentEl.createDiv({ cls: 'emily-status-box' });
        if (statusBoxEl.parentElement && statusBoxEl.nextSibling) {
          statusBoxEl.parentElement.insertBefore(newStatusBoxEl, statusBoxEl.nextSibling);
        }

        void this.executePipeline(applyBtn, newStatusBoxEl, textareaEl, t);
      });

      // [작업 취소] 핸들러: 임시 파일 삭제 및 상태 초기화
      cancelBtn.addEventListener('click', () => {
        void (async () => {
          stopPipelineTimer();
          retryBtn.disabled = true;
          cancelBtn.disabled = true;

          if (this.lastCreatedTempPath) {
            try {
              const tempFile = this.app.vault.getAbstractFileByPath(this.lastCreatedTempPath);
              if (tempFile instanceof TFile) {
                await this.app.fileManager.trashFile(tempFile);
              }
            } catch (cleanErr) {
              console.warn('Temporary file cleanup error:', cleanErr);
            }
            this.lastCreatedTempPath = null;
          }

          if (statusBoxEl.parentElement) {
            const allStatusBoxes = statusBoxEl.parentElement.querySelectorAll('.emily-status-box');
            allStatusBoxes.forEach((box) => {
              box.removeClass('is-visible');
              box.empty();
            });
          } else {
            statusBoxEl.removeClass('is-visible');
            statusBoxEl.empty();
          }

          this.setFormDisabledState(false);
          applyBtn.disabled = false;
          new Notice(t.sidebar.cancelSuccess);
        })();
      });

      applyBtn.disabled = false;
    }
  }

  private updateTimelineStep(
    stepEl: HTMLElement | null,
    status: 'pending' | 'active' | 'done' | 'warning' | 'error',
    title?: string,
    desc?: string
  ) {
    if (!stepEl) return;
    stepEl.className = `emily-timeline-step is-${status}`;
    if (title) {
      const titleEl = stepEl.querySelector('.emily-timeline-title');
      if (titleEl) titleEl.textContent = title;
    }
    if (desc) {
      const descEl = stepEl.querySelector('.emily-timeline-desc');
      if (descEl) descEl.textContent = desc;
    }
  }

  private finalizeCompletedSession(params: {
    activeFile: TFile;
    sessionType: 'proofread' | 'translation' | 'custom_edit';
    status?: 'completed' | 'cancelled';
    isSameLangEdit?: boolean;
    targetPath?: string;
    model: string;
    totalTimeMs: number;
    tokensPerSec?: number;
    usage?: LLMUsage;
    responseId?: string;
    finishReason?: string;
    systemFingerprint?: string;
    createdTimestamp?: number;
    items: ProofreadDiffItem[];
    originalMarkdown?: string;
    translatedMarkdown?: string;
    effectiveSrc?: string;
    t: TranslationKeys;
  }) {
    const {
      activeFile,
      sessionType,
      status,
      isSameLangEdit,
      targetPath,
      model,
      totalTimeMs,
      tokensPerSec,
      usage,
      responseId,
      finishReason,
      systemFingerprint,
      createdTimestamp,
      items,
      originalMarkdown,
      translatedMarkdown,
      effectiveSrc,
      t
    } = params;

    // Record this session into Rolling History
    this.sessionCounter++;
    const isAutoSrc = !this.translationOptions.sourceLanguage ||
      normalizeLanguageCode(this.translationOptions.sourceLanguage) === 'auto';
    const recordedTransOptions: TranslationOptions = {
      ...this.translationOptions,
      sourceLanguage: isAutoSrc && effectiveSrc ? `${t.sidebar.autoDetectLabel} (${effectiveSrc})` : this.translationOptions.sourceLanguage
    };

    const sessionData: RollingSessionData = {
      id: this.sessionCounter,
      timestamp: getISODateTimeString(),
      fileName: activeFile.name,
      filePath: activeFile.path,
      sessionType,
      status: status || 'completed',
      isSameLangEdit,
      targetPath,
      promptText: this.customPromptText,
      model,
      totalTimeMs,
      tokensPerSec,
      usage,
      responseId,
      finishReason,
      systemFingerprint,
      createdTimestamp,
      itemsCount: items.length,
      items,
      originalMarkdown,
      translatedMarkdown,
      proofreadOptions: { ...this.proofreadOptions },
      translationOptions: recordedTransOptions
    };

    // Append completed Session Card to sessionsContainerEl
    if (this.sessionsContainerEl) {
      const card = this.createSessionCard(this.sessionsContainerEl, sessionData);
      sessionData.sessionEl = card;
      this.sessions.push(sessionData);
    }

    // Release execution lock and restore controls
    this.isExecuting = false;
    this.lockedTargetFile = null;
    this.lockedTargetView = null;
    this.setFormDisabledState(false);

    // Reset prompt and regenerate active form below
    this.customPromptText = '';
    this.lastCreatedTempPath = null;
    if (this.activeFormContainerEl) {
      this.renderActiveForm(this.activeFormContainerEl, t);
    }

    // Smooth scroll down to the newly created form
    window.setTimeout(() => {
      if (this.activeFormContainerEl) {
        this.activeFormContainerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  private async openFileInTargetPane(targetPath: string, originalFilePath?: string) {
    const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
    if (!(targetFile instanceof TFile)) {
      return;
    }

    let targetLeaf: WorkspaceLeaf | null = null;

    // 1. Find leaf displaying the original file in the workspace
    if (originalFilePath) {
      const leaves = this.app.workspace.getLeavesOfType('markdown');
      for (const leaf of leaves) {
        if (leaf.view instanceof MarkdownView && leaf.view.file?.path === originalFilePath) {
          targetLeaf = leaf;
          break;
        }
      }
    }

    // 2. If not found, check plugin's lastActiveMarkdownView
    if (!targetLeaf && this.plugin.lastActiveMarkdownView?.leaf) {
      const leaf = this.plugin.lastActiveMarkdownView.leaf;
      if (leaf.view && leaf.view.containerEl.isConnected) {
        targetLeaf = leaf;
      }
    }

    // 3. If still not found, find any open markdown leaf in the root workspace
    if (!targetLeaf) {
      const leaves = this.app.workspace.getLeavesOfType('markdown');
      for (const leaf of leaves) {
        if (leaf.getRoot() === this.app.workspace.rootSplit) {
          targetLeaf = leaf;
          break;
        }
      }
    }

    // 4. Fallback to active leaf or most recent leaf
    if (!targetLeaf) {
      targetLeaf = this.app.workspace.getMostRecentLeaf();
    }

    if (targetLeaf) {
      await targetLeaf.openFile(targetFile);
      this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
    } else {
      await this.app.workspace.openLinkText(targetPath, '', false);
    }
  }

  private async jumpToDiffLocation(filePath: string, item: ProofreadDiffItem) {
    if (item.id === 'timestamp_clean_auto' || item.category === 'timestamp' || item.id === 'korean_bold_auto') {
      return;
    }

    let targetLeaf: WorkspaceLeaf | null = null;
    const leaves = this.app.workspace.getLeavesOfType('markdown');

    // 1. Find leaf displaying the target file
    for (const leaf of leaves) {
      if (leaf.view instanceof MarkdownView && leaf.view.file?.path === filePath) {
        targetLeaf = leaf;
        break;
      }
    }

    // 2. If not found, check plugin lastActiveMarkdownView
    if (!targetLeaf && this.plugin.lastActiveMarkdownView?.leaf) {
      const leaf = this.plugin.lastActiveMarkdownView.leaf;
      if (leaf.view && leaf.view.containerEl.isConnected) {
        targetLeaf = leaf;
      }
    }

    // 3. Fallback: open the file in the most recent leaf
    if (!targetLeaf) {
      const targetFile = this.app.vault.getAbstractFileByPath(filePath);
      if (targetFile instanceof TFile) {
        targetLeaf = this.app.workspace.getMostRecentLeaf() || this.app.workspace.getLeaf(false);
        if (targetLeaf) {
          await targetLeaf.openFile(targetFile);
        }
      }
    }

    if (!targetLeaf || !(targetLeaf.view instanceof MarkdownView)) {
      const t = getTranslation(this.plugin.settings.language);
      new Notice(t.sidebar.cannotOpenDocNotice);
      return;
    }

    this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
    const editor = targetLeaf.view.editor;
    const textToFind = item.replacement?.trim() || item.original?.trim() || '';

    let fromPos: { line: number; ch: number } | null = null;
    let toPos: { line: number; ch: number } | null = null;

    // 1. Search around line hint first
    if (item.line && item.line > 0) {
      const lineIdx = item.line - 1;
      if (lineIdx < editor.lineCount()) {
        const lineContent = editor.getLine(lineIdx);
        if (lineContent !== undefined && textToFind && lineContent.includes(textToFind)) {
          const chStart = lineContent.indexOf(textToFind);
          fromPos = { line: lineIdx, ch: chStart };
          toPos = { line: lineIdx, ch: chStart + textToFind.length };
        }
      }
    }

    // 2. Search entire document for exact textToFind
    if (!fromPos && textToFind) {
      const fullDoc = editor.getValue();
      const offset = fullDoc.indexOf(textToFind);
      if (offset !== -1) {
        if (typeof editor.offsetToPos === 'function') {
          fromPos = editor.offsetToPos(offset);
          toPos = editor.offsetToPos(offset + textToFind.length);
        } else {
          const lineCount = editor.lineCount();
          for (let i = 0; i < lineCount; i++) {
            const lineContent = editor.getLine(i);
            if (lineContent.includes(textToFind)) {
              const chStart = lineContent.indexOf(textToFind);
              fromPos = { line: i, ch: chStart };
              toPos = { line: i, ch: chStart + textToFind.length };
              break;
            }
          }
        }
      }
    }

    // 3. If multi-line, search by first non-empty line
    if (!fromPos && textToFind && textToFind.includes('\n')) {
      const firstLine = textToFind.split('\n')[0].trim();
      if (firstLine) {
        const lineCount = editor.lineCount();
        for (let i = 0; i < lineCount; i++) {
          const lineContent = editor.getLine(i);
          if (lineContent.includes(firstLine)) {
            const chStart = lineContent.indexOf(firstLine);
            fromPos = { line: i, ch: chStart };
            toPos = { line: i, ch: chStart + firstLine.length };
            break;
          }
        }
      }
    }

    // 4. Fallback: If line hint is valid, select the line
    if (!fromPos && item.line && item.line > 0) {
      const lineIdx = Math.min(item.line - 1, editor.lineCount() - 1);
      const lineLength = editor.getLine(lineIdx)?.length || 0;
      fromPos = { line: lineIdx, ch: 0 };
      toPos = { line: lineIdx, ch: lineLength };
    }

    const t = getTranslation(this.plugin.settings.language);
    if (fromPos && toPos) {
      // Select the exact replacement text in the markdown document
      editor.setSelection(fromPos, toPos);
      editor.scrollIntoView(
        {
          from: { line: Math.max(0, fromPos.line - 3), ch: fromPos.ch },
          to: { line: Math.min(editor.lineCount() - 1, toPos.line + 3), ch: toPos.ch }
        },
        true
      );
      editor.focus();
      new Notice(t.sidebar.diffSelectedNotice.replace('{line}', String(fromPos.line + 1)));
    } else {
      new Notice(t.sidebar.diffNotFoundNotice);
    }
  }

  private getCategoryLabel(category: string, t: TranslationKeys): string {
    switch (category) {
      case 'spelling':
        return t.sidebar.spelling;
      case 'grammar':
        return t.sidebar.grammar;
      case 'expression':
        return t.sidebar.expression;
      case 'bold_format':
        return t.sidebar.boldFormatCategory;
      case 'consistency':
        return t.sidebar.consistency;
      case 'citation':
        return t.sidebar.citation;
      default:
        return category;
    }
  }

  private createSessionCard(parent: HTMLElement, session: RollingSessionData): HTMLElement {
    const card = parent.createDiv({ cls: 'emily-session-card' });
    const t = getTranslation(this.plugin.settings.language);

    // 1. Header: Left = Status Badge, Right = ISO datetime + chevron
    const header = card.createDiv({ cls: 'emily-session-card-header' });
    const statusBadge = header.createDiv({ cls: 'emily-session-status-badge' });
    const dot = statusBadge.createSpan({ cls: 'emily-status-dot' });
    if (session.status === 'cancelled') {
      dot.addClass('is-cancelled');
      statusBadge.createSpan({ text: t.sidebar.cancelledBadge });
    } else {
      const badgeText = session.sessionType === 'translation'
        ? (session.isSameLangEdit ? t.sidebar.editDoneBadge : t.sidebar.transDoneBadge)
        : (session.sessionType === 'proofread'
            ? t.sidebar.proofreadDoneBadge
            : (session.sessionType === 'custom_edit' ? t.sidebar.directEditDoneBadge : t.common.completed));
      statusBadge.createSpan({ text: badgeText });
    }

    const headerRight = header.createDiv({ cls: 'emily-session-header-right' });
    headerRight.createSpan({ text: session.timestamp, cls: 'emily-session-time' });
    const headerChevron = headerRight.createSpan({ cls: 'emily-session-header-chevron' });
    setIcon(headerChevron, 'chevron-down');

    // Body container for collapsible contents
    const body = card.createDiv({ cls: 'emily-session-card-body' });

    // Allow clicking header to toggle individual card collapsed state
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.toggle('is-collapsed');
    });

    // 2. Target File row (line-broken with dot, ellipsis and tooltip)
    const fileRow = body.createDiv({ cls: 'emily-session-file-row' });
    fileRow.createSpan({ cls: 'emily-status-dot' });
    fileRow.createSpan({
      text: session.fileName,
      cls: 'emily-session-file-name',
      attr: { title: session.filePath || session.fileName }
    });

    // 2-1. Created Output File Row (if new file was created)
    if (session.targetPath) {
      const outputRow = body.createDiv({ cls: 'emily-session-output-file' });
      const fileIcon = outputRow.createSpan();
      setIcon(fileIcon, 'file-text');
      outputRow.createSpan({ text: t.sidebar.createdOutputFile.replace('{file}', session.targetPath.split('/').pop() || '') });
      outputRow.setAttribute('title', t.sidebar.openCreatedFileTooltip);
      outputRow.addEventListener('click', () => {
        void this.openFileInTargetPane(session.targetPath!, session.filePath);
      });
    }

    // 3. User Selected Options Summary Guide
    const optionsSummary = body.createDiv({ cls: 'emily-session-options-summary' });

    // Custom Edit Tags
    if (session.sessionType === 'custom_edit') {
      const editRow = optionsSummary.createDiv({ cls: 'emily-meta-row' });
      editRow.createSpan({ text: t.sidebar.taskType, cls: 'emily-option-tag-title' });
      editRow.createSpan({ text: t.sidebar.customEditLabel, cls: 'emily-option-tags' });
    }

    // Proofread Options Tags (only if proofread active or items exist)
    if (session.sessionType === 'proofread' || session.itemsCount > 0) {
      const proofOpts: string[] = [];
      if (session.proofreadOptions.checkSpelling) proofOpts.push(t.sidebar.spelling);
      if (session.proofreadOptions.checkGrammar) proofOpts.push(t.sidebar.grammar);
      if (session.proofreadOptions.removeTimestamps) proofOpts.push(t.sidebar.timestamp);
      if (session.proofreadOptions.improveExpression) proofOpts.push(t.sidebar.expression);
      if (session.proofreadOptions.checkConsistency) proofOpts.push(t.sidebar.consistency);
      if (session.proofreadOptions.searchCitation) proofOpts.push(t.sidebar.citation);
      if (session.proofreadOptions.vaultSourcePath) {
        proofOpts.push(`${t.sidebar.referencePrefix}${session.proofreadOptions.vaultSourcePath.split('/').pop()}`);
      }

      const proofRow = optionsSummary.createDiv({ cls: 'emily-meta-row' });
      proofRow.createSpan({ text: `${t.sidebar.proofreading}:`, cls: 'emily-option-tag-title' });
      proofRow.createSpan({
        text: proofOpts.length > 0 ? proofOpts.join(', ') : t.sidebar.noSelectionText,
        cls: 'emily-option-tags'
      });
    }

    // Translation / 동일언어 편집 Options Tags (only if translation mode)
    if (session.sessionType === 'translation') {
      const transRow = optionsSummary.createDiv({ cls: 'emily-meta-row' });
      const opTitle = session.isSameLangEdit ? t.sidebar.opLabelEdit : t.sidebar.translation;
      transRow.createSpan({ text: `${opTitle}:`, cls: 'emily-option-tag-title' });
      const transScopeText = session.translationOptions.scope === 'selection'
        ? (session.isSameLangEdit ? t.sidebar.syncReplaceEditDone : t.sidebar.scopeSelection)
        : (session.translationOptions.scope === 'all'
            ? (session.isSameLangEdit ? t.sidebar.syncDirectEditDone : t.sidebar.scopeAll)
            : t.sidebar.scopeParagraphBilingual);
      const transModeText = session.translationOptions.preservation === 'new_file'
        ? (session.isSameLangEdit ? t.sidebar.syncNewFileEditDone.replace(' ({file})', '') : t.sidebar.preserveNewFile)
        : (session.translationOptions.preservation === 'append'
            ? (session.isSameLangEdit ? t.sidebar.syncAppendDocEditDone : t.sidebar.preserveAppend)
            : (session.isSameLangEdit ? t.sidebar.syncDirectEditDone : t.sidebar.preserveOverwrite));
      const srcDisplay = getLocalizedLanguageName(session.translationOptions.sourceLanguage, t) || t.languages.auto;
      const tgtDisplay = getLocalizedLanguageName(session.translationOptions.targetLanguage, t);
      const langDisplay = session.isSameLangEdit
        ? `${srcDisplay} (${t.sidebar.sameLangEditSuffix})`
        : `${srcDisplay} ➔ ${tgtDisplay}`;
      transRow.createSpan({
        text: `${langDisplay} (${transScopeText}, ${transModeText})`,
        cls: 'emily-option-tags'
      });
    }

    // 4. Custom Prompt if any
    if (session.promptText && session.promptText.trim()) {
      const promptBox = body.createDiv({ cls: 'emily-session-prompt-box' });
      promptBox.createEl('strong', { text: `${t.sidebar.customPrompt}: ` });
      promptBox.createSpan({ text: `"${session.promptText}"` });
    }

    // 5. Proofreading Detailed Changes Breakdown (only if proofread was run and items exist)
    if (session.status === 'cancelled') {
      const detailsSection = body.createDiv({ cls: 'emily-session-details-section' });
      const itemsCount = session.items ? session.items.length : session.itemsCount;
      const emptyNotice = detailsSection.createDiv({ cls: 'text-muted text-xs' });
      emptyNotice.setText(t.sidebar.cancelledNoticeInCard.replace('{count}', String(itemsCount)));

      if (session.items && session.items.length > 0) {
        const reopenBtn = detailsSection.createEl('button', {
          text: t.sidebar.reopenProofreadBtn.replace('{count}', String(session.items.length)),
          cls: 'emily-reopen-modal-btn'
        });
        reopenBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.reopenProofreadModalForSession(session, card);
        });
      }
    } else if (session.sessionType === 'proofread' || (session.items && session.items.length > 0)) {
      const detailsSection = body.createDiv({ cls: 'emily-session-details-section' });
      const detailsHeader = detailsSection.createDiv({ cls: 'emily-session-details-header' });
      const itemsCount = session.items ? session.items.length : session.itemsCount;
      detailsHeader.createSpan({
        text: t.sidebar.proofreadDetailsHeader.replace('{count}', String(itemsCount)),
        cls: 'font-semibold'
      });

      if (session.items && session.items.length > 0) {
        const itemsList = detailsSection.createDiv({ cls: 'emily-session-items-list' });
        for (const item of session.items) {
          const itemCard = itemsList.createDiv({ cls: 'emily-session-diff-item' });

          // Meta (Category + Line)
          const metaRow = itemCard.createDiv({ cls: 'emily-session-diff-meta' });
          const catBadge = metaRow.createSpan({ cls: 'emily-session-diff-badge' });
          catBadge.setText(this.getCategoryLabel(item.category, t));

          if (item.line) {
            metaRow.createSpan({ text: `L.${item.line}`, cls: 'text-muted text-xs' });
          }

          // Diff Row (Original ➔ Replacement)
          const contentRow = itemCard.createDiv({ cls: 'emily-session-diff-content' });
          contentRow.createSpan({ text: item.original, cls: 'emily-session-diff-del' });
          contentRow.createSpan({ text: '➔', cls: 'emily-session-diff-arrow' });

          const isSpecialCleanItem = item.id === 'timestamp_clean_auto' || item.category === 'timestamp' || item.id === 'korean_bold_auto';

          if (isSpecialCleanItem) {
            contentRow.createSpan({
              text: item.replacement,
              cls: 'emily-session-diff-ins is-non-interactive'
            });
          } else {
            const insSpan = contentRow.createSpan({
              text: item.replacement,
              cls: 'emily-session-diff-ins',
              attr: { title: t.sidebar.jumpToDocTooltip }
            });
            insSpan.addEventListener('click', (e) => {
              e.stopPropagation();
              void this.jumpToDiffLocation(session.filePath || session.fileName, item);
            });
          }

          // Explanation
          if (item.explanation) {
            const expRow = itemCard.createDiv({ cls: 'emily-session-diff-explanation' });
            expRow.createSpan({ text: `💡 ${item.explanation}` });
          }
        }
      } else {
        const emptyNotice = detailsSection.createDiv({ cls: 'text-muted text-xs' });
        emptyNotice.setText(t.sidebar.noIssuesDetected);
      }
    } else if (session.sessionType === 'translation' && (session.translatedMarkdown || session.targetPath)) {
      const transSection = body.createDiv({ cls: 'emily-session-details-section' });
      const transHeader = transSection.createDiv({ cls: 'emily-session-details-header' });
      transHeader.createSpan({
        text: session.isSameLangEdit ? t.sidebar.reopenEditReviewHeader : t.sidebar.reopenTransReviewHeader,
        cls: 'font-semibold'
      });

      const reopenTransBtn = transSection.createEl('button', {
        text: session.isSameLangEdit
          ? t.sidebar.reopenTransBtnEdit
          : t.sidebar.reopenTransBtnReview,
        cls: 'emily-reopen-modal-btn'
      });
      reopenTransBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetPath = session.filePath || session.fileName;
        let targetFile = this.app.vault.getAbstractFileByPath(targetPath);
        if (!(targetFile instanceof TFile)) {
          const resolved = this.app.metadataCache.getFirstLinkpathDest(session.fileName || '', session.filePath || '');
          if (resolved instanceof TFile) {
            targetFile = resolved;
          }
        }
        if (targetFile instanceof TFile) {
          const modal = new TranslationDiffModal(
            this.app,
            targetFile,
            session.originalMarkdown || '',
            session.translatedMarkdown || '',
            session.translationOptions,
            this.plugin.getTranslationEngine(),
            undefined,
            this.plugin.settings.language
          );
          modal.open();
        } else {
          new Notice(t.sidebar.cannotFindDocNotice);
        }
      });
    }

    // 6. Response Summary & Telemetry Metadata (Collapsible: default 1 line collapsed)
    const metaContainer = body.createDiv({ cls: 'emily-meta-collapsible' });

    const totalTokensText = session.usage?.total_tokens
      ? ` · ${t.sidebar.tokenUnit} ${session.usage.total_tokens.toLocaleString()}${t.sidebar.tokensCountSuffix}`
      : '';
    const speedText = session.tokensPerSec ? ` (${session.tokensPerSec} t/s)` : '';
    const latencySec = (session.totalTimeMs / 1000).toFixed(2);

    const summaryBar = metaContainer.createDiv({ cls: 'emily-meta-summary' });
    summaryBar.setAttribute('title', t.sidebar.toggleTelemetryTooltip);
    const summaryLeft = summaryBar.createDiv({ cls: 'emily-meta-summary-left' });
    summaryLeft.createSpan({ text: '🧠 ' });
    summaryLeft.createSpan({ text: session.model });
    summaryLeft.createSpan({
      text: ` · ${latencySec}s${speedText}${totalTokensText}`,
      cls: 'text-muted'
    });

    const chevron = summaryBar.createSpan({ cls: 'emily-meta-chevron' });
    setIcon(chevron, 'chevron-down');

    // Expandable detail view (default collapsed)
    const detailsView = metaContainer.createDiv({ cls: 'emily-meta-details' });

    // Helper for pure DOM telemetry grid items
    const createMetaItem = (parent: HTMLElement, label: string, val: string, title?: string, valCls?: string) => {
      const item = parent.createDiv({ cls: 'emily-meta-item' });
      item.createSpan({ cls: 'emily-meta-item-label', text: label });
      const valSpan = item.createSpan({ cls: `emily-meta-item-val ${valCls || ''}`.trim(), text: val });
      if (title) valSpan.setAttribute('title', title);
      return item;
    };

    // Section 1: Performance & Model
    detailsView.createDiv({
      cls: 'emily-meta-section-title',
      text: t.sidebar.telemetryTitle
    });
    const grid1 = detailsView.createDiv({ cls: 'emily-meta-grid' });

    createMetaItem(grid1, t.sidebar.modelLabel, session.model);
    createMetaItem(grid1, t.sidebar.elapsedLabel, `${latencySec}s (${session.totalTimeMs}ms)`);
    createMetaItem(grid1, t.sidebar.speedLabel, `${session.tokensPerSec || 0} tokens/sec`);
    createMetaItem(grid1, t.sidebar.finishReasonLabel, session.finishReason || 'stop');

    if (session.responseId) {
      const displayId = session.responseId.length > 20 ? session.responseId.slice(0, 18) + '…' : session.responseId;
      createMetaItem(grid1, t.sidebar.responseIdLabel, displayId, session.responseId);
    }

    if (session.systemFingerprint) {
      createMetaItem(grid1, t.sidebar.systemFingerprintLabel, session.systemFingerprint);
    }

    // Section 2: Token Usage Breakdown
    detailsView.createDiv({
      cls: 'emily-meta-section-title',
      text: t.sidebar.tokenUsageTitle
    });
    const grid2 = detailsView.createDiv({ cls: 'emily-meta-grid' });

    const promptTokens = session.usage?.prompt_tokens;
    const completionTokens = session.usage?.completion_tokens;
    const totalTokens = session.usage?.total_tokens ?? (typeof promptTokens === 'number' && typeof completionTokens === 'number' ? promptTokens + completionTokens : undefined);

    createMetaItem(grid2, t.sidebar.promptTokensLabel, typeof promptTokens === 'number' ? promptTokens.toLocaleString() : (promptTokens || '-'));
    createMetaItem(grid2, t.sidebar.completionTokensLabel, typeof completionTokens === 'number' ? completionTokens.toLocaleString() : (completionTokens || '-'));
    createMetaItem(grid2, t.sidebar.totalTokensLabel, typeof totalTokens === 'number' ? totalTokens.toLocaleString() : (totalTokens || '-'), undefined, 'font-semibold');

    if (session.usage?.prompt_tokens_details?.cached_tokens !== undefined) {
      createMetaItem(grid2, t.sidebar.cachedTokensLabel, session.usage.prompt_tokens_details.cached_tokens.toLocaleString());
    }

    if (session.usage?.completion_tokens_details?.reasoning_tokens !== undefined) {
      createMetaItem(grid2, t.sidebar.reasoningTokensLabel, session.usage.completion_tokens_details.reasoning_tokens.toLocaleString());
    }

    // Toggle click event
    summaryBar.addEventListener('click', (e) => {
      e.stopPropagation();
      metaContainer.classList.toggle('is-expanded');
    });

    return card;
  }

  private async reopenProofreadModalForSession(session: RollingSessionData, cardEl?: HTMLElement) {
    const t = getTranslation(this.plugin.settings.language);
    if (!session.items || session.items.length === 0) {
      new Notice(t.sidebar.noReopenItemsNotice);
      return;
    }

    // 1. Find leaf displaying the target file
    let targetLeaf: WorkspaceLeaf | null = null;
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      if (leaf.view instanceof MarkdownView && leaf.view.file?.path === (session.filePath || session.fileName)) {
        targetLeaf = leaf;
        break;
      }
    }

    if (!targetLeaf) {
      const targetFile = this.app.vault.getAbstractFileByPath(session.filePath || session.fileName);
      if (targetFile instanceof TFile) {
        targetLeaf = this.app.workspace.getMostRecentLeaf() || this.app.workspace.getLeaf(false);
        if (targetLeaf) {
          await targetLeaf.openFile(targetFile);
        }
      }
    }

    if (!targetLeaf || !(targetLeaf.view instanceof MarkdownView)) {
      new Notice(t.sidebar.cannotOpenDocNotice);
      return;
    }

    this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
    const editor = targetLeaf.view.editor;

    const modal = new ProofreadDiffModal(
      this.app,
      editor,
      session.items,
      (appliedItems: ProofreadDiffItem[]) => {
        session.status = 'completed';
        session.items = appliedItems;
        session.itemsCount = appliedItems.length;
        if (cardEl) {
          const badge = cardEl.querySelector('.emily-session-status-badge');
          if (badge) {
            badge.empty();
            badge.createSpan({ cls: 'emily-status-dot is-accent' });
            badge.createSpan({ text: t.sidebar.proofreadDoneBadge });
          }
          const detailsSec = cardEl.querySelector('.emily-session-details-section');
          if (detailsSec) {
            detailsSec.empty();
            const hdr = detailsSec.createDiv({ cls: 'emily-session-details-header' });
            hdr.createSpan({ text: `${t.sidebar.proofreadDetailsHeader.replace('{count}', String(appliedItems.length))} (${t.sidebar.appliedChangesCount.replace('{count}', String(appliedItems.length))})`, cls: 'font-semibold' });
          }
        }
        new Notice(t.sidebar.proofreadSuccessNotice.replace('{count}', String(appliedItems.length)));
      },
      () => {
        new Notice(t.sidebar.proofreadCancelNotice);
      },
      this.plugin.settings.language
    );
    modal.open();
  }

  private renderSidebarNavigator(container: HTMLElement) {
    if (this.sidebarNavigatorEl) {
      this.sidebarNavigatorEl.remove();
      this.sidebarNavigatorEl = null;
    }
    if (!this.plugin.settings.showFloatingScrollButtons) {
      return;
    }
    const t = getTranslation(this.plugin.settings.language);
    this.sidebarNavigatorEl = container.createDiv({ cls: 'emily-sidebar-navigator' });

    // Scroll Up to Previous Apply Session Button
    const upBtn = this.sidebarNavigatorEl.createEl('button', {
      cls: 'emily-sidebar-nav-btn',
      attr: { title: t.sidebar.prevSessionTooltip }
    });
    setIcon(upBtn, 'chevron-up');
    upBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToPrevSession();
    });

    // Scroll Down to Next Apply Session / Latest Form Button
    const downBtn = this.sidebarNavigatorEl.createEl('button', {
      cls: 'emily-sidebar-nav-btn',
      attr: { title: t.sidebar.nextSessionTooltip }
    });
    setIcon(downBtn, 'chevron-down');
    downBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToNextSession();
    });
  }

  public updateNavigatorVisibility() {
    const shouldShow = Boolean(this.plugin.settings.showFloatingScrollButtons);
    if (!this.sidebarNavigatorEl) {
      if (shouldShow && this.containerEl) {
        const container = this.containerEl.children[1] as HTMLElement;
        if (container) {
          this.renderSidebarNavigator(container);
        }
      }
      return;
    }
    this.sidebarNavigatorEl.style.display = shouldShow ? 'flex' : 'none';
  }

  private getAllScrollTargets(): HTMLElement[] {
    const targets: HTMLElement[] = [];
    for (const session of this.sessions) {
      if (session.sessionEl && session.sessionEl.isConnected) {
        targets.push(session.sessionEl);
      }
    }
    if (this.activeFormContainerEl && this.activeFormContainerEl.isConnected) {
      targets.push(this.activeFormContainerEl);
    }
    return targets;
  }

  private navigateToPrevSession() {
    if (!this.contentScrollEl) return;
    const targets = this.getAllScrollTargets();
    if (targets.length === 0) return;

    const currentScrollTop = this.contentScrollEl.scrollTop;
    // Find target above current scroll position with a 15px threshold
    for (let i = targets.length - 1; i >= 0; i--) {
      const el = targets[i];
      if (el.offsetTop < currentScrollTop - 15) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    // If at top or no previous, scroll to topmost
    targets[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private navigateToNextSession() {
    if (!this.contentScrollEl) return;
    const targets = this.getAllScrollTargets();
    if (targets.length === 0) return;

    const currentScrollTop = this.contentScrollEl.scrollTop;
    // Find target below current scroll position with a 15px threshold
    for (let i = 0; i < targets.length; i++) {
      const el = targets[i];
      if (el.offsetTop > currentScrollTop + 15) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    // If already near bottom, scroll to activeFormContainerEl
    if (this.activeFormContainerEl) {
      this.activeFormContainerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private createCheckboxItem(parent: HTMLElement, label: string, desc: string, defaultChecked: boolean, onChange: (val: boolean) => void): HTMLInputElement {
    const item = parent.createEl('label', { cls: 'emily-option-item' });
    const checkbox = item.createEl('input', { type: 'checkbox' });
    checkbox.checked = defaultChecked;
    checkbox.addEventListener('change', () => onChange(checkbox.checked));

    const textWrap = item.createDiv({ cls: 'emily-option-text' });
    textWrap.createSpan({ text: label, cls: 'emily-option-label' });
    if (desc) {
      textWrap.createSpan({ text: desc, cls: 'emily-option-desc' });
    }
    return checkbox;
  }

  private createRadioItem(parent: HTMLElement, groupName: string, label: string, defaultChecked: boolean, onSelect: () => void) {
    const item = parent.createEl('label', { cls: 'emily-option-item' });
    const radio = item.createEl('input', { type: 'radio', attr: { name: groupName } });
    radio.checked = defaultChecked;
    radio.addEventListener('change', () => {
      if (radio.checked) onSelect();
    });

    const textWrap = item.createDiv({ cls: 'emily-option-text' });
    textWrap.createSpan({ text: label, cls: 'emily-option-label' });
  }

  private splitLabelExtra(label: string): { main: string; extra?: string } {
    const match = label.match(/^(.*?)\s*(\([^)]+\))\s*$/);
    if (match && match[1].trim()) {
      return {
        main: match[1].trim(),
        extra: match[2].trim()
      };
    }
    return { main: label };
  }

  private renderSegmentedLabel(container: HTMLElement, label: string): HTMLElement {
    const labelSpan = container.createSpan({ cls: 'emily-segmented-label' });
    const { main, extra } = this.splitLabelExtra(label);
    labelSpan.createSpan({ text: main, cls: 'emily-label-main' });
    if (extra) {
      labelSpan.createSpan({ text: extra, cls: 'emily-label-extra' });
    }
    return labelSpan;
  }

  private createSegmentedGroup<T extends string>(
    parent: HTMLElement,
    label: string,
    options: Array<{
      value: T;
      icon: string;
      label: string;
      desc?: string;
    }>,
    currentValue: T,
    onSelect: (val: T) => void
  ): (val: T) => void {
    const groupWrap = parent.createDiv({ cls: 'emily-field-group' });
    groupWrap.createSpan({ text: label, cls: 'emily-field-label font-semibold' });

    const grid = groupWrap.createDiv({ cls: 'emily-segmented-grid' });
    const btnEls: Map<T, HTMLElement> = new Map();

    options.forEach((opt) => {
      const btn = grid.createEl('button', {
        cls: `emily-segmented-btn ${opt.value === currentValue ? 'is-active' : ''}`,
        attr: {
          type: 'button',
          title: opt.desc ? `${opt.label} - ${opt.desc}` : opt.label
        }
      });

      const iconSpan = btn.createSpan({ cls: 'emily-segmented-icon' });
      setIcon(iconSpan, opt.icon);

      this.renderSegmentedLabel(btn, opt.label);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnEls.forEach((b) => b.removeClass('is-active'));
        btn.addClass('is-active');
        onSelect(opt.value);
      });

      btnEls.set(opt.value, btn);
    });

    return (newVal: T) => {
      btnEls.forEach((b, k) => {
        if (k === newVal) b.addClass('is-active');
        else b.removeClass('is-active');
      });
    };
  }

  private createToggleSegmentedButton(
    grid: HTMLElement,
    icon: string,
    label: string,
    desc: string,
    initialChecked: boolean,
    onToggle: (checked: boolean) => void
  ): HTMLButtonElement {
    const btn = grid.createEl('button', {
      cls: `emily-segmented-btn ${initialChecked ? 'is-active' : ''}`,
      attr: {
        type: 'button',
        title: desc ? `${label} - ${desc}` : label,
        'aria-pressed': initialChecked ? 'true' : 'false'
      }
    });

    const iconSpan = btn.createSpan({ cls: 'emily-segmented-icon' });
    setIcon(iconSpan, icon);

    this.renderSegmentedLabel(btn, label);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newActive = !btn.hasClass('is-active');
      if (newActive) {
        btn.addClass('is-active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.removeClass('is-active');
        btn.setAttribute('aria-pressed', 'false');
      }
      onToggle(newActive);
    });

    return btn;
  }

  private toggleAccordion(header: HTMLElement, body: HTMLElement) {
    const isExpanded = header.hasClass('is-expanded');
    if (isExpanded) {
      header.removeClass('is-expanded');
      header.setAttribute('aria-expanded', 'false');
      body.addClass('is-collapsed');
    } else {
      header.addClass('is-expanded');
      header.setAttribute('aria-expanded', 'true');
      body.removeClass('is-collapsed');
    }
  }

  private toggleControlAccordions() {
    if (!this.activeFormContainerEl) return;
    const headers = this.activeFormContainerEl.querySelectorAll('.emily-accordion-header');
    const bodies = this.activeFormContainerEl.querySelectorAll('.emily-accordion-body');
    const anyExpanded = Array.from(headers).some((h) => h.classList.contains('is-expanded'));

    headers.forEach((h) => {
      if (anyExpanded) h.classList.remove('is-expanded');
      else h.classList.add('is-expanded');
    });

    bodies.forEach((b) => {
      if (anyExpanded) b.classList.add('is-collapsed');
      else b.classList.remove('is-collapsed');
    });

    // Scroll active form container smoothly into view at top
    if (this.activeFormContainerEl) {
      this.activeFormContainerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private toggleHistorySessions() {
    if (!this.sessionsContainerEl) return;
    const cards = this.sessionsContainerEl.querySelectorAll('.emily-session-card');
    if (cards.length === 0) {
      const t = getTranslation(this.plugin.settings.language);
      new Notice(t.sidebar.noHistoryNotice);
      return;
    }
    const anyExpanded = Array.from(cards).some((c) => !c.classList.contains('is-collapsed'));
    cards.forEach((c) => {
      if (anyExpanded) c.classList.add('is-collapsed');
      else c.classList.remove('is-collapsed');
    });
  }

  async onClose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}
